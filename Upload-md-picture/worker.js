/**
 * Cloudflare Worker: Typora R2 图床 & 可视化管理面板 (UI 重制版)
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const domain = (env.R2_DOMAIN || "").replace(/\/$/, "");

    // ==========================================
    // 1. 处理 Typora 上传 (POST /)
    // ==========================================
    if (request.method === 'POST' && url.pathname === '/') {
      if (request.headers.get('Authorization') !== `Bearer ${env.AUTH_TOKEN}`) {
        return new Response('Unauthorized', { status: 401 });
      }
      const fileName = request.headers.get('X-File-Name') || `img_${Date.now()}.png`;
      try {
        await env.MY_BUCKET.put(fileName, request.body);
        return new Response(`${domain}/${fileName}`, { status: 200 });
      } catch (error) {
        return new Response('Upload failed', { status: 500 });
      }
    }

    // ==========================================
    // 2. 网页访问保护 (Basic Auth) 
    // ==========================================
    if (request.method === 'GET' && url.pathname === '/') {
      const authHeader = request.headers.get('Authorization');
      let isWebAuthenticated = false;

      if (authHeader && authHeader.startsWith('Basic ')) {
        try {
          const credentials = atob(authHeader.split(' ')[1]);
          const [_, password] = credentials.split(':');
          if (password === env.WEB_PASSWORD) isWebAuthenticated = true;
        } catch (e) {}
      }

      if (!isWebAuthenticated) {
        return new Response('需要访问密钥', {
          status: 401,
          headers: {
            'WWW-Authenticate': 'Basic realm="R2 Admin"',
            'Content-Type': 'text/plain;charset=UTF-8'
          }
        });
      }

      // 验证通过，注入 Token 并返回精美的 HTML
      return new Response(getHTMLTemplate(domain, env.AUTH_TOKEN), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
    }

    // ==========================================
    // 3. 管理后台 API
    // ==========================================
    if (url.pathname.startsWith('/api/')) {
      if (request.headers.get('Authorization') !== `Bearer ${env.AUTH_TOKEN}`) {
        return new Response('Unauthorized API Access', { status: 401 });
      }

      if (request.method === 'GET' && url.pathname === '/api/list') {
        // 按时间倒序拉取，最新的在前面
        const listed = await env.MY_BUCKET.list({ limit: 500 });
        const objects = listed.objects.sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded));
        return new Response(JSON.stringify(objects), { headers: { 'Content-Type': 'application/json' }});
      }

      if (request.method === 'DELETE' && url.pathname === '/api/delete') {
        await env.MY_BUCKET.delete(request.headers.get('X-File-Name'));
        return new Response('Deleted', { status: 200 });
      }
    }

    // ==========================================
    // 4. 图片显示逻辑 (GET /filename.png)
    // ==========================================
    if (request.method === 'GET' && url.pathname !== '/') {
      const fileName = decodeURIComponent(url.pathname.slice(1));
      const object = await env.MY_BUCKET.get(fileName);
      if (!object) return new Response('Not Found', { status: 404 });

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      headers.set('Cache-Control', 'public, max-age=604800'); 
      headers.set('Access-Control-Allow-Origin', '*'); 
      return new Response(object.body, { headers });
    }

    return new Response('Page Not Found', { status: 404 });
  }
};

/**
 * ==========================================
 * UI 重制版 HTML 模板
 * ==========================================
 */
function getHTMLTemplate(domain, token) {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>R2 Gallery Space</title>
    <style>
        :root {
            --bg-color: #f8fafc;
            --card-bg: #ffffff;
            --text-main: #0f172a;
            --text-muted: #64748b;
            --border-color: #e2e8f0;
            --primary: #3b82f6;
            --primary-hover: #2563eb;
            --danger: #ef4444;
            --danger-hover: #dc2626;
            --radius: 12px;
            --shadow-sm: 0 1px 3px rgba(0,0,0,0.05);
            --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
            --shadow-hover: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
            --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-main);
            line-height: 1.5;
            -webkit-font-smoothing: antialiased;
        }

        /* 导航栏 - 毛玻璃效果 */
        .navbar {
            position: sticky;
            top: 0;
            z-index: 50;
            background: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-bottom: 1px solid var(--border-color);
            padding: 16px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .brand {
            font-size: 1.25rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 8px;
            letter-spacing: -0.025em;
        }

        .brand span { color: var(--text-muted); font-size: 0.875rem; font-weight: 400; }

        .btn-primary {
            background-color: var(--text-main);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            transition: var(--transition);
        }
        .btn-primary:hover { background-color: #334155; transform: translateY(-1px); }

        /* 主体布局 */
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 32px 24px;
        }

        .status-bar {
            margin-bottom: 24px;
            display: flex;
            justify-content: space-between;
            color: var(--text-muted);
            font-size: 0.875rem;
        }

        /* 照片网格 */
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
            gap: 24px;
        }

        /* 卡片设计 */
        .card {
            background: var(--card-bg);
            border-radius: var(--radius);
            overflow: hidden;
            border: 1px solid var(--border-color);
            box-shadow: var(--shadow-sm);
            transition: var(--transition);
            display: flex;
            flex-direction: column;
        }

        .card:hover {
            transform: translateY(-4px);
            box-shadow: var(--shadow-hover);
            border-color: #cbd5e1;
        }

        /* 图片容器与缩放动画 */
        .img-container {
            height: 160px;
            width: 100%;
            overflow: hidden;
            background: #f1f5f9;
            position: relative;
            cursor: pointer;
        }

        .img-container img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.5s ease;
        }

        .card:hover .img-container img {
            transform: scale(1.05);
        }

        /* 播放/加载状态占位 */
        .img-placeholder {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #94a3b8;
        }

        /* 卡片信息区 */
        .card-content {
            padding: 16px;
            display: flex;
            flex-direction: column;
            flex-grow: 1;
        }

        .file-name {
            font-size: 0.875rem;
            font-weight: 600;
            color: var(--text-main);
            margin-bottom: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .file-meta {
            font-size: 0.75rem;
            color: var(--text-muted);
            margin-bottom: 16px;
            display: flex;
            justify-content: space-between;
        }

        /* 卡片按钮组 */
        .card-actions {
            display: flex;
            gap: 8px;
            margin-top: auto;
        }

        .btn-action {
            flex: 1;
            padding: 6px;
            border-radius: 6px;
            border: 1px solid var(--border-color);
            background: transparent;
            font-size: 0.8125rem;
            font-weight: 500;
            cursor: pointer;
            transition: var(--transition);
            color: var(--text-main);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
        }

        .btn-action:hover { background: #f1f5f9; }
        
        .btn-delete { color: var(--danger); border-color: #fca5a5; }
        .btn-delete:hover { background: #fef2f2; border-color: var(--danger); }

        /* Toast 弹窗通知 (替代 alert) */
        #toast-container {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 100;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .toast {
            background: var(--text-main);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 0.875rem;
            box-shadow: var(--shadow-md);
            animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .toast.error { background: var(--danger); }
        .toast.success { background: #10b981; }

        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }

        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }

        /* 空状态 */
        .empty-state {
            grid-column: 1 / -1;
            text-align: center;
            padding: 60px 20px;
            color: var(--text-muted);
        }
        .empty-state svg { width: 48px; height: 48px; margin-bottom: 16px; opacity: 0.5; }
    </style>
</head>
<body>
    <nav class="navbar">
        <div class="brand">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
            Gallery <span>${domain}</span>
        </div>
        <button class="btn-primary" onclick="loadImages()" id="refreshBtn">
            刷新空间
        </button>
    </nav>

    <main class="container">
        <div class="status-bar">
            <span id="status-text">正在连接 R2 存储桶...</span>
        </div>
        <div class="grid" id="gallery">
            </div>
    </main>

    <div id="toast-container"></div>

    <script>
        const DOMAIN = "${domain}";
        const API_TOKEN = "${token}";

        // 页面加载完成后立即拉取数据
        window.addEventListener('DOMContentLoaded', loadImages);

        // 自定义 Toast 提示功能
        function showToast(message, type = 'default') {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = \`toast \${type}\`;
            
            // 根据类型添加图标
            const icon = type === 'success' ? '✓ ' : type === 'error' ? '⚠ ' : 'ℹ ';
            toast.innerText = icon + message;
            
            container.appendChild(toast);
            
            // 3秒后自动消失
            setTimeout(() => {
                toast.style.animation = 'fadeOut 0.3s ease forwards';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        // 获取并渲染图片列表
        async function loadImages() {
            const btn = document.getElementById('refreshBtn');
            const statusText = document.getElementById('status-text');
            const gallery = document.getElementById('gallery');
            
            btn.disabled = true;
            btn.innerText = "加载中...";
            
            try {
                const res = await fetch('/api/list', { 
                    headers: { 'Authorization': 'Bearer ' + API_TOKEN }
                });
                
                if (!res.ok) throw new Error(res.status === 401 ? '无权访问 API' : '获取数据失败');
                
                const files = await res.json();
                
                // 过滤掉文件夹/零字节对象
                const validFiles = files.filter(f => f.size > 0);
                
                statusText.innerText = \`共托管 \${validFiles.length} 个文件\`;
                gallery.innerHTML = '';

                if (validFiles.length === 0) {
                    gallery.innerHTML = \`
                        <div class="empty-state">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                            <h3>暂无图片</h3>
                            <p>使用 Typora 上传的图片将显示在这里</p>
                        </div>
                    \`;
                    return;
                }

                // 渲染卡片
                validFiles.forEach(file => {
                    const url = \`\${DOMAIN}/\${file.key}\`;
                    const date = new Date(file.uploaded).toLocaleDateString();
                    const size = (file.size / 1024).toFixed(1) + ' KB';

                    const card = document.createElement('div');
                    card.className = 'card';
                    card.innerHTML = \`
                        <div class="img-container" onclick="window.open('\${url}', '_blank')">
                            <div class="img-placeholder">加载图片中...</div>
                            <img src="\${url}" loading="lazy" onload="this.previousElementSibling.style.display='none'" onerror="this.previousElementSibling.innerText='图片破损'">
                        </div>
                        <div class="card-content">
                            <div class="file-name" title="\${file.key}">\${file.key}</div>
                            <div class="file-meta">
                                <span>\${size}</span>
                                <span>\${date}</span>
                            </div>
                            <div class="card-actions">
                                <button class="btn-action" onclick="copyUrl('\${url}')">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                    复制
                                </button>
                                <button class="btn-action btn-delete" onclick="deleteFile('\${file.key}')">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    删除
                                </button>
                            </div>
                        </div>
                    \`;
                    gallery.appendChild(card);
                });

            } catch (err) {
                statusText.innerText = '加载失败: ' + err.message;
                showToast(err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.innerText = "刷新空间";
            }
        }

        // 复制链接
        function copyUrl(url) {
            navigator.clipboard.writeText(url).then(() => {
                showToast('图片直链已复制到剪贴板', 'success');
            }).catch(() => {
                showToast('复制失败，请手动复制', 'error');
            });
        }

        // 删除文件 (带有确认保护)
        let deleteTarget = null;
        async function deleteFile(key) {
            // 将原生的 confirm 包装得优雅一点，或者直接用原生保护（为保持代码精简，这里保留原生 confirm 但提示语更柔和）
            if (!window.confirm(\`确认要永久删除图片 "\\n\${key}"\\n吗？此操作无法撤销。\`)) {
                return;
            }

            try {
                const res = await fetch('/api/delete', {
                    method: 'DELETE',
                    headers: { 
                        'Authorization': 'Bearer ' + API_TOKEN, 
                        'X-File-Name': key 
                    }
                });
                
                if (!res.ok) throw new Error('删除请求失败');
                
                showToast('图片已删除', 'success');
                loadImages(); // 刷新网格
            } catch (err) {
                showToast(err.message, 'error');
            }
        }
    </script>
</body>
</html>
  `;
}
