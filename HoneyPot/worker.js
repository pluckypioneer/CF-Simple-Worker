export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const ip = request.headers.get('cf-connecting-ip') || '127.0.0.1';
    const SECRET_UUID = "bd825053-c4e5-4543-849b-9ad5d6f1883f";

    // --- 1. 黑名单全局拦截 ---
    const isBlocked = await env.HONEYPOT_KV.get(`block:${ip}`);
    // 如果在黑名单且不是访问管理路径，直接拒绝
    if (isBlocked && !path.includes(SECRET_UUID)) {
      return new Response(generateTrollPage(ip, true), {
        status: 403,
        headers: { 'content-type': 'text/html;charset=UTF-8' }
      });
    }

    // --- 2. 鉴权辅助函数 ---
    const authenticate = (r) => {
      const auth = r.headers.get('Authorization');
      if (!auth) return false;
      try {
        const [u, p] = atob(auth.split(' ')[1] || "").split(':');
        return u === 'admin' && p === env.ADMIN_PASSWORD;
      } catch (e) { return false; }
    };

    // --- 3. 路由：管理面板 ---
    if (path === `/${SECRET_UUID}`) {
      if (!authenticate(request)) {
        return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="JZ Admin"' } });
      }
      return new Response(generateDashboard(SECRET_UUID), { headers: { "content-type": "text/html;charset=UTF-8" } });
    }

    // --- 4. 路由：API 获取攻击列表 ---
    if (path === `/${SECRET_UUID}/api/get-attacks`) {
      if (!authenticate(request)) return new Response('Forbidden', { status: 403 });
      const list = await env.HONEYPOT_KV.list({ prefix: "attack:" });
      const attacks = [];
      for (const item of list.keys) {
        const val = await env.HONEYPOT_KV.get(item.name);
        if (val) {
          let data = JSON.parse(val);
          data.kv_key = item.name;
          attacks.push(data);
        }
      }
      attacks.sort((a, b) => new Date(b.time) - new Date(a.time));
      return new Response(JSON.stringify(attacks), { headers: { "content-type": "application/json" } });
    }

    // --- 5. 路由：API 删除/释放 IP ---
    if (path === `/${SECRET_UUID}/api/delete-attack` && request.method === "POST") {
      if (!authenticate(request)) return new Response('Forbidden', { status: 403 });
      const { key } = await request.json();
      await env.HONEYPOT_KV.delete(key);
      // 从 key 中提取 IP 并解除黑名单
      const ipToUnblock = key.split(':')[1];
      await env.HONEYPOT_KV.delete(`block:${ipToUnblock}`);
      return new Response(JSON.stringify({ success: true }));
    }

    // --- 6. 蜜罐诱捕逻辑 ---
    const traps = ['/admin', '/wp-admin', '/.env', '/config.php', '/backup', '/.git', '/dashboard', '/shell', '/sql'];
    if (traps.some(trap => path.toLowerCase().startsWith(trap))) {
      const country = request.cf.country || 'UN';
      const city = request.cf.city || 'Unknown';
      const timestamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
      
      const attackerInfo = {
        ip,
        location: `${country}-${city}`,
        path,
        time: timestamp,
        lat: request.cf.latitude,
        lon: request.cf.longitude,
        ua: request.headers.get('user-agent') || 'Unknown'
      };

      // 永久记录日志和黑名单
      ctx.waitUntil(env.HONEYPOT_KV.put(`attack:${ip}:${Date.now()}`, JSON.stringify(attackerInfo)));
      ctx.waitUntil(env.HONEYPOT_KV.put(`block:${ip}`, "true"));
      
      // 发送 Telegram 通知
      if (env.TG_TOKEN && env.TG_CHAT_ID) {
        ctx.waitUntil(sendToTelegram(env, attackerInfo));
      }

      return new Response(generateTrollPage(ip, false), {
        status: 403,
        headers: { 'content-type': 'text/html;charset=UTF-8' }
      });
    }

    // --- 7. 正常放行 ---
    return new Response('<h1>JZ Space</h1><p>Secure connection established.</p>', {
      headers: { "content-type": "text/html;charset=UTF-8" }
    });
  }
};

// --- Telegram 发送函数 (修复版) ---
async function sendToTelegram(env, info) {
  // 使用 HTML 模式，避免 Markdown 字符转义失败
  const message = `
<b>🚨 JZ-蜜罐捕获警告</b>
<b>IP:</b> <code>${info.ip}</code>
<b>位置:</b> ${info.location}
<b>尝试路径:</b> <code>${info.path}</code>
<b>时间:</b> ${info.time}
<b>设备:</b> ${info.ua.substring(0, 100)}...
  `;

  const url = `https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`;
  
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: env.TG_CHAT_ID,
      text: message,
      parse_mode: 'HTML'
    })
  });
}

// --- 嘲讽页面 ---
function generateTrollPage(ip, isAlreadyBlocked) {
  const title = isAlreadyBlocked ? "IP PERMANENTLY BANNED" : "SECURITY BREACH DETECTED";
  const detail = isAlreadyBlocked ? "您的 IP 已被加入永久黑名单。" : "非法访问已记录，正在追踪您的物理位置...";
  return `
    <html>
      <head><title>SYSTEM ERROR</title></head>
      <body style="background:#000;color:#f00;font-family:monospace;padding:50px;">
        <h1 style="border-bottom:2px solid #f00;">[!] ${title}</h1>
        <p>> SOURCE_IP: ${ip}</p>
        <p>> STATUS: <span style="color:#0f0;">${detail}</span></p>
        <br><p>> 🛡️ JZ Secure Shield Active.</p>
      </body>
    </html>`;
}

// --- 管理看板 ---
function generateDashboard(uuid) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8"><title>JZ Console</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>body{background:#020617;color:#22c55e;font-family:monospace;} #map{height:300px;border:1px solid #14532d;}</style>
  </head>
  <body class="p-4 md:p-8">
    <div class="max-w-6xl mx-auto">
      <h1 class="text-2xl font-bold mb-6 border-b border-green-900 pb-2 flex justify-between">
        <span>JZ_DEFENSE_SYSTEM</span>
        <span class="text-xs text-green-800">UUID: ${uuid}</span>
      </h1>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div class="md:col-span-2 bg-black/50 p-2 border border-green-900 rounded"><div id="map"></div></div>
        <div class="bg-black/50 p-4 border border-green-900 rounded flex flex-col items-center">
          <canvas id="countryChart"></canvas>
        </div>
      </div>
      <div class="border border-green-900 rounded overflow-hidden">
        <table class="w-full text-left text-xs">
          <thead class="bg-green-950 text-green-400 uppercase">
            <tr><th class="p-3">时间</th><th class="p-3">IP</th><th class="p-3">路径</th><th class="p-3 text-center">操作</th></tr>
          </thead>
          <tbody id="list" class="divide-y divide-green-900/30"></tbody>
        </table>
      </div>
    </div>
    <script>
      let map = L.map('map').setView([20, 0], 2);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
      let markers = L.layerGroup().addTo(map);
      let chart;

      async function loadData() {
        const r = await fetch(\`/\${location.pathname.split('/')[1]}/api/get-attacks\`);
        const data = await r.json();
        document.getElementById('list').innerHTML = data.map(a => \`
          <tr>
            <td class="p-3 opacity-60">\${a.time}</td>
            <td class="p-3">\${a.ip} <span class="text-[9px] opacity-40">(\${a.location})</span></td>
            <td class="p-3 text-red-500">\${a.path}</td>
            <td class="p-3 text-center"><button onclick="del('\${a.kv_key}')" class="text-red-800 hover:text-red-400">[RELEASE]</button></td>
          </tr>\`).join('');

        const counts = {};
        data.forEach(a => { const c = a.location.split('-')[0]; counts[c] = (counts[c] || 0) + 1; });
        if(chart) chart.destroy();
        chart = new Chart(document.getElementById('countryChart'), {
          type: 'doughnut',
          data: { labels: Object.keys(counts), datasets: [{ data: Object.values(counts), backgroundColor: ['#16a34a','#14532d','#22c55e','#86efac'], borderColor: '#020617' }] },
          options: { plugins: { legend: { labels: { color: '#22c55e' } } } }
        });

        markers.clearLayers();
        data.forEach(a => { if(a.lat && a.lon) L.circleMarker([a.lat, a.lon], {color:'#f00',radius:4}).addTo(markers); });
      }

      async function del(key) {
        if(!confirm('确定释放该 IP 吗？')) return;
        await fetch(\`/\${location.pathname.split('/')[1]}/api/delete-attack\`, { method: 'POST', body: JSON.stringify({ key }) });
        loadData();
      }
      loadData(); setInterval(loadData, 30000);
    </script>
  </body></html>`;
}
