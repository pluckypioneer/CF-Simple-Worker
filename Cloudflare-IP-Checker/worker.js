//简单版本，只提供查看IP的简单功能
export default {
  async fetch(request) {
    const cf = request.cf;
    const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Real-IP") || "未知";
    const lat = cf.latitude || 0;
    const lon = cf.longitude || 0;
    const asnOrg = cf.asOrganization || "";

    // 后端预判 IP 类型（机房/住宅）
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
          /* 重要：水波纹需要背景图在同一个元素上 */
          background-image: url('https://tc.john-life.sbs/api/rfile/girlpuppy.jpg');
          background-repeat: no-repeat;
          background-position: center center;
          background-attachment: fixed;
          background-size: cover;
          display: flex; justify-content: center; align-items: center;
          min-height: 100vh; color: var(--text-main);
          overflow-x: hidden;
        }

        .overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.2); z-index: 1;
          pointer-events: none; /* 确保点击能穿透到 body 触发水波纹 */
        }

        .container { 
          position: relative; z-index: 2;
          width: 90%; max-width: 1100px;
          background: var(--glass-bg);
          backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
          border: 1px solid var(--glass-border);
          border-radius: 25px; padding: 40px;
          box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5);
          animation: fadeIn 0.8s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        h1 { 
          text-align: center; font-weight: 600; font-size: 2.5em;
          margin-top: 0; margin-bottom: 35px; letter-spacing: 2px;
          background: linear-gradient(to right, #ffffff, #4facfe);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }

        .content-grid {
          display: grid; 
          grid-template-columns: 1.2fr 1fr;
          gap: 30px;
          align-items: start;
        }

        table { width: 100%; border-collapse: collapse; }
        table td { 
          padding: 14px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);
          font-size: 1em;
        }
        .label { 
          font-weight: bold; width: 32%; color: var(--text-dim); 
          font-size: 0.85em; text-transform: uppercase;
        }

        .ip-badge {
          background: var(--accent-blue); padding: 4px 12px;
          border-radius: 8px; cursor: pointer; transition: all 0.3s;
          display: inline-block; font-weight: bold;
          box-shadow: 0 4px 15px rgba(79, 172, 254, 0.4);
        }
        .ip-badge:hover { transform: scale(1.05); background: var(--accent-green); }

        .map-container {
          width: 100%; height: 100%; min-height: 420px;
          border-radius: 20px; overflow: hidden;
          border: 1px solid var(--glass-border);
          box-shadow: 0 10px 20px rgba(0,0,0,0.2);
        }

        #map {
          width: 100%; height: 100%;
        }

        .ua-section {
          grid-column: 1 / -1;
          margin-top: 20px; padding: 15px;
          background: rgba(0,0,0,0.2); border-radius: 10px;
          font-size: 0.85em; color: #aaa; word-break: break-all;
        }

        @media (max-width: 992px) {
          .content-grid { grid-template-columns: 1fr; }
          .container { padding: 30px; }
          h1 { font-size: 2em; }
          .map-container { min-height: 300px; }
        }

        @media (max-width: 768px) {
          .container { padding: 25px; width: 95%; }
          h1 { font-size: 1.8em; }
          table td { padding: 12px 10px; font-size: 0.95em; }
        }
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
              <tr><td class="label">所在地(CITY)</td><td>${cf.city || 'Unknown'}, ${cf.region || ''}, ${cf.country}</td></tr>
              <tr><td class="label">运营商 (ASN)</td><td>AS${cf.asn} - ${asnOrg}</td></tr>
              <tr><td class="label">数据中心</td><td>${cf.colo} Node</td></tr>
              <tr><td class="label">IP 类型</td><td>${ipTypeTag}</td></tr>
              <tr><td class="label">地理坐标</td><td>${lat}, ${lon}</td></tr>
              <tr><td class="label">时区</td><td>${cf.timezone} —— ${new Date().toLocaleString('zh-CN', {timeZone: cf.timezone, hour12: false, hour: '2-digit', minute: '2-digit'})}</td></tr>
            </table>
          </div>

          <div class="map-container">
            <div id="map"></div>
          </div>

          <div class="ua-section">
            <strong>User Agent:</strong><br>${request.headers.get("User-Agent")}
          </div>
        </div>
      </div>

      <script>
        // 初始化水波纹效果
        $(document).ready(function() {
          try {
            $('body').ripples({
              resolution: 512, // 分辨率，越高越细腻
              dropRadius: 20, // 涟漪半径
              perturbance: 0.05, // 扰动系数
            });
          } catch (e) {
            console.error('水波纹初始化失败', e);
          }
        });

        // 根据 IP 所在国家选择地图服务
        const isChina = '${cf.country}' === 'CN';
        
        // 初始化地图
        const map = L.map('map').setView([${lat}, ${lon}], 11);
        
        if (isChina) {
          L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
            attribution: '© 高德地图',
            subdomains: ['1', '2', '3', '4'],
            maxZoom: 18
          }).addTo(map);
        } else {
          L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
            attribution: '© Google Maps',
            subdomains: ['0', '1', '2', '3'],
            maxZoom: 20
          }).addTo(map);
        }

        const customIcon = L.divIcon({
          className: 'custom-marker',
          html: '<div style="background: #4facfe; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });

        L.marker([${lat}, ${lon}], {icon: customIcon}).addTo(map)
          .bindPopup('<b>你的位置</b><br>${cf.city || 'Unknown'}')
          .openPopup();

        function copyIP(el) {
          const text = el.innerText;
          navigator.clipboard.writeText(text).then(() => {
            el.innerText = "COPIED! ✨";
            setTimeout(() => { el.innerText = text; }, 1500);
          });
        }
      </script>
    </body>
    </html> 
    `;
    
    return new Response(body, {
      headers: { "content-type": "text/html;charset=UTF-8" },
    });
  },
};
