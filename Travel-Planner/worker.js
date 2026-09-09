// ==========================================
// 1. 前端：完整的 HTML/CSS/JS 模板
// ==========================================
const HTML_TEMPLATE = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="theme-color" content="#f0f4f8">
    <title>旅行规划师 · 行程地图</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
        :root {
            --primary: #4f46e5;
            --primary-hover: #4338ca;
            --grad: linear-gradient(135deg, #6366f1 0%, #3b82f6 100%);
            --bg: #f0f4f8;
            --card: #ffffff;
            --text-main: #0f172a;
            --text-sub: #475569;
            --text-light: #94a3b8;
            --border: #e2e8f0;
            --radius: 18px;
            --radius-sm: 10px;
            --shadow: 0 1px 2px rgba(15,23,42,.04), 0 8px 24px rgba(15,23,42,.07);
            --shadow-lg: 0 16px 48px rgba(15,23,42,.16);
            --danger: #ef4444;
            --success: #10b981;
        }

        * { -webkit-tap-highlight-color: transparent; }

        body {
            margin: 0; height: 100dvh; overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Roboto, sans-serif;
            color: var(--text-main);
            display: flex; background: var(--bg);
        }

        /* ============ 侧边栏 ============ */
        #sidebar {
            width: 400px; background: var(--card); margin: 16px;
            border-radius: var(--radius); display: flex; flex-direction: column;
            padding: 20px; box-sizing: border-box;
            box-shadow: var(--shadow-lg); z-index: 1000; flex-shrink: 0;
            min-height: 0;
        }

        .sheet-handle { display: none; }
        .sheet-summary { display: none; }

        .app-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
        .app-logo {
            width: 42px; height: 42px; border-radius: 14px; background: var(--grad);
            display: flex; align-items: center; justify-content: center; font-size: 22px;
            box-shadow: 0 6px 14px rgba(99,102,241,.35); flex-shrink: 0;
        }
        .app-title {
            font-size: 20px; font-weight: 800; margin: 0; letter-spacing: .5px;
            background: var(--grad); -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        .app-sub { font-size: 11px; color: var(--text-light); margin: 2px 0 0; }

        .auth-badge {
            background: linear-gradient(135deg,#eef2ff,#e0f2fe);
            border: 1px solid #e0e7ff; border-radius: 14px; padding: 12px 14px;
            font-size: 13px; color: var(--primary); margin-bottom: 16px;
            display: flex; flex-direction: column; gap: 10px;
        }
        .auth-header { display: flex; justify-content: space-between; align-items: center; width: 100%; }
        .auth-actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .auth-actions .btn-small { padding: 8px 6px; font-size: 12px; border-radius: 9px; }

        .title-row { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; }
        .title-input {
            flex: 1; min-width: 0; width: auto; font-size: 16px; font-weight: 700; border: 1px solid transparent; padding: 11px 14px;
            outline: none; background: #f8fafc; border-radius: 10px; box-sizing: border-box;
            transition: .2s; color: var(--text-main); margin: 0;
        }
        .title-input:focus { border-color: var(--primary); background: #fff; box-shadow: 0 0 0 3px rgba(99,102,241,.15); }
        #plan-edit-btn { display: none; }

        /* ============ 按钮 ============ */
        .btn {
            background: var(--grad); color: #fff; border: none;
            padding: 12px; border-radius: 12px; font-weight: 600;
            cursor: pointer; transition: .2s; text-align: center; font-size: 14px;
            box-shadow: 0 6px 16px rgba(99,102,241,.28);
        }
        .btn:hover { transform: translateY(-1px); box-shadow: 0 10px 20px rgba(99,102,241,.35); }
        .btn:active { transform: translateY(0); }
        .btn-small { padding: 6px 12px; font-size: 12px; border-radius: 20px; box-shadow: none; }
        .btn-outline { background: #fff; color: var(--primary); border: 1px solid #c7d2fe; box-shadow: none; }
        .btn-outline:hover { background: #eef2ff; box-shadow: none; }
        .btn-danger-text { background: none; color: var(--danger); border: none; box-shadow: none; }
        .btn-danger-text:hover { background: #fef2f2; box-shadow: none; }

        /* ============ 路线列表 ============ */
        #route-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; padding-right: 2px; }
        #route-list::-webkit-scrollbar { width: 5px; }
        #route-list::-webkit-scrollbar-thumb { background: #d3dce6; border-radius: 4px; }

        .point-item {
            border: 1px solid var(--border); border-left: 4px solid var(--primary);
            border-radius: 12px; padding: 10px; background: #fff;
            transition: .18s; box-shadow: var(--shadow);
            display: flex; align-items: center; gap: 6px;
        }
        .point-item:hover { box-shadow: var(--shadow-lg); transform: translateY(-1px); }
        .drag-handle {
            display: flex; align-items: center; justify-content: center;
            cursor: grab; color: var(--text-light); font-size: 14px; letter-spacing: 1px;
            user-select: none; -webkit-user-select: none; touch-action: none; flex-shrink: 0;
            width: 22px; height: 32px;
        }
        .drag-handle:active, .drag-handle.dragging { cursor: grabbing; }
        .point-item.dragging { opacity: .55; box-shadow: var(--shadow-lg); }
        .point-info { flex: 1; min-width: 0; cursor: pointer; }
        .point-title { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; flex-wrap: wrap; }
        .point-title h4 { margin: 0; font-size: 14.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cat-badge { font-size: 11px; font-weight: 600; padding: 2px 9px; border-radius: 999px; flex-shrink: 0; }
        .point-meta { margin: 0; font-size: 12px; color: var(--text-sub); display: flex; flex-wrap: wrap; gap: 4px 10px; }
        .point-meta span { display: inline-flex; align-items: center; gap: 3px; }

        .point-actions { display: flex; gap: 4px; align-items: center; flex-shrink: 0; }
        .point-actions button {
            background: #f1f5f9; border: none; width: 30px; height: 30px;
            border-radius: 8px; cursor: pointer; color: var(--text-sub); font-size: 14px;
            transition: .15s; display: flex; align-items: center; justify-content: center;
        }
        .point-actions button:hover { background: #e2e8f0; color: var(--text-main); }
        .point-actions button.del:hover { background: #fee2e2; color: var(--danger); }

        .empty-state { text-align: center; color: var(--text-light); margin-top: 44px; font-size: 13px; line-height: 1.8; }
        .empty-state .big { font-size: 44px; margin-bottom: 8px; display: block; }

        .bottom-actions { display: flex; gap: 10px; }

        /* ============ 地图区 ============ */
        #map-container {
            flex: 1; position: relative; margin: 16px 16px 16px 0;
            border-radius: var(--radius); box-shadow: var(--shadow-lg);
            overflow: hidden; z-index: 1;
        }
        #map { width: 100%; height: 100%; }

        /* ============ 地图底部控制栏（缩放 / 保存 / 导出 / 搜索 / 全屏） ============ */
        #map-controls {
            position: absolute; left: 12px; right: 12px; bottom: 12px;
            z-index: 2000; display: flex; align-items: center; gap: 10px;
            pointer-events: none;
        }
        .ctrl-left { display: flex; gap: 6px; align-items: center; pointer-events: auto; }
        .ctrl-btn {
            width: 38px; height: 38px; border-radius: 10px; border: none;
            background: rgba(255,255,255,.95); color: var(--text-main);
            font-size: 18px; cursor: pointer; box-shadow: 0 6px 18px rgba(0,0,0,.18);
            display: flex; align-items: center; justify-content: center;
            transition: .15s; backdrop-filter: blur(8px); padding: 0; flex-shrink: 0;
        }
        .ctrl-btn:hover { background: #ffffff; transform: translateY(-1px); }
        .ctrl-btn:active { transform: translateY(0); }
        .ctrl-btn:disabled { opacity: .6; cursor: default; transform: none; }
        #ctrl-fullscreen { display: none; }
        .ctrl-search-mobile { display: none; }
        #search-box {
            flex: 0 1 320px; max-width: 320px; min-width: 0; margin-left: auto;
            position: relative;
            border-radius: 12px; background: rgba(255,255,255,.96);
            backdrop-filter: blur(8px); box-shadow: 0 6px 18px rgba(0,0,0,.18);
            pointer-events: auto; overflow: visible;
        }
        .search-input-group { display: flex; width: 100%; }
        #search-input {
            flex: 1; border: none; padding: 11px 13px; font-size: 14px;
            outline: none; background: transparent; min-width: 0; width: 100%;
        }
        #search-input::-webkit-search-cancel-button { -webkit-appearance: none; }
        #search-btn {
            background: var(--grad); color: #fff; border: none;
            padding: 0 15px; border-radius: 0 12px 12px 0; cursor: pointer;
            transition: .2s; font-weight: 600; font-size: 13px; flex-shrink: 0;
        }
        #search-results {
            position: absolute; bottom: calc(100% + 6px); left: 0; right: 0;
            max-height: 220px; overflow-y: auto; background: #fff; display: none;
            border-radius: 12px; border: 1px solid var(--border);
            box-shadow: 0 12px 30px rgba(0,0,0,.14);
        }
        .search-item {
            padding: 11px 15px; font-size: 13px; border-bottom: 1px solid #f1f5f9;
            cursor: pointer; color: var(--text-sub); line-height: 1.5;
        }
        .search-item:hover { background: #eef2ff; color: var(--primary); }

        /* ============ 手机端搜索弹层 ============ */
        .mobile-search-overlay {
            position: fixed; inset: 0; background: rgba(15,23,42,.55);
            z-index: 3500; display: none; align-items: flex-start; justify-content: center;
            backdrop-filter: blur(2px);
        }
        .mobile-search-overlay.open { display: flex; }
        .ms-box {
            width: 100%; max-width: 560px; margin-top: max(24px, env(safe-area-inset-top));
            padding: 0 12px; box-sizing: border-box;
        }
        .ms-input-row { display: flex; gap: 8px; }
        .ms-input-row input {
            flex: 1; min-width: 0; padding: 13px 14px; font-size: 15px;
            border: none; border-radius: 12px; outline: none; background: #fff;
            box-shadow: 0 6px 20px rgba(0,0,0,.15); color: var(--text-main);
        }
        .ms-input-row button {
            background: var(--grad); color: #fff; border: none; padding: 0 16px;
            border-radius: 12px; cursor: pointer; font-weight: 600; font-size: 14px;
            box-shadow: 0 6px 14px rgba(99,102,241,.3); flex-shrink: 0;
        }
        .ms-input-row button:disabled { opacity: .6; cursor: default; }
        .ms-input-row #ms-close { background: #f1f5f9; color: var(--text-sub); box-shadow: none; }
        #ms-results {
            margin-top: 8px; background: #fff; border-radius: 14px; overflow: hidden;
            box-shadow: 0 12px 30px rgba(0,0,0,.2); display: none; max-height: 55vh; overflow-y: auto;
        }
        #ms-results .search-item { padding: 13px 15px; }

        /* ============ 全屏地图模式 ============ */
        body.fullscreen #sidebar { display: none; }
        body.fullscreen #map-container { margin: 0; border-radius: 0; box-shadow: none; }
        #map-controls { bottom: calc(12px + env(safe-area-inset-bottom)); }

        /* ============ 桌面端侧边栏收起 ============ */
        @media (min-width: 769px) {
            .sidebar-toggle {
                display: flex; align-items: center; justify-content: center;
                width: 34px; height: 34px; border-radius: 10px; border: none;
                background: #f1f5f9; color: var(--text-sub); cursor: pointer;
                font-size: 22px; line-height: 1; margin-left: auto; flex-shrink: 0;
                transition: .15s;
            }
            .sidebar-toggle:hover { background: #e2e8f0; color: var(--text-main); }
            #sidebar-restore {
                display: none; position: fixed; left: 16px; top: 50%;
                transform: translateY(-50%); z-index: 1500;
                width: 42px; height: 42px; border-radius: 12px; border: none;
                background: rgba(255,255,255,.96); color: var(--primary);
                font-size: 20px; cursor: pointer; box-shadow: 0 8px 20px rgba(0,0,0,.18);
                backdrop-filter: blur(8px); align-items: center; justify-content: center;
                padding: 0; transition: .15s;
            }
            #sidebar-restore:hover { background: #ffffff; transform: translateY(-50%) scale(1.06); }
            #sidebar-restore:active { transform: translateY(-50%) scale(1); }
            body.sidebar-collapsed #sidebar { display: none; }
            body.sidebar-collapsed #sidebar-restore { display: flex; }
            #map-container { transition: margin .3s ease; }
            body.sidebar-collapsed #map-container { margin: 16px; }
        }

        /* ============ Leaflet 定制 ============ */
        .leaflet-popup-content-wrapper { border-radius: 14px !important; box-shadow: var(--shadow-lg) !important; }
        .leaflet-popup-content { margin: 12px 14px !important; }
        .leaflet-container { font-family: inherit; }

        /* ============ 模态框 ============ */
        .modal-overlay {
            position: fixed; inset: 0; background: rgba(15,23,42,.45);
            z-index: 3000; display: none; align-items: center; justify-content: center;
            opacity: 0; transition: opacity .2s; backdrop-filter: blur(2px);
        }
        .modal-overlay.open { opacity: 1; }
        .modal-card {
            background: #fff; border-radius: 20px; width: 430px; max-width: 92vw;
            max-height: 88dvh; overflow-y: auto; padding: 24px; box-sizing: border-box;
            box-shadow: var(--shadow-lg); transform: translateY(16px) scale(.97);
            transition: transform .22s; display: flex; flex-direction: column; gap: 14px;
        }
        .modal-overlay.open .modal-card { transform: none; }
        .modal-head { display: flex; justify-content: space-between; align-items: center; }
        .modal-head h3 { margin: 0; font-size: 17px; }
        .modal-close {
            border: none; background: #f1f5f9; color: var(--text-sub);
            width: 30px; height: 30px; border-radius: 50%; font-size: 17px;
            cursor: pointer; display: flex; align-items: center; justify-content: center; transition: .15s;
        }
        .modal-close:hover { background: #e2e8f0; color: var(--text-main); }
        .coord-hint { margin: 0; font-size: 12px; color: var(--success); background: #ecfdf5; border-radius: 8px; padding: 8px 10px; }
        .modal-actions { display: flex; gap: 10px; margin-top: 4px; }
        .modal-actions .btn { flex: 1; }

        /* ============ 表单字段 ============ */
        .form-label {
            font-size: 12px; font-weight: 600; color: var(--text-sub);
            margin: 0 0 6px; display: flex; align-items: center; gap: 5px;
        }
        .form-field { margin: 0; }
        .form-field input, .form-field select, .form-field textarea {
            width: 100%; border: 1px solid var(--border); border-radius: 10px;
            padding: 11px 12px; font-size: 14px; outline: none; background: #fff;
            transition: .15s; box-sizing: border-box; color: var(--text-main);
            font-family: inherit;
        }
        .form-field input:focus, .form-field select:focus, .form-field textarea:focus {
            border-color: var(--primary); box-shadow: 0 0 0 3px rgba(99,102,241,.15);
        }
        .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

        /* 地点分类选择器 */
        .cat-selector { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
        .cat-option {
            border: 1px solid var(--border); border-radius: 12px; padding: 9px 2px;
            text-align: center; cursor: pointer; transition: .15s; background: #fff;
            font-size: 11px; color: var(--text-sub);
            display: flex; flex-direction: column; gap: 3px; align-items: center;
        }
        .cat-option .ico { font-size: 22px; line-height: 1; }
        .cat-option:hover { border-color: #a5b4fc; }
        .cat-option.active { border-color: var(--primary); background: #eef2ff; color: var(--primary); font-weight: 700; box-shadow: inset 0 0 0 1px var(--primary); }

        .cost-wrap { position: relative; }
        .cost-wrap input { padding-right: 38px; }
        .cost-unit { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); font-size: 13px; color: var(--text-light); pointer-events: none; }

        /* ============ 历史计划 ============ */
        .history-item {
            padding: 13px; border: 1px solid var(--border); border-radius: 12px;
            transition: .18s; display: flex; justify-content: space-between; align-items: center; background: #fff;
        }
        .history-item:hover { border-color: var(--primary); background: #eef2ff; }
        .history-item-content { flex: 1; cursor: pointer; min-width: 0; }
        .history-item h4 { margin: 0 0 5px; font-size: 14px; color: var(--text-main); }
        .history-item p { margin: 0; font-size: 11px; color: var(--text-light); }
        .del-btn { background: none; border: none; color: var(--danger); font-size: 12px; cursor: pointer; padding: 8px; border-radius: 8px; flex-shrink: 0; }
        .del-btn:hover { background: #fee2e2; }

        /* ============ Toast ============ */
        #toast-container {
            position: fixed; bottom: 26px; left: 50%; transform: translateX(-50%);
            z-index: 4000; display: flex; flex-direction: column; gap: 8px; align-items: center;
            pointer-events: none;
        }
        .toast {
            background: #0f172a; color: #fff; padding: 11px 20px; border-radius: 999px;
            font-size: 13px; opacity: 0; transform: translateY(10px); transition: .25s;
            box-shadow: var(--shadow-lg); max-width: 86vw; text-align: center;
        }
        .toast.show { opacity: 1; transform: none; }
        .toast-success { background: var(--success); }
        .toast-error { background: var(--danger); }

        /* ============ 手机端适配 ============ */
        @media (max-width: 768px) {
            body { flex-direction: column; }
            #map-container { flex: 1; margin: 0; border-radius: 0; box-shadow: none; }
            #map { border-radius: 0; }

            /* 底部抽屉：展开时占满几乎整个屏幕，方便查看/拖动路线列表 */
            #sidebar {
                width: 100%; height: calc(100dvh - 16px); max-height: none; min-height: 0;
                margin: 0; border-radius: 22px 22px 0 0; padding: 8px 14px 0;
                padding-bottom: calc(10px + env(safe-area-inset-bottom));
                box-shadow: 0 -10px 34px rgba(15,23,42,.18); position: relative;
                transition: height .3s ease;
            }
            #sidebar.collapsed { height: 172px; min-height: 0; overflow: hidden; }
            #sidebar.collapsed .app-header,
            #sidebar.collapsed .auth-badge,
            #sidebar.collapsed #route-list,
            #sidebar.collapsed .bottom-actions { display: none; }

            .sheet-handle {
                display: flex; flex-direction: column; align-items: center;
                cursor: pointer; padding: 6px 0 6px; flex-shrink: 0;
            }
            .sheet-handle .bar { width: 44px; height: 5px; border-radius: 3px; background: #d3dce6; }
            .sheet-chevron { color: var(--text-light); font-size: 13px; margin-top: 3px; transition: .2s; }
            #sidebar.collapsed .sheet-chevron { transform: rotate(180deg); }

            /* 收起时的摘要条：仅展示景点数 + 规划名，不响应点击 */
            .sheet-summary {
                display: flex; align-items: center; gap: 10px;
                background: #f8fafc; border: 1px solid var(--border); border-radius: 12px;
                padding: 10px 12px; margin-bottom: 8px; user-select: none; -webkit-user-select: none;
            }
            #sidebar:not(.collapsed) .sheet-summary { display: none; }
            .sheet-summary-ico { font-size: 18px; flex-shrink: 0; }
            .sheet-summary-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
            .sheet-summary-text b { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .sheet-summary-text span { font-size: 11.5px; color: var(--text-light); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .sheet-summary-hint { font-size: 12px; color: var(--primary); background: #eef2ff; padding: 6px 10px; border-radius: 999px; flex-shrink: 0; }

            .app-header { margin-bottom: 10px; }
            .app-logo { width: 34px; height: 34px; font-size: 18px; border-radius: 11px; }
            .app-title { font-size: 16.5px; }
            .app-sub { display: none; }
            .auth-badge { margin-bottom: 10px; padding: 10px 12px; }
            .sidebar-toggle { display: none; }
            .title-row { margin-bottom: 10px; }
            .title-input { padding: 11px 12px; font-size: 15px; }
            #plan-edit-btn { display: flex; flex-shrink: 0; }

            #search-input { padding: 12px 13px; }
            .ctrl-btn { width: 40px; height: 40px; }
            #ctrl-fullscreen { display: inline-flex; }
            .ctrl-search-mobile { display: flex; margin-left: auto; pointer-events: auto; }
            #search-box { display: none; }

            #route-list { margin-bottom: 10px; }

            /* 底部操作栏：云端保存 + 导出（与桌面端一致） */
            .bottom-actions {
                display: flex; gap: 10px; padding-top: 10px;
                border-top: 1px solid var(--border);
            }
            .bottom-actions .btn { padding: 13px; font-size: 14px; }

            /* 点位卡片：操作按钮换行到第二行，避免挤压地点名称 */
            .point-item { flex-wrap: wrap; gap: 4px 6px; }
            .point-actions { width: 100%; justify-content: flex-end; padding-top: 8px; border-top: 1px dashed #e8edf3; }
            .point-actions button { width: 36px; height: 34px; }
            .drag-handle { width: 30px; height: 36px; font-size: 16px; background: #f1f5f9; border-radius: 8px; }

            .modal-overlay { align-items: flex-end; }
            .modal-card {
                width: 100%; max-width: 100%; border-radius: 22px 22px 0 0;
                max-height: 88dvh; padding: 20px 18px;
                padding-bottom: calc(18px + env(safe-area-inset-bottom));
                transform: translateY(40px);
            }
            .modal-overlay.open .modal-card { transform: none; }

            .cat-option { padding: 9px 2px; font-size: 11px; }

            @media (max-width: 360px) {
                .field-row { grid-template-columns: 1fr; }
                .cat-option .ico { font-size: 19px; }
                #map-controls { gap: 6px; left: 8px; right: 8px; }
                .ctrl-left { gap: 4px; }
                .ctrl-btn { width: 36px; height: 36px; }
                .point-actions button { width: 32px; height: 32px; }
            }
        }
    </style>
</head>
<body>
    <div id="sidebar">
        <div class="sheet-handle" onclick="toggleSheet()">
            <div class="bar"></div>
            <span class="sheet-chevron">▾</span>
        </div>

        <div class="sheet-summary">
            <span class="sheet-summary-ico">📍</span>
            <div class="sheet-summary-text">
                <b id="summary-count">0 个景点</b>
                <span id="summary-title">我的旅行规划</span>
            </div>
            <span class="sheet-summary-hint">展开</span>
        </div>

        <div class="app-header">
            <div class="app-logo">✈️</div>
            <div>
                <h1 class="app-title">旅行规划师</h1>
                <p class="app-sub">在地图上规划你的每一次出发</p>
            </div>
            <button class="sidebar-toggle" id="sidebar-toggle" onclick="toggleSidebar()" title="收起侧边栏">‹</button>
        </div>

            <div class="auth-badge" id="user-status"></div>
        <div class="title-row">
            <input type="text" id="plan-title" class="title-input" placeholder="输入规划名称..." value="我的旅行规划" oninput="updateSheetSummary()">
            <button class="btn btn-small" id="plan-edit-btn" onclick="toggleSheet()">📝 修改计划</button>
        </div>

            <div id="route-list"></div>
        <div class="bottom-actions">
            <button class="btn" id="save-btn" style="flex: 2;" onclick="saveToCloud()">☁️ 云端保存</button>
            <button class="btn btn-outline" style="flex: 1;" onclick="exportMD()">导出 MD</button>
        </div>
    </div>

    <div id="map-container">
        <div id="map"></div>
        <div id="map-controls">
            <div class="ctrl-left">
                <button class="ctrl-btn" onclick="map.zoomIn()" title="放大">＋</button>
                <button class="ctrl-btn" onclick="map.zoomOut()" title="缩小">−</button>
                <button class="ctrl-btn" id="ctrl-fullscreen" onclick="toggleFullscreen()" title="进入全屏">⛶</button>
            </div>
            <div id="search-box">
                <div class="search-input-group">
                    <input type="text" id="search-input" readonly="true" onfocus="this.removeAttribute('readonly');" autocomplete="off" spellcheck="false" placeholder="搜索地名..." onkeypress="handleSearchEnter(event)" name="dummy-search-field">
                    <button id="search-btn" onclick="executeSearch()">搜索</button>
                </div>
                <div id="search-results"></div>
            </div>
            <button class="ctrl-btn ctrl-search-mobile" onclick="openMobileSearch()" title="搜索地名">🔍</button>
        </div>
    </div>

    <!-- 展开侧边栏（侧边栏收起时在地图左缘显示） -->
    <button id="sidebar-restore" onclick="toggleSidebar()" title="展开侧边栏">›</button>

    <!-- 登录 / 注册 -->
    <div id="auth-modal" class="modal-overlay">
        <div class="modal-card">
            <div class="modal-head">
                <h3>登录 / 注册</h3>
                <button class="modal-close" onclick="closeAuthModal()">×</button>
            </div>
            <p style="margin:0; font-size:12px; color:var(--text-light);">登录后可将行程保存到云端，随时查看</p>
            <div class="form-field">
                <label class="form-label">用户名</label>
                <input type="text" id="auth-username" placeholder="最多 10 字" maxlength="10" autocomplete="username">
            </div>
            <div class="form-field">
                <label class="form-label">密码</label>
                <input type="password" id="auth-password" placeholder="最多 20 字" maxlength="20" autocomplete="new-password">
            </div>
            <div style="display:flex; gap:10px; margin-top:4px;">
                <button class="btn" style="flex:1;" onclick="handleAuth('login')">登录</button>
                <button class="btn btn-outline" style="flex:1;" onclick="handleAuth('register')">注册</button>
            </div>
        </div>
    </div>

    <!-- 添加 / 编辑景点 -->
    <div id="point-modal" class="modal-overlay">
        <div class="modal-card">
            <div class="modal-head">
                <h3 id="point-modal-title">添加地点</h3>
                <button class="modal-close" onclick="closePointModal()">×</button>
            </div>
            <p class="coord-hint" id="coord-hint">📍 已标记所选位置</p>

            <div>
                <label class="form-label">地点类型</label>
                <div class="cat-selector">
                    <div class="cat-option active" data-cat="scenic" onclick="selectCategory('scenic')"><span class="ico">🏞️</span>景点</div>
                    <div class="cat-option" data-cat="food" onclick="selectCategory('food')"><span class="ico">🍜</span>美食</div>
                    <div class="cat-option" data-cat="hotel" onclick="selectCategory('hotel')"><span class="ico">🏨</span>住宿</div>
                    <div class="cat-option" data-cat="shopping" onclick="selectCategory('shopping')"><span class="ico">🛍️</span>购物</div>
                    <div class="cat-option" data-cat="other" onclick="selectCategory('other')"><span class="ico">📍</span>其他</div>
                </div>
            </div>

            <div class="form-field">
                <label class="form-label">地点名称 *</label>
                <input type="text" id="f-name" placeholder="如：西湖、外婆家、汉庭酒店" maxlength="30">
            </div>

            <div class="field-row">
                <div class="form-field">
                    <label class="form-label">🕐 预计到达</label>
                    <input type="time" id="f-arrive">
                </div>
                <div class="form-field">
                    <label class="form-label">⏱️ 游览时长</label>
                    <input type="text" id="f-duration" placeholder="如：2 小时">
                </div>
            </div>

            <div class="field-row">
                <div class="form-field">
                    <label class="form-label">🚌 交通方式</label>
                    <select id="f-transport">
                        <option>步行</option>
                        <option>公交/地铁</option>
                        <option>打车/自驾</option>
                        <option>骑行</option>
                        <option>飞机/高铁</option>
                    </select>
                </div>
                <div class="form-field">
                    <label class="form-label">💰 费用</label>
                    <div class="cost-wrap">
                        <input type="number" id="f-cost" min="0" step="0.5" placeholder="0">
                        <span class="cost-unit">元</span>
                    </div>
                </div>
            </div>

            <div class="form-field">
                <label class="form-label">📝 游玩攻略 / 备注</label>
                <textarea id="f-details" rows="3" placeholder="有什么想看的、想吃的、注意事项……"></textarea>
            </div>

            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closePointModal()">取消</button>
                <button class="btn" onclick="savePoint()">✓ 保存地点</button>
            </div>
        </div>
    </div>

    <!-- 我的云端计划 -->
    <div id="history-modal" class="modal-overlay">
        <div class="modal-card">
            <div class="modal-head">
                <h3>我的云端计划</h3>
                <button class="modal-close" onclick="closeModal('history-modal')">×</button>
            </div>
            <div id="history-list" style="overflow-y: auto; display: flex; flex-direction: column; gap: 10px;"></div>
        </div>
    </div>

    <!-- 手机端搜索弹层（半透明遮挡，键盘不遮结果） -->
    <div id="mobile-search-overlay" class="mobile-search-overlay">
        <div class="ms-box">
            <div class="ms-input-row">
                <input type="text" id="ms-input" placeholder="搜索地名，如：西湖" autocomplete="off" spellcheck="false" onkeypress="handleSearchEnter(event)">
                <button id="ms-search-btn" onclick="runMobileSearch()">搜索</button>
                <button id="ms-close" onclick="closeMobileSearch()">取消</button>
            </div>
            <div id="ms-results"></div>
        </div>
    </div>

    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
        // ============ 核心状态与持久化 ============
        let currentUser = null;
        let currentPlanId = null;
        let waypoints = [];
        let markers = [];
        let searchMarker = null;
        let tempMarker = null;
        let editingIdx = null;     // null = 新增，数字 = 编辑对应索引
        let pendingLat = null, pendingLng = null;
        let currentCategory = 'scenic';

        const CATEGORIES = {
            scenic:   { label: '景点', icon: '🏞️', color: '#4f46e5' },
            food:     { label: '美食', icon: '🍜', color: '#f59e0b' },
            hotel:    { label: '住宿', icon: '🏨', color: '#10b981' },
            shopping: { label: '购物', icon: '🛍️', color: '#ec4899' },
            other:    { label: '其他', icon: '📍', color: '#64748b' }
        };

        try {
            const sessionStr = localStorage.getItem('travel_session');
            if (sessionStr) {
                const session = JSON.parse(sessionStr);
                if (session.exp > Date.now()) {
                    currentUser = session.user;
                } else {
                    localStorage.removeItem('travel_session');
                }
            }
        } catch(e) {}

        // ============ 地图初始化 ============
        const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([39.9042, 116.4074], 10);
        L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
            subdomains: ['0', '1', '2', '3'],
            attribution: '© Google Maps',
            maxZoom: 20
        }).addTo(map);
        L.control.attribution({ position: 'topright', prefix: false }).addTo(map);
        const polyline = L.polyline([], { color: '#4f46e5', weight: 4, opacity: 0.75, dashArray: null }).addTo(map);

        window.addEventListener('resize', () => {
            setTimeout(() => { map.invalidateSize(); }, 200);
        });

        // ============ 通用 UI 工具 ============
        function toast(msg, type) {
            let container = document.getElementById('toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'toast-container';
                document.body.appendChild(container);
            }
            if (window.innerWidth <= 768) {
                const sb = document.getElementById('sidebar');
                container.style.bottom = (sb.offsetHeight + 14) + 'px';
            } else {
                container.style.bottom = '26px';
            }
            const el = document.createElement('div');
            el.className = 'toast' + (type === 'success' ? ' toast-success' : type === 'error' ? ' toast-error' : '');
            el.innerText = msg;
            container.appendChild(el);
            requestAnimationFrame(() => el.classList.add('show'));
            setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2400);
        }

        function openModal(id) {
            const el = document.getElementById(id);
            el.style.display = 'flex';
            requestAnimationFrame(() => el.classList.add('open'));
        }
        function closeModal(id) {
            const el = document.getElementById(id);
            el.classList.remove('open');
            setTimeout(() => { el.style.display = 'none'; }, 200);
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closePointModal();
                closeModal('auth-modal');
                closeModal('history-modal');
                closeMobileSearch();
            }
        });

        // 手机端：底部抽屉展开 / 收起
        function setSheet(collapsed) {
            const sb = document.getElementById('sidebar');
            sb.classList.toggle('collapsed', collapsed);
            const btn = document.getElementById('plan-edit-btn');
            if (btn) btn.innerText = collapsed ? '📝 修改计划' : '▾ 收起';
            setTimeout(() => map.invalidateSize(), 260);
        }
        window.toggleSheet = function() {
            setSheet(!document.getElementById('sidebar').classList.contains('collapsed'));
        };

        // 全屏地图：隐藏侧边栏，保留地图，可继续点选地点
        window.toggleFullscreen = function() {
            const btn = document.getElementById('ctrl-fullscreen');
            if (!btn) return;
            document.body.classList.toggle('fullscreen');
            const isFull = document.body.classList.contains('fullscreen');
            btn.innerText = isFull ? '⤢' : '⛶';
            btn.title = isFull ? '退出全屏' : '进入全屏';
            setTimeout(() => map.invalidateSize(), 260);
        };

        // 桌面端：点击侧边栏右上角收起，地图左缘恢复按钮重新展开
        window.toggleSidebar = function() {
            document.body.classList.toggle('sidebar-collapsed');
            setTimeout(() => map.invalidateSize(), 320);
        };

        // ============ 搜索逻辑（桌面子内联 / 手机弹层共用） ============
        function handleSearchEnter(e) {
            if (e.key === 'Enter') {
                if (document.getElementById('search-box').offsetParent !== null) executeSearch();
                else runMobileSearch();
            }
        }

        function dropSearchMarker(lat, lon) {
            if (searchMarker) map.removeLayer(searchMarker);
            const redIcon = L.divIcon({
                html: '<div style="color:#ef4444; font-size:32px; filter:drop-shadow(0 2px 2px rgba(0,0,0,0.4)); line-height:1;">📍</div>',
                className: '', iconSize: [32, 32], iconAnchor: [16, 32]
            });
            searchMarker = L.marker([lat, lon], { icon: redIcon }).addTo(map)
                .bindPopup("<b>搜索结果</b><br><span style='color:gray;font-size:12px;'>点击地图此处即可添加景点</span>").openPopup();
            searchMarker.on('popupclose', () => {
                if (searchMarker) { map.removeLayer(searchMarker); searchMarker = null; }
            });
        }

        async function runSearch(inputId, resultsId, opts) {
            const inputEl = document.getElementById(inputId);
            const resultsEl = document.getElementById(resultsId);
            const btn = opts.btnId ? document.getElementById(opts.btnId) : null;
            const query = inputEl.value.trim();
            if (!query) return;
            if (btn) { btn.disabled = true; btn.innerText = '...'; }
            resultsEl.style.display = 'block';
            resultsEl.innerHTML = '<div class="search-item" style="text-align:center;">正在搜索...</div>';

            try {
                const url = \`https://nominatim.openstreetmap.org/search?format=json&q=\${encodeURIComponent(query)}\`;
                const response = await fetch(url);
                const data = await response.json();

                resultsEl.innerHTML = '';
                if (data.length === 0) {
                    resultsEl.innerHTML = '<div class="search-item" style="color:var(--danger);text-align:center;">未找到相关地点</div>';
                    setTimeout(() => resultsEl.style.display = 'none', 2000);
                    return;
                }
                data.slice(0, 5).forEach(place => {
                    const item = document.createElement('div');
                    item.className = 'search-item';
                    item.innerText = place.display_name;
                    item.onclick = () => {
                        const targetLat = parseFloat(place.lat);
                        const targetLon = parseFloat(place.lon);
                        dropSearchMarker(targetLat, targetLon);
                        resultsEl.style.display = 'none';
                        if (opts.closeOnPick) closeMobileSearch();
                        map.flyTo([targetLat, targetLon], 14);
                        if (inputId === 'search-input') {
                            document.getElementById('search-input').blur();
                            document.getElementById('search-input').setAttribute('readonly', 'true');
                            document.getElementById('search-input').value = '';
                        }
                    };
                    resultsEl.appendChild(item);
                });
            } catch (err) { resultsEl.innerHTML = '<div class="search-item" style="color:var(--danger);">搜索失败</div>'; }
            finally { if (btn) { btn.disabled = false; btn.innerText = opts.btnText; } }
        }

        function executeSearch() { runSearch('search-input', 'search-results', { btnId: 'search-btn', btnText: '搜索' }); }
        function runMobileSearch() { runSearch('ms-input', 'ms-results', { btnId: 'ms-search-btn', btnText: '搜索', closeOnPick: true }); }

        function openMobileSearch() {
            const el = document.getElementById('mobile-search-overlay');
            el.classList.add('open');
            setTimeout(() => document.getElementById('ms-input').focus(), 80);
        }
        function closeMobileSearch() {
            document.getElementById('mobile-search-overlay').classList.remove('open');
            document.getElementById('ms-input').value = '';
            document.getElementById('ms-results').style.display = 'none';
            document.getElementById('ms-results').innerHTML = '';
        }
        document.getElementById('mobile-search-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'mobile-search-overlay') closeMobileSearch();
        });

        // 点击页面其它区域收起桌面搜索结果
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#search-box') && !e.target.closest('#mobile-search-overlay')) {
                document.getElementById('search-results').style.display = 'none';
            }
        });

        // ============ 添加 / 编辑地点（模态表单） ============
        map.on('click', function(e) {
            pendingLat = e.latlng.lat;
            pendingLng = e.latlng.lng;
            if (tempMarker) map.removeLayer(tempMarker);
            if (searchMarker) { map.removeLayer(searchMarker); searchMarker = null; }
            tempMarker = L.marker([pendingLat, pendingLng], { color: '#4f46e5' }).addTo(map);
            openAddModal();
        });

        window.openAddModal = function() {
            editingIdx = null;
            document.getElementById('point-modal-title').innerText = '添加地点';
            document.getElementById('coord-hint').innerText = \`📍 已标记所选位置（\${pendingLat.toFixed(4)}, \${pendingLng.toFixed(4)}）\`;
            document.getElementById('f-name').value = '';
            document.getElementById('f-arrive').value = '';
            document.getElementById('f-duration').value = '';
            document.getElementById('f-cost').value = '';
            document.getElementById('f-details').value = '';
            document.getElementById('f-transport').selectedIndex = 0;
            selectCategory('scenic');
            openModal('point-modal');
            setTimeout(() => document.getElementById('f-name').focus(), 250);
        };

        window.openEditModal = function(idx) {
            const p = waypoints[idx];
            editingIdx = idx;
            document.getElementById('point-modal-title').innerText = '编辑地点';
            document.getElementById('coord-hint').innerText = \`📍 \${p.lat.toFixed(4)}, \${p.lng.toFixed(4)}\`;
            document.getElementById('f-name').value = p.name;
            document.getElementById('f-arrive').value = p.arriveTime === '--:--' ? '' : p.arriveTime;
            document.getElementById('f-duration').value = p.duration === '未定' ? '' : p.duration;
            document.getElementById('f-cost').value = (p.cost === '0' || p.cost === '') ? '' : p.cost;
            document.getElementById('f-details').value = p.details || '';
            document.getElementById('f-transport').value = p.transport || '步行';
            selectCategory(p.category || 'other');
            openModal('point-modal');
            setTimeout(() => document.getElementById('f-name').focus(), 250);
        };

        window.selectCategory = function(cat) {
            currentCategory = cat;
            document.querySelectorAll('.cat-option').forEach(el => el.classList.toggle('active', el.dataset.cat === cat));
        };

        window.closePointModal = function() {
            closeModal('point-modal');
            if (tempMarker) { map.removeLayer(tempMarker); tempMarker = null; }
        };

        window.savePoint = function() {
            const name = document.getElementById('f-name').value.trim();
            if (!name) { toast('请输入地点名称', 'error'); return; }

            const isNew = (editingIdx === null);
            const data = {
                name,
                category: currentCategory,
                arriveTime: document.getElementById('f-arrive').value || '--:--',
                duration: document.getElementById('f-duration').value.trim() || '未定',
                cost: document.getElementById('f-cost').value === '' ? '0' : document.getElementById('f-cost').value,
                transport: document.getElementById('f-transport').value,
                details: document.getElementById('f-details').value.trim()
            };

            if (isNew) {
                data.id = Date.now();
                data.lat = pendingLat;
                data.lng = pendingLng;
                waypoints.push(data);
            } else {
                Object.assign(waypoints[editingIdx], data);
            }

            if (tempMarker) { map.removeLayer(tempMarker); tempMarker = null; }
            closePointModal();
            renderRoute();
            toast(isNew ? '✓ 已添加地点' : '✓ 已更新地点', 'success');
        };

        // ============ 点位与连线 ============
        let dragIndex = -1;
        let dragEl = null;

        function refreshMarkers() {
            markers.forEach(m => map.removeLayer(m));
            markers = [];
            const latlngs = [];
            waypoints.forEach((p, i) => {
                latlngs.push([p.lat, p.lng]);
                const cat = CATEGORIES[p.category] || CATEGORIES.other;
                const iconHtml = \`<div style="background:\${cat.color};color:#fff;border-radius:50%;width:26px;height:26px;text-align:center;line-height:26px;font-size:12px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid #fff;">\${i + 1}</div>\`;
                const customIcon = L.divIcon({ html: iconHtml, className: '', iconSize: [26, 26], iconAnchor: [13, 13] });
                const m = L.marker([p.lat, p.lng], { icon: customIcon }).addTo(map).bindTooltip(\`\${cat.icon} \${p.name}\`, { direction: 'top', offset: [0, -14] });
                markers.push(m);
            });
            return latlngs;
        }

        function renderList() {
            const listDiv = document.getElementById('route-list');
            if (waypoints.length === 0) {
                listDiv.innerHTML = \`
                    <div class="empty-state">
                        <span class="big">🗺️</span>
                        点击地图任意位置开始添加景点<br>
                        支持搜索地名、标记行程、云端保存
                    </div>\`;
                return;
            }
            listDiv.innerHTML = '';
            waypoints.forEach((p, i) => {
                const cat = CATEGORIES[p.category] || CATEGORIES.other;
                const costText = (p.cost === '0' || !p.cost) ? '免费' : '💰 ' + p.cost + ' 元';
                const arriveText = (p.arriveTime && p.arriveTime !== '--:--') ? '🕐 ' + p.arriveTime : '';
                const durText = (p.duration && p.duration !== '未定') ? '⏱ ' + p.duration : '';

                listDiv.innerHTML += \`
                    <div class="point-item" style="border-left-color:\${cat.color}">
                        <div class="drag-handle" title="拖动排序">⋮⋮</div>
                        <div class="point-info" onclick="map.flyTo([\${p.lat}, \${p.lng}], 15)">
                            <div class="point-title">
                                <span class="cat-badge" style="background:\${cat.color}1f;color:\${cat.color};">\${cat.icon} \${cat.label}</span>
                                <h4>\${i + 1}. \${p.name}</h4>
                            </div>
                            <p class="point-meta">
                                <span>\${arriveText}</span><span>\${durText}</span>
                                <span>🚌 \${p.transport}</span><span>\${costText}</span>
                            </p>
                        </div>
                        <div class="point-actions">
                            <button onclick="movePoint(\${i}, -1)" title="上移">↑</button>
                            <button onclick="movePoint(\${i}, 1)" title="下移">↓</button>
                            <button onclick="openEditModal(\${i})" style="color:var(--primary);" title="编辑">✎</button>
                            <button class="del" onclick="removePoint(\${i})" title="删除">×</button>
                        </div>
                    </div>
                \`;
            });
        }

        // 拖动过程中只更新编号和按钮索引，避免整列表重建造成闪烁
        function renumberList() {
            const listDiv = document.getElementById('route-list');
            const items = listDiv.children;
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const h4 = item.querySelector('.point-title h4');
                h4.textContent = (i + 1) + '. ' + waypoints[i].name;
                const btns = item.querySelectorAll('.point-actions button');
                btns[0].setAttribute('onclick', \`movePoint(\${i}, -1)\`);
                btns[1].setAttribute('onclick', \`movePoint(\${i}, 1)\`);
                btns[2].setAttribute('onclick', \`openEditModal(\${i})\`);
                btns[3].setAttribute('onclick', \`removePoint(\${i})\`);
            }
        }

        // 拖拽排序：按住卡片左侧把手上下拖动
        function initDragReorder() {
            const listDiv = document.getElementById('route-list');
            listDiv.addEventListener('pointerdown', (e) => {
                const handle = e.target.closest('.drag-handle');
                if (!handle) return;
                const item = handle.closest('.point-item');
                if (!item) return;
                e.preventDefault();
                dragIndex = Array.prototype.indexOf.call(listDiv.children, item);
                dragEl = item;
                item.classList.add('dragging');
                item.setPointerCapture(e.pointerId);
            });
            listDiv.addEventListener('pointermove', (e) => {
                if (dragIndex < 0 || !dragEl) return;
                const below = document.elementFromPoint(e.clientX, e.clientY);
                const overItem = below ? below.closest('.point-item') : null;
                if (!overItem || overItem === dragEl) return;
                const targetIndex = Array.prototype.indexOf.call(listDiv.children, overItem);
                if (targetIndex < 0 || targetIndex === dragIndex) return;
                listDiv.insertBefore(dragEl, targetIndex < dragIndex ? overItem : overItem.nextSibling);
                const moved = waypoints.splice(dragIndex, 1)[0];
                waypoints.splice(targetIndex, 0, moved);
                dragIndex = targetIndex;
                renumberList();
            });
            const endDrag = () => {
                if (dragIndex >= 0 && dragEl) {
                    dragEl.classList.remove('dragging');
                    dragEl = null;
                    dragIndex = -1;
                    renderRoute(true);
                }
            };
            listDiv.addEventListener('pointerup', endDrag);
            listDiv.addEventListener('pointercancel', endDrag);
        }

        function renderRoute(skipFit) {
            const latlngs = refreshMarkers();
            polyline.setLatLngs(latlngs);
            renderList();
            updateSheetSummary();
            if (!skipFit && latlngs.length > 0) {
                const isMobile = window.innerWidth <= 768;
                map.fitBounds(L.polyline(latlngs).getBounds(), { padding: isMobile ? [60, 100] : [50, 50], maxZoom: 14 });
            }
        }

        // 手机端底部抽屉收起时，同步显示「景点数 + 规划名」
        function updateSheetSummary() {
            const countEl = document.getElementById('summary-count');
            const titleEl = document.getElementById('summary-title');
            if (countEl) countEl.textContent = waypoints.length + ' 个景点';
            if (titleEl) titleEl.textContent = document.getElementById('plan-title').value || '未命名规划';
        }

        window.movePoint = function(idx, dir) {
            if (idx + dir < 0 || idx + dir >= waypoints.length) return;
            [waypoints[idx], waypoints[idx + dir]] = [waypoints[idx + dir], waypoints[idx]];
            renderRoute(true);
        };

        window.removePoint = function(idx) {
            waypoints.splice(idx, 1);
            renderRoute();
            toast('已删除地点');
        };

        // ============ 账户与认证 ============
        window.closeAuthModal = function() {
            closeModal('auth-modal');
            document.getElementById('auth-username').value = '';
            document.getElementById('auth-password').value = '';
        };

        window.handleAuth = async function(type) {
            const u = document.getElementById('auth-username').value.trim();
            const p = document.getElementById('auth-password').value;
            if (!u || !p) { toast('请输入账号和密码', 'error'); return; }
            if (u.length > 10) { toast('用户名不能超过 10 个字符', 'error'); return; }
            if (p.length > 20) { toast('密码不能超过 20 个字符', 'error'); return; }

            try {
                const res = await fetch('/api/auth/' + type, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: u, password: p })
                });
                const data = await res.json();
                if (data.success) {
                    currentUser = data.user;
                    localStorage.setItem('travel_session', JSON.stringify({
                        user: currentUser, exp: Date.now() + 7 * 24 * 60 * 60 * 1000
                    }));
                    closeAuthModal();
                    updateAuthUI();
                    toast(type === 'login' ? '欢迎回来，' + currentUser.username : '注册成功，欢迎 ' + currentUser.username, 'success');
                } else {
                    toast('失败：' + data.error, 'error');
                }
            } catch (e) { toast('网络请求错误', 'error'); }
        };

        window.logout = function() {
            currentUser = null; currentPlanId = null; waypoints = [];
            localStorage.removeItem('travel_session');
            document.getElementById('plan-title').value = '我的旅行规划';
            renderRoute(); updateAuthUI();
            toast('已退出登录');
        };

        window.createNewPlan = function() {
            if (waypoints.length > 0 && !confirm('新建计划将清空当前界面，确认继续吗？')) return;
            currentPlanId = null; waypoints = [];
            document.getElementById('plan-title').value = '新的旅行规划';
            renderRoute();
            toast('已创建新计划');
        };

        function updateAuthUI() {
            const statusDiv = document.getElementById('user-status');
            if (currentUser) {
                const quotaText = currentUser.role === 'admin' ? '无限制' : \`\${currentUser.used_plans || 0}/\${currentUser.max_plans}\`;
                statusDiv.innerHTML = \`
                    <div class="auth-header">
                        <span style="font-weight:700;">👤 \${currentUser.username}</span>
                        <span style="font-size:11px; background:#fff; padding:2px 8px; border-radius:999px;">配额 \${quotaText}</span>
                    </div>
                    <div class="auth-actions">
                        <button class="btn btn-small btn-outline" onclick="createNewPlan()">＋ 新建</button>
                        <button class="btn btn-small btn-outline" onclick="openHistory()">📂 我的计划</button>
                        <button class="btn btn-small btn-danger-text" onclick="logout()">退出</button>
                    </div>\`;
            } else {
                statusDiv.innerHTML = \`
                    <div class="auth-header">
                        <span>👤 游客模式（不保存）</span>
                        <button class="btn btn-small" onclick="openModal('auth-modal')">登录 / 注册</button>
                    </div>\`;
            }
        }

        // ============ 计划存储、列表与删除 ============
        window.saveToCloud = async function() {
            if (waypoints.length === 0) { toast('请先添加景点！', 'error'); return; }
            if (!currentUser) { toast('请先登录才能云端保存！', 'error'); openModal('auth-modal'); return; }

            const saveBtn = document.getElementById('save-btn');
            const originals = [saveBtn.innerText];
            saveBtn.innerText = '⏳'; saveBtn.disabled = true;
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
                        localStorage.setItem('travel_session', JSON.stringify({ user: currentUser, exp: Date.now() + 7 * 86400 * 1000 }));
                        updateAuthUI();
                        toast('✓ 已创建新规划！', 'success');
                    } else {
                        toast('✓ 规划更新成功！', 'success');
                    }
                } else {
                    toast('保存失败：' + data.error, 'error');
                }
            } catch (err) { toast('网络错误', 'error'); }
            finally { saveBtn.innerText = originals[0]; saveBtn.disabled = false; }
        };

        window.openHistory = async function() {
            if (!currentUser) return;
            const listDiv = document.getElementById('history-list');
            listDiv.innerHTML = '<div style="text-align:center; padding: 20px; color:var(--text-light);">加载中...</div>';
            openModal('history-modal');

            try {
                const res = await fetch(\`/api/plans/list?userId=\${currentUser.id}\`);
                const data = await res.json();
                if (data.success) {
                    listDiv.innerHTML = '';
                    if (data.plans.length === 0) {
                        listDiv.innerHTML = '<div style="text-align:center; color:var(--text-light); padding: 20px;">暂无保存的计划</div>';
                        return;
                    }
                    data.plans.forEach(plan => {
                        const dateStr = new Date(plan.created_at).toLocaleString('zh-CN');
                        listDiv.innerHTML += \`
                            <div class="history-item">
                                <div class="history-item-content" onclick="loadPlan('\${plan.id}')">
                                    <h4>\${plan.title}</h4>
                                    <p>更新时间：\${dateStr}</p>
                                </div>
                                <button class="del-btn" onclick="deletePlan('\${plan.id}')">删除</button>
                            </div>\`;
                    });
                }
            } catch (e) { listDiv.innerHTML = '<div style="color:var(--danger);text-align:center;">拉取失败</div>'; }
        };

        window.loadPlan = async function(id) {
            if (waypoints.length > 0 && currentPlanId !== id && !confirm('加载新计划将覆盖当前界面，确认吗？')) return;

            try {
                const res = await fetch(\`/api/plans/get?planId=\${id}&userId=\${currentUser.id}\`);
                const data = await res.json();
                if (data.success) {
                    currentPlanId = data.plan.id;
                    document.getElementById('plan-title').value = data.plan.title;
                    waypoints = JSON.parse(data.plan.content_json);
                    renderRoute();
                    closeModal('history-modal');
                    toast('✓ 已加载计划', 'success');
                } else {
                    toast('加载失败：' + data.error, 'error');
                }
            } catch (e) { toast('网络错误', 'error'); }
        };

        window.deletePlan = async function(id) {
            if (!confirm('确定要永久删除这份旅行规划吗？此操作无法恢复！')) return;

            try {
                const res = await fetch('/api/plans/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ planId: id, userId: currentUser.id })
                });
                const data = await res.json();

                if (data.success) {
                    if (currentPlanId === id) {
                        currentPlanId = null; waypoints = [];
                        document.getElementById('plan-title').value = '我的旅行规划';
                        renderRoute();
                    }
                    currentUser.used_plans = Math.max(0, (currentUser.used_plans || 1) - 1);
                    localStorage.setItem('travel_session', JSON.stringify({ user: currentUser, exp: Date.now() + 7 * 86400 * 1000 }));
                    updateAuthUI();
                    openHistory();
                    toast('已删除计划');
                } else {
                    toast('删除失败：' + data.error, 'error');
                }
            } catch (e) { toast('网络错误', 'error'); }
        };

        window.exportMD = function() {
            if (waypoints.length === 0) { toast('请先在地图上添加景点！', 'error'); return; }

            const title = document.getElementById('plan-title').value || '旅行规划';
            let md = \`# 旅行规划书：\${title}\\n\\n\`;
            md += \`> 导出时间：\${new Date().toLocaleString('zh-CN')}\\n\\n\`;
            md += \`## 详细日程\\n\\n\`;

            waypoints.forEach((p, index) => {
                const cat = CATEGORIES[p.category] || CATEGORIES.other;
                md += \`### \${index + 1}. [\${cat.icon} \${cat.label}] \${p.name}\\n\`;
                md += \`- **预计到达**: \${p.arriveTime || '--:--'} | **游览**: \${p.duration || '未定'}\\n\`;
                md += \`- **交通方式**: \${p.transport || '未定'} | **费用**: \${p.cost === '0' || !p.cost ? '免费' : p.cost + ' 元'}\\n\\n\`;
                if (p.details) md += \`**游览细节**:\\n> \${p.details.replace(/\\n/g, '\\n> ')}\\n\\n\`;
                md += \`---\\n\\n\`;
            });

            const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = \`\${title.replace(/[^a-zA-Z0-9\\u4e00-\\u9fa5]/g, '_')}_\${Date.now()}.md\`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast('✓ 已导出 Markdown', 'success');
        };

        // 页面初始化
        if (window.innerWidth <= 768) setSheet(true);
        initDragReorder();
        renderRoute();
        updateAuthUI();
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
        if (request.method === "POST" && url.pathname === "/api/auth/register") {
          const { username, password } = await request.json();

          if (!username || username.length > 10) return jsonResponse({ error: "用户名不能超过10个字符" }, 400);
          if (!password || password.length > 20) return jsonResponse({ error: "密码不能超过20个字符" }, 400);

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

        if (request.method === "GET" && url.pathname === "/api/plans/list") {
            const userId = url.searchParams.get("userId");
            if (!userId) return jsonResponse({ error: "参数缺失" }, 400);
            const plans = await env.DB.prepare("SELECT id, title, created_at FROM plans WHERE user_id = ? ORDER BY created_at DESC").bind(userId).all();
            return jsonResponse({ success: true, plans: plans.results });
        }

        if (request.method === "GET" && url.pathname === "/api/plans/get") {
            const planId = url.searchParams.get("planId");
            const userId = url.searchParams.get("userId");
            const plan = await env.DB.prepare("SELECT id, title, content_json FROM plans WHERE id = ? AND user_id = ?").bind(planId, userId).first();
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
             const result = await env.DB.prepare("UPDATE plans SET title = ?, content_json = ? WHERE id = ? AND user_id = ?").bind(title, JSON.stringify(points), planId, userId).run();
             if (result.meta.changes === 0) return jsonResponse({ error: "更新失败：未找到原始文件或无权修改" }, 403);
             return jsonResponse({ success: true, action: 'update', planId });
          } else {
             const user = await env.DB.prepare("SELECT role, max_plans FROM users WHERE id = ?").bind(userId).first();
             if (user && user.role !== 'admin') {
                 const count = await env.DB.prepare("SELECT COUNT(*) as c FROM plans WHERE user_id = ?").bind(userId).first();
                 if (count && count.c >= user.max_plans) {
                    return jsonResponse({ error: `已达到存储上限 (${user.max_plans}条)` }, 403);
                 }
             }
             const newPlanId = crypto.randomUUID();
             await env.DB.prepare("INSERT INTO plans (id, user_id, title, content_json) VALUES (?, ?, ?, ?)").bind(newPlanId, userId, title, JSON.stringify(points)).run();
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
