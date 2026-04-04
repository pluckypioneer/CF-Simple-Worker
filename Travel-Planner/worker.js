// ==========================================
// 1. 前端：完整的 HTML/CSS/JS 模板
// ==========================================
const HTML_TEMPLATE = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>旅行规划师 - 完美版</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
        :root {
            --primary: #3b82f6; --primary-hover: #2563eb;
            --bg: #f9fafb; --card-bg: #ffffff;
            --radius: 16px; --radius-sm: 8px;
            --text-main: #1f2937; --text-light: #6b7280;
        }
        body { 
            background-color: var(--bg); color: var(--text-main);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0; display: flex; height: 100vh; overflow: hidden;
        }
        
        #sidebar { 
            width: 380px; background: var(--card-bg); margin: 15px; 
            border-radius: var(--radius); display: flex; flex-direction: column; 
            padding: 24px; box-sizing: border-box;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);
            z-index: 1000;
        }
        
        #map { 
            flex: 1; margin: 15px 15px 15px 0; border-radius: var(--radius); 
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); z-index: 1;
        }
        
        .auth-badge {
            background: #eff6ff; padding: 10px 14px; border-radius: var(--radius);
            font-size: 13px; color: var(--primary); margin-bottom: 20px;
            display: flex; flex-direction: column; gap: 10px;
        }
        .auth-header { display: flex; justify-content: space-between; align-items: center; width: 100%; }
        .auth-actions { display: flex; gap: 8px; justify-content: flex-end; }
        
        .title-input {
            font-size: 20px; font-weight: bold; border: none; padding: 0; 
            margin-bottom: 20px; outline: none; background: transparent; width: 100%;
        }
        .btn {
            background: var(--primary); color: white; border: none;
            padding: 12px; border-radius: var(--radius-sm); font-weight: 500;
            cursor: pointer; transition: 0.2s; text-align: center; font-size: 14px;
        }
        .btn:hover { background: var(--primary-hover); transform: translateY(-1px); }
        .btn-small { padding: 6px 12px; font-size: 12px; border-radius: 20px; }
        .btn-outline { background: transparent; color: var(--primary); border: 1px solid var(--primary); }
        
        .point-item {
            background: #fff; border: 1px solid #e5e7eb; border-radius: var(--radius-sm);
            padding: 12px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;
        }
        .point-info h4 { margin: 0 0 4px 0; font-size: 15px; }
        .point-info p { margin: 0; font-size: 12px; color: var(--text-light); }
        .point-actions button {
            background: #f3f4f6; border: none; width: 28px; height: 28px;
            border-radius: 6px; cursor: pointer; margin-left: 4px; color: var(--text-light);
        }
        
        .leaflet-popup-content-wrapper { border-radius: var(--radius) !important; }
        .popup-form { display: flex; flex-direction: column; gap: 8px; width: 220px; }
        .popup-form input, .popup-form select, .popup-form textarea {
            border: 1px solid #d1d5db; border-radius: 6px; padding: 8px; font-size: 13px; outline: none;
        }
        
        /* 模态框通用样式 */
        .modal-overlay {
            display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.4); z-index: 2000; justify-content: center; align-items: center;
        }
        .modal-card {
            background: white; padding: 30px; border-radius: var(--radius); width: 350px; 
            max-height: 80vh; display: flex; flex-direction: column; gap: 15px; box-sizing: border-box;
        }
        .history-item {
            padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; transition: 0.2s;
            display: flex; justify-content: space-between; align-items: center;
        }
        .history-item:hover { border-color: var(--primary); background: #eff6ff; }
        .history-item-content { flex: 1; cursor: pointer; }
        .history-item h4 { margin: 0 0 5px 0; font-size: 14px; color: var(--text-main); }
        .history-item p { margin: 0; font-size: 11px; color: var(--text-light); }
        .del-btn { background: none; border: none; color: #ef4444; font-size: 12px; cursor: pointer; padding: 8px; border-radius: 4px; }
        .del-btn:hover { background: #fee2e2; }
    </style>
</head>
<body>
    <div id="sidebar">
        <div class="auth-badge" id="user-status">
            <div class="auth-header">
                <span id="user-text">游客模式 (不保存)</span>
                <button class="btn btn-small" onclick="document.getElementById('auth-modal').style.display='flex'">登录/注册</button>
            </div>
        </div>
        
        <input type="text" id="plan-title" class="title-input" placeholder="输入规划名称..." value="我的旅行规划">
        
        <div id="route-list" style="flex: 1; overflow-y: auto; margin-bottom: 20px;">
            <div style="text-align: center; color: var(--text-light); margin-top: 50px; font-size: 14px;">点击地图添加景点</div>
        </div>

        <div style="display: flex; gap: 10px;">
            <button class="btn" id="save-btn" style="flex: 2;" onclick="saveToCloud()">云端保存</button>
            <button class="btn btn-outline" style="flex: 1;" onclick="exportMD()">导出MD</button>
        </div>
    </div>

    <div id="map"></div>

    <div id="auth-modal" class="modal-overlay">
        <div class="modal-card">
            <h3 style="margin:0;">用户登录 / 注册</h3>
            <input type="text" id="auth-username" placeholder="用户名" style="padding:10px; border:1px solid #ccc; border-radius:6px;">
            <input type="password" id="auth-password" placeholder="密码" style="padding:10px; border:1px solid #ccc; border-radius:6px;">
            <button class="btn" onclick="handleAuth('login')">登录</button>
            <button class="btn btn-outline" onclick="handleAuth('register')">注册</button>
            <button class="btn btn-outline" style="border:none; color:#9ca3af;" onclick="document.getElementById('auth-modal').style.display='none'">取消</button>
        </div>
    </div>

    <div id="history-modal" class="modal-overlay">
        <div class="modal-card" style="width: 450px;">
            <div style="display:flex; justify-content: space-between; align-items: center;">
                <h3 style="margin:0;">我的云端计划</h3>
                <button onclick="document.getElementById('history-modal').style.display='none'" style="border:none;background:none;cursor:pointer;font-size:20px;color:#9ca3af;">&times;</button>
            </div>
            <div id="history-list" style="overflow-y: auto; display: flex; flex-direction: column; gap: 10px; margin-top: 10px;">
                </div>
        </div>
    </div>

    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
        // 核心状态
        let currentUser = null; 
        let currentPlanId = null; 
        let waypoints = [];     
        let markers = [];       
        
        // 初始化地图
        const map = L.map('map').setView([39.9042, 116.4074], 10);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        const polyline = L.polyline([], {color: '#3b82f6', weight: 4, opacity: 0.7}).addTo(map);
        let tempMarker = null;

        map.on('click', function(e) {
            if (tempMarker) map.removeLayer(tempMarker);
            const { lat, lng } = e.latlng;
            tempMarker = L.marker([lat, lng]).addTo(map);

            const popupHtml = \`
                <div class="popup-form">
                    <h4 style="margin:0 0 5px 0;">添加新地点</h4>
                    <input type="text" id="p-name" placeholder="地点名称">
                    <input type="time" id="p-arrive">
                    <input type="text" id="p-duration" placeholder="游览时长">
                    <input type="number" id="p-cost" placeholder="费用 (默认免费)">
                    <select id="p-transport"><option>步行</option><option>公交/地铁</option><option>打车/自驾</option></select>
                    <textarea id="p-details" placeholder="游览细节...(选填)" rows="2"></textarea>
                    <button class="btn" onclick="addPoint(\${lat}, \${lng})">确认添加</button>
                </div>
            \`;
            tempMarker.bindPopup(popupHtml).openPopup();
        });

        window.addPoint = function(lat, lng) {
            waypoints.push({
                id: Date.now(), lat, lng,
                name: document.getElementById('p-name').value || '未命名地点',
                arriveTime: document.getElementById('p-arrive').value || '--:--',
                duration: document.getElementById('p-duration').value || '未定',
                cost: document.getElementById('p-cost').value || '0',
                transport: document.getElementById('p-transport').value,
                details: document.getElementById('p-details').value
            });
            if (tempMarker) map.removeLayer(tempMarker);
            renderRoute();
        };

        function renderRoute() {
            markers.forEach(m => map.removeLayer(m));
            markers = [];
            const listDiv = document.getElementById('route-list');
            listDiv.innerHTML = '';
            let latlngs = [];

            waypoints.forEach((p, i) => {
                latlngs.push([p.lat, p.lng]);
                const iconHtml = \`<div style="background:#3b82f6;color:white;border-radius:50%;width:24px;height:24px;text-align:center;line-height:24px;font-weight:bold;box-shadow:0 2px 4px rgba(0,0,0,0.2);">\${i + 1}</div>\`;
                const customIcon = L.divIcon({ html: iconHtml, className: '', iconSize: [24, 24], iconAnchor: [12, 12] });
                let m = L.marker([p.lat, p.lng], {icon: customIcon}).addTo(map).bindTooltip(p.name);
                markers.push(m);

                listDiv.innerHTML += \`
                    <div class="point-item">
                        <div class="point-info"><h4>\${i + 1}. \${p.name}</h4><p>\${p.arriveTime} | \${p.transport}</p></div>
                        <div class="point-actions">
                            <button onclick="movePoint(\${i}, -1)">↑</button>
                            <button onclick="movePoint(\${i}, 1)">↓</button>
                            <button onclick="removePoint(\${i})" style="color:#ef4444;">×</button>
                        </div>
                    </div>
                \`;
            });
            if(waypoints.length === 0) listDiv.innerHTML = '<div style="text-align:center;color:gray;margin-top:50px;">点击地图添加景点</div>';
            polyline.setLatLngs(latlngs);
            
            if(latlngs.length > 0) map.fitBounds(L.polyline(latlngs).getBounds(), {padding: [50, 50], maxZoom: 14});
        }

        window.movePoint = function(idx, dir) {
            if (idx + dir < 0 || idx + dir >= waypoints.length) return;
            [waypoints[idx], waypoints[idx + dir]] = [waypoints[idx + dir], waypoints[idx]];
            renderRoute();
        };
        window.removePoint = function(idx) { waypoints.splice(idx, 1); renderRoute(); };

        // ==========================================
        // 账户与 API 交互逻辑
        // ==========================================
        window.handleAuth = async function(type) {
            const u = document.getElementById('auth-username').value;
            const p = document.getElementById('auth-password').value;
            if(!u || !p) return alert('请输入账号密码');
            try {
                const res = await fetch('/api/auth/' + type, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({username: u, password: p})
                });
                const data = await res.json();
                if (data.success) {
                    currentUser = data.user;
                    document.getElementById('auth-modal').style.display = 'none';
                    updateAuthUI();
                } else alert('失败: ' + data.error);
            } catch (e) { alert('请求错误'); }
        };

        window.logout = function() {
            currentUser = null; currentPlanId = null; waypoints = [];
            document.getElementById('plan-title').value = '我的旅行规划';
            renderRoute(); updateAuthUI();
        };

        window.createNewPlan = function() {
            if(waypoints.length > 0 && !confirm("新建计划将清空当前界面，确认继续吗？")) return;
            currentPlanId = null; waypoints = [];
            document.getElementById('plan-title').value = '新的旅行规划';
            renderRoute();
        };

        function updateAuthUI() {
            const statusDiv = document.getElementById('user-status');
            if(currentUser) {
                // 判断是否是管理员
                const quotaText = currentUser.role === 'admin' ? '无限制' : \`\${currentUser.used_plans || 0}/\${currentUser.max_plans}\`;
                statusDiv.innerHTML = \`
                    <div class="auth-header">
                        <span style="font-weight:bold;">\${currentUser.username} (配额: \${quotaText})</span>
                    </div>
                    <div class="auth-actions">
                        <button class="btn btn-small btn-outline" style="flex:1" onclick="createNewPlan()">+ 新建</button>
                        <button class="btn btn-small btn-outline" style="flex:1" onclick="openHistory()">我的计划</button>
                        <button class="btn btn-small btn-outline" style="border:none;color:#ef4444;" onclick="logout()">退出</button>
                    </div>
                \`;
            } else {
                statusDiv.innerHTML = \`
                    <div class="auth-header">
                        <span>游客模式 (不保存)</span>
                        <button class="btn btn-small" onclick="document.getElementById('auth-modal').style.display='flex'">登录/注册</button>
                    </div>
                \`;
            }
        }

        // ==========================================
        // 计划存储、列表与删除
        // ==========================================
        window.saveToCloud = async function() {
            if (waypoints.length === 0) return alert('请先添加景点！');
            if (!currentUser) return alert('请先登录才能云端保存！');
            
            const btn = document.getElementById('save-btn');
            btn.innerText = '正在保存...';
            try {
                const res = await fetch('/api/plans/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        planId: currentPlanId,
                        title: document.getElementById('plan-title').value,
                        points: waypoints,
                        userId: currentUser.id
                    })
                });
                const data = await res.json();
                
                if (data.success) {
                    if (data.action === 'insert') {
                        currentPlanId = data.planId; 
                        currentUser.used_plans = (currentUser.used_plans || 0) + 1;
                        updateAuthUI();
                        alert('成功创建新规划！');
                    } else {
                        alert('当前规划更新成功！');
                    }
                } else alert('保存失败: ' + data.error);
            } catch (err) { alert('网络错误'); } 
            finally { btn.innerText = '云端保存'; }
        };

        window.openHistory = async function() {
            if(!currentUser) return;
            const listDiv = document.getElementById('history-list');
            listDiv.innerHTML = '<div style="text-align:center; padding: 20px;">加载中...</div>';
            document.getElementById('history-modal').style.display = 'flex';

            try {
                const res = await fetch(\`/api/plans/list?userId=\${currentUser.id}\`);
                const data = await res.json();
                if(data.success) {
                    listDiv.innerHTML = '';
                    if(data.plans.length === 0) {
                        listDiv.innerHTML = '<div style="text-align:center; color:gray;">暂无保存的计划</div>';
                        return;
                    }
                    data.plans.forEach(plan => {
                        const dateStr = new Date(plan.created_at).toLocaleString('zh-CN');
                        listDiv.innerHTML += \`
                            <div class="history-item">
                                <div class="history-item-content" onclick="loadPlan('\${plan.id}')">
                                    <h4>\${plan.title}</h4>
                                    <p>更新时间: \${dateStr}</p>
                                </div>
                                <button class="del-btn" onclick="deletePlan('\${plan.id}')">删除</button>
                            </div>
                        \`;
                    });
                }
            } catch(e) { listDiv.innerHTML = '<div style="color:red;text-align:center;">拉取失败</div>'; }
        };

        window.loadPlan = async function(id) {
            if(waypoints.length > 0 && currentPlanId !== id && !confirm("加载新计划将覆盖当前界面，确认吗？")) return;
            
            try {
                const res = await fetch(\`/api/plans/get?planId=\${id}&userId=\${currentUser.id}\`);
                const data = await res.json();
                if(data.success) {
                    currentPlanId = data.plan.id;
                    document.getElementById('plan-title').value = data.plan.title;
                    waypoints = JSON.parse(data.plan.content_json);
                    renderRoute();
                    document.getElementById('history-modal').style.display = 'none';
                } else alert('加载失败: ' + data.error);
            } catch(e) { alert('网络错误'); }
        };

        window.deletePlan = async function(id) {
            if(!confirm("确定要永久删除这份旅行规划吗？此操作无法恢复！")) return;
            
            try {
                const res = await fetch('/api/plans/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ planId: id, userId: currentUser.id })
                });
                const data = await res.json();
                
                if(data.success) {
                    // 如果删除的正是当前在编辑的规划，则重置界面
                    if(currentPlanId === id) {
                        currentPlanId = null; waypoints = [];
                        document.getElementById('plan-title').value = '我的旅行规划';
                        renderRoute();
                    }
                    // 更新额度并刷新列表
                    currentUser.used_plans = Math.max(0, (currentUser.used_plans || 1) - 1);
                    updateAuthUI();
                    openHistory();
                } else alert('删除失败: ' + data.error);
            } catch(e) { alert('网络错误'); }
        };

        // ==========================================
        // 纯文本 Markdown 导出 (已移除静态地图功能)
        // ==========================================
        window.exportMD = function() {
            if (waypoints.length === 0) return alert('请先在地图上添加景点！');

            const title = document.getElementById('plan-title').value || '旅行规划';
            let md = \`# 旅行规划书：\${title}\\n\\n\`;
            md += \`> 导出时间：\${new Date().toLocaleString('zh-CN')}\\n\\n\`;
            md += \`## 详细日程\\n\\n\`;

            waypoints.forEach((p, index) => {
                md += \`### \${index + 1}. \${p.name}\\n\`;
                md += \`- **预计到达**: \${p.arriveTime || '--:--'} | **游览**: \${p.duration || '未定'}\\n\`;
                md += \`- **交通方式**: \${p.transport || '未定'} | **费用**: \${p.cost === '0' || !p.cost ? '免费' : p.cost + ' 元'}\\n\\n\`;
                if (p.details) md += \`**游览细节**:\\n> \${p.details.replace(/\\n/g, '\\n> ')}\\n\\n\`;
                md += \`---\\n\\n\`;
            });

            const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = \`\${title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}_\${Date.now()}.md\`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
    </script>
</body>
</html>
`;

// ==========================================
// 2. 后端：API 与数据库逻辑
// ==========================================

async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const jsonResponse = (data, status = 200) => {
      return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
    };

    if (request.method === "GET" && url.pathname === "/") {
      return new Response(HTML_TEMPLATE, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    }

    if (url.pathname.startsWith("/api/")) {
      try {
        // --- 账户路由 ---
        if (request.method === "POST" && url.pathname === "/api/auth/register") {
          const { username, password } = await request.json();
          const hashedPassword = await hashPassword(password);
          const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
          if (existing) return jsonResponse({ error: "用户名已存在" }, 400);

          const result = await env.DB.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?) RETURNING id, username, role, max_plans").bind(username, hashedPassword).first();
          return jsonResponse({ success: true, user: result });
        }

        if (request.method === "POST" && url.pathname === "/api/auth/login") {
          const { username, password } = await request.json();
          const hashedPassword = await hashPassword(password);
          const user = await env.DB.prepare("SELECT id, username, role, max_plans FROM users WHERE username = ? AND password_hash = ?").bind(username, hashedPassword).first();
          
          if (!user) return jsonResponse({ error: "用户名或密码错误" }, 401);
          const countRes = await env.DB.prepare("SELECT COUNT(*) as c FROM plans WHERE user_id = ?").bind(user.id).first();
          user.used_plans = countRes.c;
          return jsonResponse({ success: true, user });
        }

        // --- 计划管理路由 ---

        if (request.method === "GET" && url.pathname === "/api/plans/list") {
            const userId = url.searchParams.get("userId");
            if (!userId) return jsonResponse({ error: "参数缺失" }, 400);
            
            const plans = await env.DB.prepare(
                "SELECT id, title, created_at FROM plans WHERE user_id = ? ORDER BY created_at DESC"
            ).bind(userId).all();
            
            return jsonResponse({ success: true, plans: plans.results });
        }

        if (request.method === "GET" && url.pathname === "/api/plans/get") {
            const planId = url.searchParams.get("planId");
            const userId = url.searchParams.get("userId"); 
            
            const plan = await env.DB.prepare(
                "SELECT id, title, content_json FROM plans WHERE id = ? AND user_id = ?"
            ).bind(planId, userId).first();
            
            if (!plan) return jsonResponse({ error: "计划不存在或无权限访问" }, 404);
            return jsonResponse({ success: true, plan });
        }

        if (request.method === "POST" && url.pathname === "/api/plans/delete") {
            const { planId, userId } = await request.json();
            if (!userId) return jsonResponse({ error: "身份验证失败" }, 401);

            const result = await env.DB.prepare("DELETE FROM plans WHERE id = ? AND user_id = ?").bind(planId, userId).run();
            if (result.meta.changes === 0) return jsonResponse({ error: "删除失败：文件不存在或无权操作" }, 403);
            
            return jsonResponse({ success: true });
        }

        if (request.method === "POST" && url.pathname === "/api/plans/save") {
          const { planId, title, points, userId } = await request.json();
          if (!userId) return jsonResponse({ error: "身份验证失败，请重新登录" }, 401);

          if (planId) {
             const result = await env.DB.prepare(
                "UPDATE plans SET title = ?, content_json = ? WHERE id = ? AND user_id = ?"
             ).bind(title, JSON.stringify(points), planId, userId).run();

             if (result.meta.changes === 0) return jsonResponse({ error: "更新失败：未找到原始文件或无权修改" }, 403);
             return jsonResponse({ success: true, action: 'update', planId });
             
          } else {
             const user = await env.DB.prepare("SELECT role, max_plans FROM users WHERE id = ?").bind(userId).first();
             
             // 如果角色不是 admin，才执行额度校验
             if (user && user.role !== 'admin') {
                 const count = await env.DB.prepare("SELECT COUNT(*) as c FROM plans WHERE user_id = ?").bind(userId).first();
                 if (count && count.c >= user.max_plans) {
                    return jsonResponse({ error: `已达到存储上限 (${user.max_plans}条)` }, 403);
                 }
             }

             const newPlanId = crypto.randomUUID();
             await env.DB.prepare(
                "INSERT INTO plans (id, user_id, title, content_json) VALUES (?, ?, ?, ?)"
             ).bind(newPlanId, userId, title, JSON.stringify(points)).run();

             return jsonResponse({ success: true, action: 'insert', planId: newPlanId });
          }
        }
      } catch (error) {
        return jsonResponse({ error: "服务器内部错误: " + error.message }, 500);
      }
      return jsonResponse({ error: "接口不存在" }, 404);
    }

    return new Response('Not Found', { status: 404 });
  }
};
