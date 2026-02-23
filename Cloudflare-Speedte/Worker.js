// 配置信息
const ACCESS_PASSWORD = "1145141919810"; // 设定的密码,可自行更改
const COOKIE_NAME = "jz_auth_token";
const COOKIE_VALUE = "authorized_user_1145141919810"; // 简单的校验值

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cookieHeader = request.headers.get("Cookie") || "";
    
    // 检查是否有授权 Cookie
    const isAuthorized = cookieHeader.includes(`${COOKIE_NAME}=${COOKIE_VALUE}`);

    // 1. 处理登录逻辑 (POST 请求)
    if (url.pathname === "/login" && request.method === "POST") {
      const formData = await request.formData();
      const password = formData.get("password");

      if (password === ACCESS_PASSWORD) {
        // 验证成功：设置 Cookie 并跳转到主页
        return new Response("验证成功，正在跳转...", {
          status: 302,
          headers: {
            "Location": "/",
            "Set-Cookie": `${COOKIE_NAME}=${COOKIE_VALUE}; Path=/; Max-Age=604800; SameSite=Lax` // 有效期 7 天
          }
        });
      } else {
        // 验证失败：返回带错误的登录页
        return new Response(generateLoginHTML("密码错误，请重新输入"), {
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      }
    }

    // 2. 鉴权：如果没有授权且不是访问登录页，则强制显示登录页
    if (!isAuthorized) {
      return new Response(generateLoginHTML(), {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // --- 以下为授权后的逻辑 ---

    // 测速下载接口 (同样受到鉴权保护)
    if (url.pathname === '/down') {
      const chunkSize = 1024 * 1024;
      const buffer = new Uint8Array(chunkSize).fill(1); 
      let { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      (async () => {
        try {
          for (let i = 0; i < 500; i++) {
            await writer.ready;
            writer.write(buffer);
          }
          await writer.close();
        } catch (e) {}
      })();
      return new Response(readable, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Cache-Control': 'no-store, no-cache',
        }
      });
    }

    // 获取节点信息并返回主界面
    const colo = request.cf?.colo || 'UNK';
    const city = request.cf?.city || 'Anycast Node';
    const country = request.cf?.country || 'Earth';
    const ip = request.headers.get('CF-Connecting-IP') || '127.0.0.1';

    return new Response(generateHTML(city, colo, country, ip), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
};

/**
 * 登录界面 HTML
 */
function generateLoginHTML(error = "") {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>身份验证 - JZのSpeedtest</title>
    <style>
        body {
            margin: 0; height: 100vh; display: flex; justify-content: center; align-items: center;
            font-family: 'Segoe UI', sans-serif;
            background: url('https://tc.john-life.sbs/api/rfile/anime-girl-night-moon-sunrisey.jpg') no-repeat center center fixed;
            background-size: cover; color: white;
        }
        .login-card {
            width: 400px; padding: 50px; border-radius: 40px;
            background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            text-align: center; box-shadow: 0 30px 60px rgba(0,0,0,0.5);
        }
        h2 { font-weight: 200; letter-spacing: 5px; margin-bottom: 30px; }
        input {
            width: 100%; padding: 15px; margin-bottom: 20px; border-radius: 15px; border: none;
            background: rgba(255,255,255,0.1); color: white; font-size: 1.2rem; text-align: center;
            outline: none; border: 1px solid rgba(255,255,255,0.1); box-sizing: border-box;
        }
        input:focus { border-color: #66ccff; }
        button {
            width: 100%; padding: 15px; border-radius: 50px; border: none;
            background: linear-gradient(135deg, #66ccff 0%, #0070f3 100%);
            color: white; font-weight: bold; cursor: pointer; font-size: 1.1rem;
        }
        .error { color: #ff5555; margin-bottom: 15px; font-size: 0.9rem; }
    </style>
</head>
<body>
    <div class="login-card">
        <h2>JZの<b>AUTH</b></h2>
        <form action="/login" method="POST">
            ${error ? `<div class="error">${error}</div>` : ''}
            <input type="password" name="password" placeholder="请输入访问密码" required autofocus>
            <button type="submit">解锁时空门</button>
        </form>
    </div>
</body>
</html>`;
}

/**
 * 主界面 HTML (包含 3D 翻转、历史记录和多线程逻辑)
 */
function generateHTML(city, colo, country, ip) {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JZのSpeedtest</title>
    <link rel="icon" href="https://tc.john-life.sbs/api/rfile/sr.ico" type="image/x-icon">
    <style>
        :root { --primary: #66ccff; --glass: rgba(0, 0, 0, 0.35); }
        body {
            margin: 0; height: 100vh; display: flex; justify-content: center; align-items: center;
            font-family: 'Segoe UI', system-ui, sans-serif;
            background: url('https://tc.john-life.sbs/api/rfile/anime-girl-night-moon-sunrisey.jpg') no-repeat center center fixed;
            background-size: cover; color: white; perspective: 2000px; overflow: hidden;
        }
        .book-container {
            width: 750px; height: 650px; position: relative;
            transform-style: preserve-3d; transition: transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .book-container.flipped { transform: rotateY(-180deg); }
        .card {
            position: absolute; width: 100%; height: 100%;
            backface-visibility: hidden; border-radius: 40px;
            backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.25);
            box-shadow: 0 40px 100px rgba(0,0,0,0.4);
            display: flex; flex-direction: column; padding: 50px; box-sizing: border-box;
        }
        .front { background: var(--glass); z-index: 2; }
        .back { background: rgba(10, 10, 15, 0.7); transform: rotateY(180deg); z-index: 1; }
        .brand { font-size: 1.8rem; font-weight: 200; letter-spacing: 4px; margin-bottom: 30px; }
        .brand b { font-weight: 800; color: var(--primary); }
        .server-badge { background: rgba(102, 204, 255, 0.25); color: var(--primary); padding: 8px 20px; border-radius: 20px; font-size: 0.9rem; align-self: center; border: 1px solid rgba(102, 204, 255, 0.3); }
        .speed-display-area { flex-grow: 1; display:flex; flex-direction:column; justify-content:center; align-items:center; }
        .speed-val { font-size: 7.5rem; font-weight: 900; line-height: 1; color: var(--primary); text-shadow: 0 10px 30px rgba(102, 204, 255, 0.4); }
        .rating-tag { font-size: 1.8rem; font-weight: bold; margin-top: 15px; transition: 0.3s; }
        .rating-极好 { color: #00ffcc; text-shadow: 0 0 15px #00ffcc; }
        .rating-好 { color: #66ccff; text-shadow: 0 0 15px #66ccff; }
        .rating-一般 { color: #ffcc00; text-shadow: 0 0 15px #ffcc00; }
        .rating-极差 { color: #ff5555; text-shadow: 0 0 15px #ff5555; }
        .footer-info { display: flex; justify-content: space-between; gap: 15px; margin-top: 30px; }
        .info-box { background: rgba(255,255,255,0.1); padding: 12px 20px; border-radius: 18px; flex: 1; text-align: left; }
        .info-label { font-size: 0.7rem; color: rgba(255,255,255,0.5); text-transform: uppercase; }
        .info-text { font-size: 0.95rem; font-weight: bold; margin-top: 3px; }
        button { background: linear-gradient(135deg, #66ccff 0%, #0070f3 100%); border: none; color: white; padding: 20px; border-radius: 50px; font-size: 1.3rem; font-weight: bold; cursor: pointer; transition: 0.3s; box-shadow: 0 10px 25px rgba(0, 112, 243, 0.3); margin-top: 25px; }
        button:hover { transform: translateY(-3px); box-shadow: 0 15px 35px rgba(0, 112, 243, 0.5); }
        button:disabled { background: #444; color: #888; transform: none; box-shadow: none; cursor: not-allowed; }
        .flip-link { margin-top: 20px; font-size: 0.9rem; color: rgba(255,255,255,0.4); cursor: pointer; text-decoration: underline; text-underline-offset: 4px; }
        .history-list { flex-grow: 1; overflow-y: auto; margin-top: 20px; padding-right: 10px; }
        .history-item { background: rgba(255,255,255,0.08); border-radius: 15px; padding: 15px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,0.05); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: var(--primary); border-radius: 10px; }
    </style>
</head>
<body>
<div class="book-container" id="book">
    <div class="card front">
        <div class="brand">JZの<b>Speedtest</b></div>
        <div class="server-badge">📍 ${city} (${colo})</div>
        <div class="speed-display-area">
            <div class="speed-val" id="speed">0.0</div>
            <div id="rating" class="rating-tag">Ready</div>
            <div style="opacity:0.4; margin-top:10px; letter-spacing: 2px; font-size: 0.8rem;">Mbps DOWNLOAD</div>
        </div>
        <div class="footer-info">
            <div class="info-box"><div class="info-label">Your IP</div><div class="info-text">${ip.split('.').slice(0,2).join('.')}.*.*</div></div>
            <div class="info-box"><div class="info-label">Node Info</div><div class="info-text">${country} / Edge</div></div>
        </div>
        <button id="start-btn" onclick="startTest()">开始测试</button>
        <div class="flip-link" onclick="flipCard()">查看测速历史记录 ➔</div>
    </div>
    <div class="card back">
        <div class="brand">JZの<b>History</b></div>
        <div class="history-list" id="history-list"></div>
        <button onclick="clearHistory()" style="background: rgba(255,85,85,0.15); border: 1px solid #ff5555; color: #ff5555; font-size: 1rem; padding: 10px; box-shadow: none;">清空历史记录</button>
        <div class="flip-link" onclick="flipCard()">返回测速主界面 ➔</div>
    </div>
</div>
<script>
    let totalBytes = 0; let running = false;
    const THREADS = 6; const TEST_TIME = 12000;
    function flipCard() { document.getElementById('book').classList.toggle('flipped'); if (document.getElementById('book').classList.contains('flipped')) renderHistory(); }
    function getRating(speed) { if (speed >= 100) return "极好"; if (speed >= 50) return "好"; if (speed >= 10) return "一般"; return "极差"; }
    async function startTest() {
        if (running) return; running = true;
        const btn = document.getElementById('start-btn'); const speedDisplay = document.getElementById('speed'); const ratingDisplay = document.getElementById('rating');
        btn.disabled = true; btn.innerText = "正在测速..."; totalBytes = 0;
        const startTime = performance.now(); const controllers = [];
        for (let i = 0; i < THREADS; i++) { const c = new AbortController(); controllers.push(c); downloadThread(c.signal); }
        const interval = setInterval(() => {
            const duration = (performance.now() - startTime) / 1000;
            const speed = (totalBytes * 8 / (1024 * 1024) / duration);
            speedDisplay.innerText = speed.toFixed(1);
            const r = getRating(speed); ratingDisplay.innerText = r; ratingDisplay.className = 'rating-tag rating-' + r;
            if (duration * 1000 >= TEST_TIME) { clearInterval(interval); controllers.forEach(c => c.abort()); saveResult(speed.toFixed(1), r); btn.disabled = false; btn.innerText = "Restart再次测速"; running = false; }
        }, 100);
    }
    async function downloadThread(signal) {
        try { const res = await fetch('/down?t=' + Math.random(), { signal }); const reader = res.body.getReader(); while (true) { const { done, value } = await reader.read(); if (done) break; totalBytes += value.length; } } catch (e) {}
    }
    function saveResult(speed, rating) { const history = JSON.parse(localStorage.getItem('jz_history_v2') || '[]'); history.unshift({ speed, rating, time: new Date().toLocaleString(), node: "${colo}" }); localStorage.setItem('jz_history_v2', JSON.stringify(history.slice(0, 20))); }
    function renderHistory() {
        const list = document.getElementById('history-list'); const history = JSON.parse(localStorage.getItem('jz_history_v2') || '[]');
        if (!history.length) { list.innerHTML = '<div style="margin-top:100px; opacity:0.3">暂无测试记录</div>'; return; }
        let html = ''; for (let item of history) {
            html += '<div class="history-item"><div style="text-align:left"><div style="font-weight:bold; color:var(--primary); font-size:1.2rem;">' + item.speed + ' <small>Mbps</small></div><div style="font-size:0.7rem; opacity:0.4; margin-top:3px;">' + item.time + '</div></div><div style="text-align:right"><div class="rating-tag rating-' + item.rating + '" style="font-size:0.8rem; margin:0">' + item.rating + '</div><div style="font-size:0.7rem; opacity:0.4; margin-top:3px;">节点: ' + item.node + '</div></div></div>';
        }
        list.innerHTML = html;
    }
    function clearHistory() { if(confirm('确定要清空所有记录吗？')) { localStorage.removeItem('jz_history_v2'); renderHistory(); } }
</script>
</body>
</html>`;
}
