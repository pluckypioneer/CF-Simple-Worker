export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const HOME_PATH = "/home";
    const BATCH_PATH = HOME_PATH + "/batch";

    // ==========================================
    // 1. 主页面 (原页面)
    // ==========================================
    if (url.pathname === HOME_PATH) {
      const cf = request.cf || {};
      const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Real-IP") || "未知";
      const lat = cf.latitude || 0;
      const lon = cf.longitude || 0;
      const asnOrg = cf.asOrganization || "";

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
            font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
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
            margin: 20px 0;
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
            text-align: center;
          }
          .ip-badge:hover { transform: scale(1.05); background: var(--accent-green); color: white;}
          .map-container { width: 100%; height: 100%; min-height: 420px; border-radius: 20px; overflow: hidden; border: 1px solid var(--glass-border); box-shadow: 0 10px 20px rgba(0,0,0,0.2); }
          #map { width: 100%; height: 100%; }
          .ua-section { grid-column: 1 / -1; margin-top: 20px; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 10px; font-size: 0.85em; color: #aaa; word-break: break-all; }
          .btn-batch { grid-column: 1 / -1; margin-top: 10px; justify-self: center; padding: 12px; font-size: 1.1em; background: linear-gradient(135deg, #4facfe, #00f2fe); }
          @media (max-width: 992px) { .content-grid { grid-template-columns: 1fr; } .map-container { min-height: 300px; } }
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
              <strong>User Agent:</strong><br>${request.headers.get("User-Agent")}
            </div>
            <a href="${BATCH_PATH}" class="ip-badge btn-batch">🚀 批量 IP 归属地查询工具</a>
          </div>
        </div>
        <script>
          $(document).ready(function() { try { $('body').ripples({ resolution: 512, dropRadius: 20, perturbance: 0.05 }); } catch (e) {} });
          const isChina = '${cf.country}' === 'CN';
          const map = L.map('map').setView([${lat}, ${lon}], 11);
          if (isChina) { 
            L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', { attribution: '© 高德地图', subdomains: ['1', '2', '3', '4'], maxZoom: 18 }).addTo(map); 
          } else { 
            L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { attribution: '© Google Maps', subdomains: ['0', '1', '2', '3'], maxZoom: 20 }).addTo(map); 
          }
          L.marker([${lat}, ${lon}]).addTo(map).bindPopup('<b>你的位置</b>').openPopup();
          function copyIP(el) { const text = el.innerText; navigator.clipboard.writeText(text).then(() => { el.innerText = "COPIED! ✨"; setTimeout(() => { el.innerText = text; }, 1500); }); }
        </script>
      </body>
      </html> 
      `;
      return new Response(body, { headers: { "content-type": "text/html;charset=UTF-8" } });
    }

    // ==========================================
    // 2. 批量查询子页面 (纯前端直连版)
    // ==========================================
    if (url.pathname === BATCH_PATH) {
      const batchBody = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset='UTF-8'>
        <meta name='viewport' content='width=device-width, initial-scale=1'>
        <title>NETWORK LOCATOR</title>
        <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery.ripples/0.5.3/jquery.ripples.min.js"></script>
        <style>
          :root {
            --glass-bg: rgba(255, 255, 255, 0.12);
            --glass-border: rgba(255, 255, 255, 0.2);
            --text-main: #ffffff;
            --accent-blue: #4facfe;
            --accent-green: #00f2fe;
          }
          body { 
            margin: 0; padding: 0;
            font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
            background-image: url('https://tc.john-life.sbs/api/rfile/girlpuppy.jpg');
            background-repeat: no-repeat; background-position: center center;
            background-attachment: fixed; background-size: cover;
            display: flex; justify-content: center; align-items: flex-start;
            min-height: 100vh; color: var(--text-main);
          }
          .overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.2); z-index: 1; pointer-events: none; }
          .container { 
            position: relative; z-index: 2; width: 90%; max-width: 900px; margin-top: 50px; margin-bottom: 50px;
            background: var(--glass-bg); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            border: 1px solid var(--glass-border); border-radius: 25px; padding: 40px;
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5); animation: fadeIn 0.8s ease-out;
          }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          h1 { text-align: center; font-weight: 600; font-size: 2em; margin-top: 0; margin-bottom: 20px; }
          .back-link { display: inline-block; margin-bottom: 20px; color: var(--accent-green); text-decoration: none; font-weight: bold; }
          textarea {
            width: 100%; height: 150px; background: rgba(0,0,0,0.4); border: 1px solid var(--glass-border);
            color: #fff; padding: 15px; border-radius: 12px; font-family: monospace; font-size: 14px;
            box-sizing: border-box; resize: vertical; outline: none; line-height: 1.5;
          }
          textarea::placeholder { color: #aaa; }
          .btn-container { display: flex; gap: 15px; margin-top: 15px; }
          .btn-run {
            flex: 1; background: linear-gradient(135deg, var(--accent-blue), var(--accent-green)); 
            color: white; border: none; padding: 12px 25px; border-radius: 8px; cursor: pointer; 
            font-weight: bold; font-size: 1.1em; transition: 0.3s; box-shadow: 0 4px 15px rgba(79, 172, 254, 0.4);
          }
          .btn-run:hover { transform: translateY(-2px); }
          .btn-run:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
          .btn-copy { background: linear-gradient(135deg, #2ecc71, #27ae60); box-shadow: 0 4px 15px rgba(46, 204, 113, 0.4); }
          
          table { width: 100%; border-collapse: collapse; margin-top: 30px; font-size: 0.95em; }
          table th { text-align: left; padding: 12px; border-bottom: 2px solid var(--accent-blue); color: var(--accent-green); }
          table td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); word-break: break-all; }
          .status-waiting { color: #aaa; }
          .status-fetching { color: #f39c12; }
          .status-done { color: #2ecc71; }
          .status-error { color: #e74c3c; }
        </style>
      </head>
      <body>
        <div class="overlay"></div>
        <div class="container">
          <a href="${HOME_PATH}" class="back-link">← 返回主页</a>
          <h1>NETWORK LOCATOR</h1>
          <p style="color: #ddd; font-size: 0.9em;">基于 <b>ipapi.is</b> 数据库，批量IP地址查询</p>
          <textarea id="ipList" placeholder="1.1.1.1:443#原节点名称&#10;8.8.8.8#Google&#10;223.5.5.5:80"></textarea>
          
          <div class="btn-container">
            <button class="btn-run" id="startBtn" onclick="startBatch()">开始批量查询</button>
            <button class="btn-run btn-copy" id="copyBtn" onclick="copyResults()" style="display: none;">一键复制修正IP</button>
          </div>
          
          <table id="resultTable" style="display:none;">
            <thead>
              <tr>
                <th style="width: 20%;">IP</th>
                <th style="width: 15%;">端口</th>
                <th style="width: 25%;">备注归属地</th>
                <th style="width: 40%;">Real IP Location</th>
              </tr>
            </thead>
            <tbody id="resultBody"></tbody>
          </table>
        </div>

        <script>
          $(document).ready(function() { try { $('body').ripples({ resolution: 512, dropRadius: 20, perturbance: 0.05 }); } catch (e) {} });

          let originalLines = [];
          let finalResults = [];

          async function startBatch() {
            const input = document.getElementById('ipList').value;
            const lines = input.split('\\n').map(l => l.trim()).filter(l => l);
            if (lines.length === 0) return alert('请输入至少一个 IP');

            originalLines = lines;
            finalResults = new Array(lines.length).fill('');
            
            const btn = document.getElementById('startBtn');
            const copyBtn = document.getElementById('copyBtn');
            const tbody = document.getElementById('resultBody');
            
            document.getElementById('resultTable').style.display = 'table';
            tbody.innerHTML = '';
            btn.disabled = true;
            btn.innerText = '查询中，请稍候...';
            copyBtn.style.display = 'none';

            let tasks = [];

            for (let i = 0; i < lines.length; i++) {
              let line = lines[i];
              let ip = "", port = "", note = "";
              
              if (line.includes('#')) {
                const parts = line.split('#');
                note = parts.pop();
                line = parts.join('#'); 
              }
              
              const lastColon = line.lastIndexOf(':');
              if (lastColon !== -1 && !line.includes(']')) {
                ip = line.substring(0, lastColon);
                port = line.substring(lastColon + 1);
              } else {
                ip = line;
              }

              ip = ip.replace(/[\\[\\]]/g, '').trim(); 
              
              const rowId = 'res-' + i;
              const tr = document.createElement('tr');
              tr.innerHTML = \`
                <td>\${ip}</td>
                <td>\${port || '-'}</td>
                <td style="color: #aaa;">\${note || '-'}</td>
                <td class="status-waiting" id="\${rowId}">等待查询...</td>
              \`;
              tbody.appendChild(tr);

              if (ip) {
                // 延迟并发：稍微错开请求，确保 API 不触发限流
                tasks.push(new Promise(resolve => setTimeout(() => resolve(fetchGeo(ip, port, rowId, i)), i * 150)));
              } else {
                document.getElementById(rowId).className = "status-error";
                document.getElementById(rowId).innerText = "格式错误";
                finalResults[i] = originalLines[i]; 
              }
            }

            await Promise.allSettled(tasks);
            
            btn.disabled = false;
            btn.innerText = '重新批量查询';
            copyBtn.style.display = 'block';
          }

          async function fetchGeo(ip, port, elementId, index) {
            const el = document.getElementById(elementId);
            el.className = "status-fetching";
            el.innerText = "请求中...";
            
            try {
              // 1. 纯前端直连调用 ipapi.is
              const res = await fetch(\`https://api.ipapi.is/?q=\${ip}\`);
              if (!res.ok) throw new Error('API Rate Limit');
              const data = await res.json();
              
              // 2. 如果没有位置信息，直接按查询失败处理
              if (!data.location) {
                throw new Error('无效IP');
              }
              
              el.className = "status-done";
              
              // 3. 提取国家数据
              const countryCode = data.location.country_code || '未知';
              const countryName = data.location.country || ''; 
              
              // 4. 用连字符拼接 州-市 (利用 filter 自动去除空值，完美规避多余横杠和空格)
              const loc = [data.location.state, data.location.city].filter(Boolean).join('-');
              
              // 5. 提取机房信息并进行 Google 安全判定
              let orgName = data.company && data.company.name ? data.company.name : '';
              
              // 安全防错操作符(?.): 防止获取不到运营商时产生报错
              const isGoogle = 
                orgName.toLowerCase().includes('google') || 
                (data.asn?.org?.toLowerCase().includes('google')) || 
                (data.company?.domain === 'google.com');

              if (isGoogle) {
                orgName = "⭐ Google专属节点";
              }
              const org = orgName ? \` (\${orgName})\` : '';

              // 6. 【给网页看的】：国家码 州-市 (公司)
              const displayNote = \`\${countryCode} \${loc}\${org}\`.trim();
              el.innerText = displayNote || "未匹配到具体位置";

              // 7. 【给一键复制用的】：国家码 国家名称
              const copyNote = \`\${countryCode} \${countryName}\`.trim();

              // 8. 组装最终结果存入数组
              let finalStr = ip;
              if (port) finalStr += ':' + port;
              finalStr += '#' + copyNote; 
              
              finalResults[index] = finalStr;

            } catch(e) {
              // 哪怕遭遇任何网络问题或格式异常，都会静默处理，绝不让整个页面崩溃
              el.className = "status-error";
              el.innerText = "查询失败或无效IP";
              finalResults[index] = originalLines[index];
            }
          }

          function copyResults() {
            const textToCopy = finalResults.join('\\n');
            navigator.clipboard.writeText(textToCopy).then(() => {
              const btn = document.getElementById('copyBtn');
              const originalText = btn.innerText;
              btn.innerText = '✅ 复制成功！';
              btn.style.background = 'linear-gradient(135deg, #f39c12, #e67e22)'; 
              setTimeout(() => { 
                btn.innerText = originalText; 
                btn.style.background = 'linear-gradient(135deg, #2ecc71, #27ae60)'; 
              }, 2000);
            }).catch(err => {
              alert('复制失败，请检查浏览器剪贴板权限');
            });
          }
        </script>
      </body>
      </html>
      `;
      return new Response(batchBody, { headers: { "content-type": "text/html;charset=UTF-8" } });
    }

    // ==========================================
    // 3. 其他路径返回 404
    // ==========================================
    return new Response("Not Found", { status: 404 });
  }
};
