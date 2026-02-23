export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ==========================================
    // 1. 处理 /graph 路由及密码鉴权
    // ==========================================
    if (url.pathname === "/graph") {
      // 从环境变量获取密码，如果没有设置，默认使用 "123456"
      const EXPECTED_CODE = env.GRAPH_AUTH_CODE || "123456";
      const COOKIE_NAME = "graph_auth_token";

      // 处理表单提交 (POST)
      if (request.method === "POST") {
        const formData = await request.formData();
        const inputCode = formData.get("code");
        
        if (inputCode === EXPECTED_CODE) {
          // 密码正确，写入 Cookie，有效期 7 天，并刷新页面
          return new Response("验证成功，正在跳转...", {
            status: 302,
            headers: {
              "Location": "/graph",
              "Set-Cookie": `${COOKIE_NAME}=${EXPECTED_CODE}; Path=/graph; Max-Age=604800; HttpOnly; SameSite=Lax`
            }
          });
        } else {
          // 密码错误，返回登录页并提示
          return new Response(generateAuthHTML("密码错误，请重新输入"), {
            headers: { "content-type": "text/html;charset=UTF-8" }
          });
        }
      }

      // 处理正常访问 (GET)，检查 Cookie
      const cookieHeader = request.headers.get("Cookie") || "";
      if (!cookieHeader.includes(`${COOKIE_NAME}=${EXPECTED_CODE}`)) {
        // 没有合法的 Cookie，展示输入密码页面
        return new Response(generateAuthHTML(), {
          headers: { "content-type": "text/html;charset=UTF-8" }
        });
      }

      // 鉴权通过，渲染图表页面
      return await renderGraphPage(env);
    }

    // ==========================================
    // 2. 原有逻辑：处理主页 (IP 查看器)
    // ==========================================
    const cf = request.cf || {};
    const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Real-IP") || "未知";
    const lat = cf.latitude || 0;
    const lon = cf.longitude || 0;
    const asnOrg = cf.asOrganization || "";

    // 异步更新 KV 记录（不阻塞页面返回）
    if (env.VISITOR_KV && ip !== "未知") {
      ctx.waitUntil(recordVisitor(env, ip, cf));
    }

    const isDataCenter = /Google|Amazon|Cloudflare|Akamai|DigitalOcean|Microsoft|Alibaba|Tencent/i.test(asnOrg);
    const ipTypeTag = isDataCenter ? "🏢 数据中心 (机房)" : "🏠 住宅/移动网络";

    const body = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset='UTF-8'>
      <meta name='viewport' content='width=device-width, initial-scale=1'>
      <title>NETWORK LOCATOR - IP信息查询</title>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery.ripples/0.5.3/jquery.ripples.min.js"></script>
      
      <style>
        :root {
          --glass-bg: rgba(255, 255, 255, 0.12);
          --glass-border: rgba(255, 255, 255, 0.2);
          --text-main: #ffffff;
          --text-dim: #dddddd;
          --accent-blue: #4facfe;
          --accent-green: #00f2fe;
        }
        body { 
          margin: 0; padding: 0;
          font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
          background-image: url('https://tc.john-life.sbs/api/rfile/girlpuppy.jpg');
          background-repeat: no-repeat; background-position: center center;
          background-attachment: fixed; background-size: cover;
          display: flex; justify-content: center; align-items: center;
          min-height: 100vh; color: var(--text-main); overflow-x: hidden;
        }
        .overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.2); z-index: 1; pointer-events: none;
        }
        .container { 
          position: relative; z-index: 2; width: 90%; max-width: 1100px;
          background: var(--glass-bg); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
          border: 1px solid var(--glass-border); border-radius: 25px; padding: 40px;
          box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5); animation: fadeIn 0.8s ease-out;
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        h1 { 
          text-align: center; font-weight: 600; font-size: 2.5em; margin-top: 0; margin-bottom: 35px; letter-spacing: 2px;
          background: linear-gradient(to right, #ffffff, #4facfe); -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .content-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 30px; align-items: start; }
        table { width: 100%; border-collapse: collapse; }
        table td { padding: 14px 12px; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 1em; }
        .label { font-weight: bold; width: 32%; color: var(--text-dim); font-size: 0.85em; text-transform: uppercase; }
        .ip-badge {
          background: var(--accent-blue); padding: 4px 12px; border-radius: 8px; cursor: pointer; transition: all 0.3s;
          display: inline-block; font-weight: bold; box-shadow: 0 4px 15px rgba(79, 172, 254, 0.4); text-decoration: none; color: white;
        }
        .ip-badge:hover { transform: scale(1.05); background: var(--accent-green); color: white;}
        .map-container { width: 100%; height: 100%; min-height: 420px; border-radius: 20px; overflow: hidden; border: 1px solid var(--glass-border); box-shadow: 0 10px 20px rgba(0,0,0,0.2); }
        #map { width: 100%; height: 100%; }
        .ua-section { grid-column: 1 / -1; margin-top: 20px; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 10px; font-size: 0.85em; color: #aaa; word-break: break-all; display: flex; justify-content: space-between; align-items: center; }
        @media (max-width: 992px) { .content-grid { grid-template-columns: 1fr; } .container { padding: 30px; } h1 { font-size: 2em; } .map-container { min-height: 300px; } }
        @media (max-width: 768px) { .container { padding: 25px; width: 95%; } h1 { font-size: 1.8em; } table td { padding: 12px 10px; font-size: 0.95em; } .ua-section { flex-direction: column; gap: 10px; align-items: flex-start; } }
      </style>
    </head>
    <body>
      <div class="overlay"></div>
      <div class="container">
        <h1>NETWORK LOCATOR</h1>
        <div class="content-grid">
          <div class="info-side">
            <table>
              <tr><td class="label">IP Address</td><td><span class="ip-badge" title="点击复制" onclick="copyIP(this)">${ip}</span></td></tr>
              <tr><td class="label">所在地(CITY)</td><td>${cf.city || 'Unknown'}, ${cf.region || ''}, ${cf.country || ''}</td></tr>
              <tr><td class="label">运营商 (ASN)</td><td>AS${cf.asn} - ${asnOrg}</td></tr>
              <tr><td class="label">数据中心</td><td>${cf.colo} Node</td></tr>
              <tr><td class="label">IP 类型</td><td>${ipTypeTag}</td></tr>
              <tr><td class="label">地理坐标</td><td>${lat}, ${lon}</td></tr>
              <tr><td class="label">时区</td><td>${cf.timezone} —— ${new Date().toLocaleString('zh-CN', {timeZone: cf.timezone || 'UTC', hour12: false, hour: '2-digit', minute: '2-digit'})}</td></tr>
            </table>
          </div>
          <div class="map-container"><div id="map"></div></div>
          <div class="ua-section">
            <div><strong>User Agent:</strong><br>${request.headers.get("User-Agent")}</div>
            <a href="/graph" class="ip-badge" style="white-space: nowrap; font-size: 0.9em;">📊 查看访客全景图</a>
          </div>
        </div>
      </div>
      <script>
        $(document).ready(function() { try { $('body').ripples({ resolution: 512, dropRadius: 20, perturbance: 0.05 }); } catch (e) {} });
        const isChina = '${cf.country}' === 'CN';
        const map = L.map('map').setView([${lat}, ${lon}], 11);
        if (isChina) { L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', { attribution: '© 高德地图', subdomains: ['1', '2', '3', '4'], maxZoom: 18 }).addTo(map); } 
        else { L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { attribution: '© Google Maps', subdomains: ['0', '1', '2', '3'], maxZoom: 20 }).addTo(map); }
        const customIcon = L.divIcon({ className: 'custom-marker', html: '<div style="background: #4facfe; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>', iconSize: [20, 20], iconAnchor: [10, 10] });
        L.marker([${lat}, ${lon}], {icon: customIcon}).addTo(map).bindPopup('<b>你的位置</b><br>${cf.city || 'Unknown'}').openPopup();
        function copyIP(el) { const text = el.innerText; navigator.clipboard.writeText(text).then(() => { el.innerText = "COPIED! ✨"; setTimeout(() => { el.innerText = text; }, 1500); }); }
      </script>
    </body>
    </html> 
    `;
    return new Response(body, { headers: { "content-type": "text/html;charset=UTF-8" } });
  }
};

// ==========================================
// 辅助函数：生成密码输入界面
// ==========================================
function generateAuthHTML(errorMsg = "") {
  return `
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>身份验证 - 访客全景图</title>
    <style>
      body {
        margin: 0; padding: 0; height: 100vh;
        display: flex; justify-content: center; align-items: center;
        font-family: 'PingFang SC', sans-serif;
        background-image: url('https://tc.john-life.sbs/api/rfile/girlpuppy.jpg');
        background-size: cover; background-position: center; color: white;
      }
      .login-box {
        background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
        padding: 40px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.2);
        text-align: center; box-shadow: 0 15px 35px rgba(0,0,0,0.5); width: 300px;
      }
      h2 { margin-top: 0; background: linear-gradient(to right, #ffffff, #4facfe); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      input {
        width: 100%; padding: 12px; margin: 15px 0; border-radius: 8px; border: none;
        background: rgba(0,0,0,0.3); color: white; outline: none; box-sizing: border-box; text-align: center;
      }
      button {
        width: 100%; padding: 12px; border: none; border-radius: 8px;
        background: #4facfe; color: white; font-weight: bold; cursor: pointer; transition: 0.3s;
      }
      button:hover { background: #00f2fe; }
      .error { color: #ff4d4f; font-size: 0.9em; margin-bottom: 10px; }
      .back { display: block; margin-top: 15px; color: #ddd; text-decoration: none; font-size: 0.9em; }
    </style>
  </head>
  <body>
    <div class="login-box">
      <h2>🔐 访问受限</h2>
      <p style="font-size: 0.9em; color: #ccc;">请输入授权码以查看访客数据</p>
      ${errorMsg ? `<div class="error">${errorMsg}</div>` : ''}
      <form action="/graph" method="POST">
        <input type="password" name="code" placeholder="输入密码" required autofocus>
        <button type="submit">解锁图表</button>
      </form>
      <a href="/" class="back">🔙 返回主页</a>
    </div>
  </body>
  </html>`;
}

// ==========================================
// 辅助函数：记录访问者到 KV (最大100条)
// ==========================================
async function recordVisitor(env, ip, cf) {
  const KV_KEY = "VISITOR_RECORDS";
  let records = {};
  try {
    const data = await env.VISITOR_KV.get(KV_KEY, "json");
    if (data) records = data;
  } catch (e) {}

  if (records[ip]) {
    records[ip].count += 1;
    records[ip].lastVisit = Date.now();
    records[ip].lat = cf.latitude || records[ip].lat;
    records[ip].lon = cf.longitude || records[ip].lon;
  } else {
    records[ip] = {
      ip: ip, lat: cf.latitude || 0, lon: cf.longitude || 0,
      city: cf.city || "Unknown", country: cf.country || "Unknown",
      count: 1, lastVisit: Date.now()
    };
  }

  let arr = Object.values(records);
  if (arr.length > 100) {
    arr.sort((a, b) => b.lastVisit - a.lastVisit);
    arr = arr.slice(0, 100);
    records = {}; arr.forEach(item => { records[item.ip] = item; });
  }
  await env.VISITOR_KV.put(KV_KEY, JSON.stringify(records));
}

// ==========================================
// 辅助函数：生成 /graph 路由的 HTML (图表页面)
// ==========================================
async function renderGraphPage(env) {
  let recordsData = {};
  if (env.VISITOR_KV) {
    recordsData = await env.VISITOR_KV.get("VISITOR_RECORDS", "json") || {};
  }
  const recordsArray = Object.values(recordsData).sort((a, b) => b.lastVisit - a.lastVisit);

  const html = `
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1'>
    <title>访客全景图 - NETWORK LOCATOR</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
      :root { --glass-bg: rgba(255, 255, 255, 0.12); --glass-border: rgba(255, 255, 255, 0.2); --text-main: #ffffff; --accent-blue: #4facfe; }
      body { 
        margin: 0; padding: 20px; font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
        background-image: url('https://tc.john-life.sbs/api/rfile/girlpuppy.jpg');
        background-repeat: no-repeat; background-position: center center; background-attachment: fixed; background-size: cover;
        color: var(--text-main); display: flex; justify-content: center; min-height: 100vh;
      }
      .overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.4); z-index: -1; }
      .container { width: 100%; max-width: 1200px; background: var(--glass-bg); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid var(--glass-border); border-radius: 20px; padding: 30px; box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5); }
      .header-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
      h1 { margin: 0; font-size: 1.8em; text-shadow: 0 2px 4px rgba(0,0,0,0.5); }
      .back-btn { background: var(--accent-blue); padding: 8px 20px; border-radius: 8px; color: white; text-decoration: none; font-weight: bold; transition: all 0.3s; }
      .back-btn:hover { background: #00f2fe; transform: translateY(-2px); }
      #map { width: 100%; height: 400px; border-radius: 15px; margin-bottom: 30px; border: 1px solid var(--glass-border); box-shadow: 0 10px 20px rgba(0,0,0,0.3); }
      .table-container { overflow-x: auto; }
      table { width: 100%; border-collapse: collapse; background: rgba(0,0,0,0.2); border-radius: 10px; overflow: hidden; }
      th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.05); }
      th { background: rgba(255,255,255,0.1); font-weight: bold; }
      tr:hover { background: rgba(255,255,255,0.08); }
    </style>
  </head>
  <body>
    <div class="overlay"></div>
    <div class="container">
      <div class="header-bar">
        <h1>🌍 访客全景图 (Top 100)</h1>
        <a href="/" class="back-btn">🔙 返回主页</a>
      </div>
      <div id="map"></div>
      <div class="table-container">
        <table>
          <thead><tr><th>访客 IP</th><th>地理位置</th><th>访问次数</th><th>最后访问时间</th></tr></thead>
          <tbody id="table-body"></tbody>
        </table>
      </div>
    </div>
    <script>
      const records = ${JSON.stringify(recordsArray)};
      const map = L.map('map').setView([20, 0], 2);
      L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { attribution: '© Google Maps', subdomains: ['0', '1', '2', '3'], maxZoom: 18 }).addTo(map);
      const tbody = document.getElementById('table-body');
      if(records.length === 0) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">暂无记录</td></tr>';
      records.forEach(r => {
        if(r.lat && r.lon) { L.marker([r.lat, r.lon]).addTo(map).bindPopup('<b>IP: ' + r.ip + '</b><br>' + r.city + ', ' + r.country + '<br>访问次数: ' + r.count); }
        const date = new Date(r.lastVisit);
        const tr = document.createElement('tr');
        tr.innerHTML = \`<td>\${r.ip}</td><td>\${r.city || '未知'}, \${r.country || '未知'}</td><td><b style="color:#4facfe;">\${r.count}</b></td><td>\${date.toLocaleString('zh-CN', {hour12: false})}</td>\`;
        tbody.appendChild(tr);
      });
    </script>
  </body>
  </html>`;
  return new Response(html, { headers: { "content-type": "text/html;charset=UTF-8" } });
}
