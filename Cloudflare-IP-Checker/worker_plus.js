// ============ 共享样式（主页 / 批量查询页复用） ============ 
const SHARED_CSS = `
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
    background-image: url('https://tc.imtheo.top/api/rfile/girlpuppy.jpg');
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
    position: relative; z-index: 2; width: 90%;
    background: var(--glass-bg); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border); border-radius: 25px; padding: 40px;
    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5); animation: fadeIn 0.8s ease-out;
  }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
`;

const JSON_HEADERS = { "content-type": "application/json;charset=UTF-8" };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const HOME_PATH = "/home";
    const BATCH_PATH = HOME_PATH + "/batch";
    const API_QUERY_PATH = "/api/ipquery";

    // ==========================================
    // 0. 后端 API 代理 (彻底解决前端跨域与 403 阻断问题)
    // ==========================================
    if (url.pathname === API_QUERY_PATH) {
      const targetIp = url.searchParams.get("ip");
      if (!targetIp) return json({ status: "fail", message: "invalid ip" }, 400);

      // 主接口：ip-api.com（现已允许 IPv4 和 IPv6 共同通过）
      try {
        const apiRes = await fetch(`http://ip-api.com/json/${targetIp}?fields=status,country,countryCode,regionName,city,isp,org,as,message&lang=zh-CN`, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
        });
        if (apiRes.ok) {
          const data = await apiRes.json();
          // 只要状态是 success 就直接返回，如果因为限流报错则跳过进入备用接口
          if (data.status === 'success') return json(data);
        }
      } catch (err) {} // 主接口异常时忽略，走备用接口

      // 备用接口：ipwho.is (完美支持 IPv6)
      try {
        const backupRes = await fetch(`https://ipwho.is/${targetIp}`);
        if (backupRes.ok) {
          const b = await backupRes.json();
          if (b.success) {
            return json({
              status: "success",
              countryCode: b.country_code || "未知",
              country: b.country || "",
              regionName: b.region || "",
              city: b.city || "",
              org: b.connection?.org || b.connection?.isp || "",
              isp: b.connection?.isp || "",
              as: b.connection?.asn ? `AS${b.connection.asn}` : ""
            });
          }
        }
      } catch (err) {} // 备用接口异常时忽略，返回失败

      return json({ status: "fail" });
    }

    // ==========================================
    // 1. 主页面 (单 IP 查询与地图展示 - 恢复原状)
    // ==========================================
    if (url.pathname === HOME_PATH) {
      const cf = request.cf || {};
      const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Real-IP") || "未知";
      const lat = cf.latitude || 0;
      const lon = cf.longitude || 0;
      const asn = cf.asn || "";
      const asnOrg = cf.asOrganization || "";
      const city = cf.city || "Unknown";
      const region = cf.region || "";
      const country = cf.country || "";
      const countryCode = cf.countryCode || "";
      const timezone = cf.timezone || "UTC";

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
          ${SHARED_CSS}
          .container { max-width: 1100px; margin: 20px 0; }
          h1 { text-align: center; font-weight: 600; font-size: 2.5em; margin-top: 0; margin-bottom: 35px; letter-spacing: 2px; background: linear-gradient(to right, #ffffff, #4facfe); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
          .content-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 30px; align-items: start; }
          table { width: 100%; border-collapse: collapse; }
          table td { padding: 14px 12px; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 1em; }
          .label { font-weight: bold; width: 32%; color: var(--text-dim); font-size: 0.85em; text-transform: uppercase; }
          .ip-badge { background: var(--accent-blue); padding: 4px 12px; border-radius: 8px; cursor: pointer; transition: all 0.3s; display: inline-block; font-weight: bold; box-shadow: 0 4px 15px rgba(79, 172, 254, 0.4); text-decoration: none; color: white; text-align: center; }
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
                <tr><td class="label">所在地(CITY)</td><td>${city}, ${region}, ${country}</td></tr>
                <tr><td class="label">运营商 (ASN)</td><td>AS${asn} - ${asnOrg}</td></tr>
                <tr><td class="label">数据中心</td><td>${cf.colo || ''} Node</td></tr>
                <tr><td class="label">IP 类型</td><td>${ipTypeTag}</td></tr>
                <tr><td class="label">地理坐标</td><td>${lat}, ${lon}</td></tr>
                <tr><td class="label">时区</td><td>${timezone} —— ${new Date().toLocaleString('zh-CN', {timeZone: timezone, hour12: false, hour: '2-digit', minute: '2-digit'})}</td></tr>
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
    // 2. 批量查询子页面 (精确保留你的界面，仅替换查询排队逻辑)
    // ==========================================
    if (url.pathname === BATCH_PATH) {
      const batchBody = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset='UTF-8'>
        <meta name='viewport' content='width=device-width, initial-scale=1'>
        <title>NETWORK LOCATOR - 批量查询</title>
        <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery.ripples/0.5.3/jquery.ripples.min.js"></script>
        <style>
          ${SHARED_CSS}
          body { align-items: flex-start; }
          .container { max-width: 900px; margin-top: 50px; margin-bottom: 50px; }
          h1 { text-align: center; font-weight: 600; font-size: 2em; margin-top: 0; margin-bottom: 20px; }
          .back-link { display: inline-block; margin-bottom: 20px; color: var(--accent-green); text-decoration: none; font-weight: bold; }
          textarea { width: 100%; height: 150px; background: rgba(0,0,0,0.4); border: 1px solid var(--glass-border); color: #fff; padding: 15px; border-radius: 12px; font-family: monospace; font-size: 14px; box-sizing: border-box; resize: vertical; outline: none; line-height: 1.5; }
          textarea::placeholder { color: #aaa; }
          .btn-container { display: flex; gap: 15px; margin-top: 15px; }
          .btn-run { flex: 1; background: linear-gradient(135deg, var(--accent-blue), var(--accent-green)); color: white; border: none; padding: 12px 25px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 1.1em; transition: 0.3s; box-shadow: 0 4px 15px rgba(79, 172, 254, 0.4); }
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
          <p style="color: #ddd; font-size: 0.9em;">批量 IP 地址与节点标注归属地查询工具</p>
          <textarea id="ipList" placeholder="1.1.1.1:443#原节点名称&#10;[2606:4700:5a:9f02:bee0:da71:313c:f843]:443#IPv6节点"></textarea>
          
          <div class="btn-container">
            <button class="btn-run" id="startBtn" onclick="startBatch()">开始批量查询</button>
            <button class="btn-run btn-copy" id="copyBtn" onclick="copyResults()" style="display: none;">一键复制修正IP</button>
          </div>
          
          <table id="resultTable" style="display:none;">
            <thead>
              <tr>
                <th style="width: 25%;">IP</th>
                <th style="width: 10%;">端口</th>
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
            btn.innerText = '查询中，请耐心等待...';
            copyBtn.style.display = 'none';

            let parsedData = [];

            // 1. 遍历并解析出所有的 IP 并且创建前端表格结构
            for (let i = 0; i < lines.length; i++) {
              let line = lines[i];
              let ip = "", port = "", note = "";
              
              if (line.includes('#')) {
                const parts = line.split('#');
                note = parts.pop();
                line = parts.join('#'); 
              }
              
              // 清理某些代理软件导出带的奇怪斜杠
              line = line.replace(/\\\\:/g, ':').trim();
              
              // 精准正则匹配 IPv6:Port 或纯 IPv6
              const ipv6PortMatch = line.match(/^\\[(.*?)\\]:(\\d+)$/);
              const ipv6Match = line.match(/^\\[(.*?)\\]$/);

              if (ipv6PortMatch) {
                ip = ipv6PortMatch[1];
                port = ipv6PortMatch[2];
              } else if (ipv6Match) {
                ip = ipv6Match[1];
              } else {
                const lastColon = line.lastIndexOf(':');
                const colonCount = (line.match(/:/g) || []).length;
                if (lastColon !== -1 && colonCount === 1) {
                  ip = line.substring(0, lastColon);
                  port = line.substring(lastColon + 1);
                } else {
                  ip = line;
                }
              }

              const rowId = 'res-' + i;
              const displayIp = ip.length > 22 ? ip.substring(0, 14) + '...' + ip.substring(ip.length - 4) : ip;
              
              const tr = document.createElement('tr');
              tr.innerHTML = \`
                <td title="\${ip}">\${displayIp}</td>
                <td>\${port || '-'}</td>
                <td style="color: #aaa;">\${note || '-'}</td>
                <td class="status-waiting" id="\${rowId}">等待排队...</td>
              \`;
              tbody.appendChild(tr);

              parsedData.push({ ip, port, note, rowId, index: i });
            }

            // 2. 依次排队发送请求，每查完一个停顿 1.2 秒，完美绕开限流！
            for (let i = 0; i < parsedData.length; i++) {
              const item = parsedData[i];
              
              if (item.ip) {
                const el = document.getElementById(item.rowId);
                el.className = "status-fetching";
                el.innerText = "请求中...";
                
                await fetchGeo(item.ip, item.port, item.rowId, item.index);
                
                // 如果不是最后一个，强行等待 1.2 秒
                if (i < parsedData.length - 1) {
                  await new Promise(resolve => setTimeout(resolve, 1200));
                }
              } else {
                document.getElementById(item.rowId).className = "status-error";
                document.getElementById(item.rowId).innerText = "格式错误";
                finalResults[item.index] = originalLines[item.index];
              }
            }
            
            btn.disabled = false;
            btn.innerText = '重新批量查询';
            copyBtn.style.display = 'block';
          }

          // 发送请求的具体函数保持原样，只更新了里面的拼接逻辑
          async function fetchGeo(ip, port, elementId, index) {
            const el = document.getElementById(elementId);
            try {
              const res = await fetch(\`${API_QUERY_PATH}?ip=\${encodeURIComponent(ip)}\`);
              if (!res.ok) throw new Error('Query error');
              
              const data = await res.json();
              if (data.status !== 'success') throw new Error('IP info not found');

              el.className = "status-done";

              const countryCode = data.countryCode || '未知';
              const loc = [data.regionName, data.city].filter(Boolean).join('-');
              
              let orgName = data.org || data.isp || '';
              const fullAsn = data.as || '';
              const isGoogle = orgName.toLowerCase().includes('google') || fullAsn.toLowerCase().includes('google');

              if (isGoogle) {
                orgName = "⭐ Google专属节点";
              }
              const org = orgName ? \` (\${orgName})\` : '';

              const displayNote = \`\${countryCode} \${loc}\${org}\`.trim();
              el.innerText = displayNote || "未匹配到具体位置";

              const copyNote = \`\${countryCode} \${data.city}\`.trim();

              // 输出时若是 IPv6 需重新包上 []
              let finalStr = ip.includes(':') ? \`[\${ip}]\` : ip;
              if (port) finalStr += ':' + port;
              finalStr += '#' + copyNote; 
              
              finalResults[index] = finalStr;

            } catch(e) {
              el.className = "status-error";
              el.innerText = "查询失败或限流";
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
