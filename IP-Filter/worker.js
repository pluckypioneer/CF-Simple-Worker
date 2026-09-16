/**
 * 完整地区名称映射 (全球主要国家/地区降级映射表)
 */
const REGION_MAP = {
    // 亚太地区 (Asia Pacific)
    'CN': '中国大陆', 'JP': '日本', 'KR': '韩国', 'SG': '新加坡', 'HK': '中国香港', 'TW': '中国台湾',
    'MY': '马来西亚', 'TH': '泰国', 'VN': '越南', 'PH': '菲律宾', 'ID': '印尼', 'IN': '印度',
    'AU': '澳大利亚', 'NZ': '新西兰', 'KH': '柬埔寨', 'MO': '中国澳门', 'BD': '孟加拉', 'PK': '巴基斯坦',
    'NP': '尼泊尔', 'MN': '蒙古', 'LK': '斯里兰卡', 'LA': '老挝', 'BN': '文莱', 'MM': '缅甸',
    'BT': '不丹', 'MV': '马尔代夫', 'AF': '阿富汗', 'TJ': '塔吉克斯坦', 'TM': '土库曼斯坦', 'TL': '东帝汶',
    'FJ': '斐济', 'PG': '巴布亚新几内亚', 'SB': '所罗门群岛', 'VU': '瓦努阿图', 'WS': '萨摩亚', 'TO': '汤加',

    // 北美洲 (North America)
    'US': '美国', 'CA': '加拿大', 'MX': '墨西哥', 'PR': '波多黎各', 'GU': '关岛', 'PM': '圣皮埃尔和密克隆',
    'BM': '百慕大', 'GL': '格陵兰',

    // 欧洲 (Europe)
    'GB': '英国', 'UK': '英国', 'DE': '德国', 'FR': '法国', 'NL': '荷兰', 'IT': '意大利',
    'ES': '西班牙', 'PT': '葡萄牙', 'RU': '俄罗斯', 'UA': '乌克兰', 'PL': '波兰', 'SE': '瑞典',
    'FI': '芬兰', 'NO': '挪威', 'DK': '丹麦', 'IS': '冰岛', 'IE': '爱尔兰', 'BE': '比利时',
    'LU': '卢森堡', 'CH': '瑞士', 'AT': '奥地利', 'CZ': '捷克', 'HU': '匈牙利', 'RO': '罗马尼亚',
    'BG': '保加利亚', 'GR': '希腊', 'TR': '土耳其', 'HR': '克罗地亚', 'RS': '塞尔维亚', 'SI': '斯洛文尼亚',
    'SK': '斯洛伐克', 'EE': '爱沙尼亚', 'LV': '拉脱维亚', 'LT': '立陶宛', 'MD': '摩尔多瓦', 'AL': '阿尔巴尼亚',
    'BA': '波黑', 'ME': '黑山', 'MK': '北马其顿', 'CY': '塞浦路斯', 'MT': '马耳他', 'BY': '白俄罗斯',
    'GE': '格鲁吉亚', 'AM': '亚美尼亚', 'AZ': '阿塞拜疆', 'LI': '列支敦士登', 'AD': '安道尔', 'MC': '摩纳哥',

    // 南美洲与中美洲 (South & Central America)
    'BR': '巴西', 'AR': '阿根廷', 'CL': '智利', 'CO': '哥伦比亚', 'PE': '秘鲁', 'EC': '厄瓜多尔',
    'UY': '乌拉圭', 'PY': '巴拉圭', 'VE': '委内瑞拉', 'BO': '玻利维亚', 'PA': '巴拿马', 'CR': '哥斯达黎加',
    'GT': '危地马拉', 'HN': '洪都拉斯', 'SV': '萨尔瓦多', 'NI': '尼加拉瓜', 'JM': '牙买加', 'DO': '多米尼加',
    'BS': '巴哈马', 'TT': '特立尼达和多巴哥', 'BB': '巴巴多斯', 'BZ': '伯利兹', 'HT': '海地', 'CU': '古巴',

    // 中东与非洲 (Middle East & Africa)
    'ZA': '南非', 'EG': '埃及', 'MA': '摩洛哥', 'DZ': '阿尔及利亚', 'TN': '突尼斯', 'NG': '尼日利亚',
    'KE': '肯尼亚', 'GH': '加纳', 'TZ': '坦桑尼亚', 'UG': '乌干达', 'AE': '阿联酋', 'SA': '沙特阿拉伯',
    'IL': '以色列', 'QA': '卡塔尔', 'BH': '巴林', 'KW': '科威特', 'OM': '阿曼', 'JO': '约旦',
    'LB': '黎巴嫩', 'IQ': '伊拉克', 'KZ': '哈萨克斯坦', 'UZ': '乌兹别克斯坦', 'KG': '吉尔吉斯斯坦',
    'SY': '叙利亚', 'YE': '也门', 'IR': '伊朗', 'PS': '巴勒斯坦', 'AO': '安哥拉', 'MZ': '莫桑比克', 'SN': '塞内加尔'
};

/**
 * 辅助函数：获取国旗 Emoji (全量清洗 + 逻辑保护)
 */
function getFlagEmoji(code) {
    if (!code || typeof code !== 'string') return '🇺🇳';
    
    // 强制去除空格并转换为大写，彻底避免大小写失误
    const cleanCode = code.trim().toUpperCase();
    
    if (cleanCode === 'TW') return '🇹🇼';
    if (cleanCode === 'UK' || cleanCode === 'GB') return '🇬🇧';
    if (cleanCode.length !== 2) return '🇺🇳'; 
    
    const codePoints = cleanCode.split('').map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
}

/**
 * 辅助函数：数字转上标
 */
function toSuperScript(num) {
    const supers = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
    return num.toString().split('').map(c => supers[c] || c).join('');
}

/**
 * 辅助函数：Fisher-Yates 洗牌算法
 */
function shuffleArray(array) {
    let arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * 辅助函数：获取 JSON 数据
 */
async function fetchSourceJson() {
    const jsonUrl = "https://zip.cm.edu.kg/all.json";
    try {
        const res = await fetch(jsonUrl, {
            headers: { 'User-Agent': 'Cloudflare-Worker' },
            cf: { cacheTtl: 300, cacheEverything: true }
        });
        if (res.ok) {
            return await res.json();
        }
    } catch (e) {
        console.error("Fetch source JSON error:", e);
    }
    return null;
}

export default {
    async fetch(request, env) {
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': '*'
                }
            });
        }
        const url = new URL(request.url);

        const limit = parseInt(url.searchParams.get('limit')) || 0;

        // 路径路由: /CFnew/US-JP 或 /edgetunnel/US,JP
        const rawPath = decodeURIComponent(url.pathname);
        const pathMatches = rawPath.replace(/\/+$/, '')
            .match(/^\/(CFnew|edgetunnel)\/(.+)$/);
            
        if (pathMatches) {
            const type = pathMatches[1];
            const regions = pathMatches[2];
            const format = type === 'CFnew' ? 'cf_line_short' : 'line';
            return handleRawRequest(regions, format, limit, request.url);
        }

        if (url.searchParams.has('api')) return handleApiRequest(url);
        if (url.searchParams.has('get_regions')) return handleGetRegions();
        
        if (url.pathname === '/' || url.pathname === '/index') {
            return new Response(getHtml(), { headers: { 'content-type': 'text/html; charset=UTF-8' } });
        }

        return new Response('Not Found', { status: 404 });
    }
};

async function handleGetRegions() {
    try {
        const jsonData = await fetchSourceJson();
        if (!jsonData || !jsonData.list || !jsonData.list.country) {
            return new Response(JSON.stringify({ regions: [], generated_at: "", total_ips: 0 }), { 
                headers: { 'content-type': 'application/json; charset=UTF-8', 'Access-Control-Allow-Origin': '*' } 
            });
        }

        const countryMap = jsonData.list.country;
        const sortedCodes = Object.keys(countryMap).sort((a, b) => countryMap[b] - countryMap[a]);

        const sampleMetaMap = {};
        if (Array.isArray(jsonData.data)) {
            for (const item of jsonData.data) {
                if (item && item.meta && item.meta.country) {
                    const c = item.meta.country.toUpperCase();
                    if (!sampleMetaMap[c]) {
                        sampleMetaMap[c] = item.meta;
                    }
                }
            }
        }

        const regionsDetail = sortedCodes.map(code => {
            const sampleMeta = sampleMetaMap[code] || {};
            const name = sampleMeta.country_cn || REGION_MAP[code] || code;
            
            // 绝不使用源 JSON 里不稳定的 country_emoji 字段，100% 走你的算法生成
            const flag = getFlagEmoji(code);

            return {
                code,
                name,
                flag,
                count: countryMap[code] || 0
            };
        });

        return new Response(JSON.stringify({
            regions: regionsDetail,
            generated_at: jsonData.generated_at || "",
            total_ips: jsonData.list.ips || 0
        }), { 
            headers: { 
                'content-type': 'application/json; charset=UTF-8',
                'Access-Control-Allow-Origin': '*'
            } 
        });
    } catch (e) {
        return new Response(JSON.stringify({ regions: [], error: e.message }), { 
            headers: { 'content-type': 'application/json; charset=UTF-8', 'Access-Control-Allow-Origin': '*' },
            status: 500
        });
    }
}

async function handleApiRequest(url) {
    const regions = url.searchParams.get('region')?.split(',') || [];
    const format = url.searchParams.get('format') || 'line';
    const limit = parseInt(url.searchParams.get('limit')) || 0;
    return handleRawRequest(regions.join(','), format, limit, url.toString());
}

async function handleRawRequest(regionStr, format, limit = 0, requestUrl = null) {
    const decoded = decodeURIComponent(regionStr);
    const targetRegions = decoded.split(/[,-]/)
                                 .map(r => r.trim().toUpperCase())
                                 .filter(r => r);
    
    let needBase64 = false;
    if (requestUrl) {
        const urlObj = new URL(requestUrl);
        needBase64 = urlObj.searchParams.has('base64') && urlObj.searchParams.get('base64') !== '0';
    }

    try {
        const jsonData = await fetchSourceJson();
        if (!jsonData || !Array.isArray(jsonData.data)) {
            return new Response("Error: Unable to load node data", { status: 500 });
        }

        const regionPools = {};
        targetRegions.forEach(r => regionPools[r] = []);

        const seenIpPorts = new Set();

        for (const item of jsonData.data) {
            if (!item) continue;
            const meta = item.meta || {};
            const code = (meta.country || '').toUpperCase();

            if (!regionPools[code]) continue;

            const ip = item.ip;
            if (!ip) continue;

            const ports = Array.isArray(item.port) && item.port.length > 0 ? item.port : [443];

            for (const port of ports) {
                const ipPort = `${ip}:${port}`;
                if (!seenIpPorts.has(ipPort)) {
                    seenIpPorts.add(ipPort);
                    regionPools[code].push({
                        ipPort,
                        code,
                        countryCn: meta.country_cn || REGION_MAP[code] || code,
                        countryEmoji: getFlagEmoji(code)
                    });
                }
            }
        }

        let selectedItems = [];

        for (const region of targetRegions) {
            const pool = regionPools[region];
            if (!pool || pool.length === 0) continue;
            
            if (limit > 0 && pool.length > limit) {
                const shuffled = shuffleArray(pool);
                selectedItems.push(...shuffled.slice(0, limit));
            } else {
                selectedItems.push(...pool);
            }
        }

        const processed = [];
        const isCFStyle = format.startsWith('cf') || format === 'comma';
        const isShortName = format.includes('short');
        const isLineSeparated = format.includes('line');
        const regionCounters = {}; 

        for (const item of selectedItems) {
            const { ipPort, code, countryCn, countryEmoji } = item;
            const flag = countryEmoji;
            const name = countryCn;

            if (isCFStyle) {
                regionCounters[code] = (regionCounters[code] || 0) + 1;
                const countStr = toSuperScript(regionCounters[code]);
                const port = ipPort.split(':')[1] || ''; 
                
                let nodeName = `${flag} ${name}${countStr}`;
                if (!isShortName) nodeName += `-${port}`;
                
                processed.push(`${ipPort}#${nodeName}`);
            } else {
                processed.push(`${ipPort}#${flag} ${name}`);
            }
        }

        const separator = (format.includes('comma') && !isLineSeparated) ? ',' : '\n';
        let resultStr = processed.join(separator);

        if (needBase64) {
            resultStr = btoa(unescape(encodeURIComponent(resultStr)));
        }

        return new Response(resultStr, { 
            headers: { 
                'content-type': 'text/plain; charset=UTF-8',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
            } 
        });

    } catch (e) {
        return new Response("Error processing request: " + e.message, { status: 500 });
    }
}

function getHtml() {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cloudflare GeoIP Filter</title>
    <link rel="icon" href="https://www.cloudflare.com/favicon.ico" type="image/x-icon">
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = { darkMode: 'class' }
    </script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Fira+Code&display=swap');
        body { font-family: 'Inter', sans-serif; transition: background 0.3s, color 0.3s; }
        
        .font-emoji { font-family: "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", emoji; }
        
        .dark { background-color: #0f172a; color: #f8fafc; }
        .light { background-color: #f1f5f9; color: #0f172a; }
        .glass { border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(10px); }
        .region-card { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); border: 2px solid transparent; }
        .region-card:hover { transform: translateY(-2px); }
        .region-card.active { border-color: #3b82f6 !important; background-color: rgba(59,130,246,0.1) !important; transform: scale(1.03); font-weight: 700; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.2); }
        .fira { font-family: 'Fira Code', monospace; }
        .dropdown-menu { transform-origin: top right; transition: all 0.2s ease-out; transform: scale(0.95); opacity: 0; pointer-events: none; }
        .dropdown-menu.open { transform: scale(1); opacity: 1; pointer-events: auto; }
        
        .link-menu { 
            transform-origin: top center;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); 
            transform: translate(-50%, -10px) scale(0.95);
            opacity: 0; 
            pointer-events: none; 
        }
        .group:hover .link-menu, 
        .link-menu.open {
            transform: translate(-50%, 0) scale(1);
            opacity: 1;
            pointer-events: auto;
        }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { margin: 4px 0; background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; }
        
        .btn-cfnew { background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; border: none; border-radius: 1rem; font-weight: 700; box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3); transition: all 0.2s ease; cursor: pointer; }
        .btn-cfnew:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4); filter: brightness(1.1); }
        .btn-cfnew:active { transform: translateY(0); }
        
        .btn-edge { background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 1rem; font-weight: 700; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3); transition: all 0.2s ease; cursor: pointer; }
        .btn-edge:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4); filter: brightness(1.1); }
        .btn-edge:active { transform: translateY(0); }

        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }

        #toast-container {
            position: fixed;
            top: 24px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 12px;
            pointer-events: none;
        }
        .toast {
            pointer-events: auto;
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 14px 24px;
            border-radius: 9999px;
            font-weight: 600;
            font-size: 14px;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
            backdrop-filter: blur(12px);
            animation: slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            max-width: 90vw;
            border: 1px solid rgba(255,255,255,0.2);
        }
        .toast-success { background-color: rgba(16, 185, 129, 0.9); color: white; } 
        .toast-error { background-color: rgba(239, 68, 68, 0.9); color: white; } 
        
        @keyframes slideIn {
            from { transform: translateY(-100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeOut {
            from { transform: translateY(0); opacity: 1; }
            to { transform: translateY(-20px); opacity: 0; }
        }
    </style>
</head>
<body class="light min-h-screen pb-10 selection:bg-blue-500 selection:text-white" onclick="closeAllDropdowns(event)">
    <div id="toast-container"></div>

    <nav class="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center mb-8 shadow-sm">
        <div class="flex items-center gap-3 font-bold text-xl">
            <div class="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500 text-white">
                <i data-lucide="globe-2" class="w-5 h-5"></i>
            </div>
            <span class="text-slate-800 dark:text-slate-100 tracking-tight">CF GeoIP Filter</span>
        </div>

        <div class="flex items-center gap-3">
            <div class="relative">
                <button onclick="toggleDropdown(event)" class="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm">
                    <i data-lucide="sun" class="w-5 h-5" id="themeIcon"></i>
                </button>
                <div id="themeDropdown" class="dropdown-menu absolute right-0 top-12 w-32 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-1.5 flex flex-col gap-1 z-50 text-slate-700 dark:text-slate-200">
                    <button onclick="setThemeMode('system')" class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition text-sm font-semibold theme-opt" data-mode="system"><i data-lucide="monitor" class="w-4 h-4"></i> 系统</button>
                    <button onclick="setThemeMode('light')" class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition text-sm font-semibold theme-opt" data-mode="light"><i data-lucide="sun" class="w-4 h-4"></i> 浅色</button>
                    <button onclick="setThemeMode('dark')" class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition text-sm font-semibold theme-opt" data-mode="dark"><i data-lucide="moon" class="w-4 h-4"></i> 深色</button>
                </div>
            </div>
        </div>
    </nav>
    
    <main class="max-w-5xl mx-auto px-4 md:px-6 flex flex-col gap-8">
        <div class="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl glass shadow-xl border border-slate-200 dark:border-slate-800">
            
            <div class="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
                <div>
                    <h2 class="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-2">
                        <i data-lucide="map-pin" class="w-4 h-4"></i> 全球地区库
                    </h2>
                    <div id="dataTime" class="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <i data-lucide="clock" class="w-3.5 h-3.5"></i> 数据加载中...
                    </div>
                </div>
                <div class="flex gap-3 w-full md:w-auto mt-4 md:mt-0">
                    <button onclick="randomSelect()" class="flex-1 md:flex-none px-5 py-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-sm font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-800/50 transition flex items-center justify-center gap-2">
                        <i data-lucide="dices" class="w-4 h-4"></i> 随机抽选
                    </button>
                    <button onclick="selectAll()" class="flex-1 md:flex-none px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-bold text-blue-600 dark:text-blue-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition">全选 / 清空</button>
                </div>            
            </div>
            
            <!-- 取消了 max-h-[420px] 与 overflow-y-auto，直接撑开全量渲染 -->
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 p-1" id="regionGrid">
                <div class="col-span-full py-12 text-center text-slate-400 flex flex-col items-center gap-3">
                    <i data-lucide="loader-2" class="w-8 h-8 animate-spin"></i>
                    <span class="text-sm font-medium">正在解析 JSON 数据...</span>
                </div>
            </div>
            
            <div class="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              <button onclick="autoRun('cf_comma_short')" class="btn-cfnew h-14 text-lg flex items-center justify-center gap-3"><i data-lucide="box" class="w-5 h-5"></i><span>提取 CFnew 格式</span></button>
              <button onclick="autoRun('cf_line_short')" class="btn-edge h-14 text-lg flex items-center justify-center gap-3"><i data-lucide="zap" class="w-5 h-5"></i><span>提取 Edgetunnel 格式</span></button>
            </div>
            <div id="loadingState" class="hidden text-center py-4 text-slate-500 animate-pulse text-sm mt-2"><i data-lucide="loader-2" class="animate-spin inline mr-2"></i> 数据处理中...</div>
        </div>
        
        <div class="bg-white dark:bg-slate-900 rounded-3xl glass shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center bg-slate-50 dark:bg-slate-800/50 gap-4">
                <div class="flex items-center gap-2 self-start sm:self-center"><i data-lucide="terminal-square" class="w-4 h-4 text-blue-500"></i><span id="stats" class="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">WAITING FOR INPUT...</span></div>
                
                <div class="flex items-center gap-3 w-full sm:w-auto">
                    <div class="flex items-center bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 shadow-sm" title="单地区提取数量上限 (0为不限制)">
                        <i data-lucide="filter" class="w-4 h-4 text-slate-400 mr-2"></i>
                        <input id="limitInput" type="number" min="0" value="10" class="w-12 bg-transparent text-sm font-bold text-center outline-none text-slate-700 dark:text-slate-200 font-mono focus:text-blue-500 transition-colors" placeholder="0">
                        <span class="text-xs font-medium text-slate-400 ml-1">MAX</span>
                    </div>
                    <button onclick="copy()" class="flex-1 sm:flex-none bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-600 transition flex items-center justify-center gap-2 shadow-sm"><i data-lucide="copy" class="w-4 h-4"></i> 复制</button>
                    
                    <div class="relative group flex-1 sm:flex-none">
                        <button id="linkBtn" onclick="toggleLinkMenu(event)" class="w-full sm:w-auto bg-slate-800 dark:bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition flex items-center justify-center gap-2 shadow-md"><i data-lucide="link" class="w-4 h-4"></i> API 订阅</button>
                        
                        <div id="linkMenu" class="link-menu absolute top-full left-1/2 w-48 pt-3 z-50">
                            <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-2 flex flex-col gap-1 ring-1 ring-black/5">
                                <div class="text-[10px] text-center text-slate-400 font-bold uppercase tracking-wider py-2">选择订阅格式</div>
                                <button onclick="generateLink('CFnew')" class="px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl transition text-left flex items-center gap-2"><i data-lucide="box" class="w-4 h-4 text-blue-500"></i> CFnew</button>
                                <button onclick="generateLink('edgetunnel')" class="px-4 py-2.5 hover:bg-emerald-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl transition text-left flex items-center gap-2"><i data-lucide="zap" class="w-4 h-4 text-emerald-500"></i> Edgetunnel</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <textarea id="out" readonly class="w-full h-48 md:h-64 p-6 bg-transparent fira text-[13px] leading-relaxed outline-none resize-y text-slate-700 dark:text-slate-300 custom-scrollbar" placeholder="点击上方按钮提取，数据将显示在这里..."></textarea>
        </div>
    </main>
    
    <footer class="mt-12 py-8">
        <div class="max-w-5xl mx-auto px-6 text-center">
            <div class="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
                <span class="font-bold">特别鸣谢：</span>
                <a href="https://github.com/cmliu/edgetunnel" target="_blank" class="hover:text-blue-500 transition-colors flex items-center gap-1.5"><i data-lucide="github" class="w-4 h-4"></i> CM</a>
                <a href="https://github.com/byJoey/cfnew" target="_blank" class="hover:text-blue-500 transition-colors flex items-center gap-1.5"><i data-lucide="github" class="w-4 h-4"></i> Joey</a>
            </div>
        </div>
    </footer>
    
    <script>
        function showToast(message, type = 'success') {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            const icon = type === 'success' ? '<i data-lucide="check-circle-2" class="w-5 h-5"></i>' : '<i data-lucide="alert-circle" class="w-5 h-5"></i>';
            toast.className = 'toast ' + (type === 'success' ? 'toast-success' : 'toast-error');
            toast.innerHTML = icon + '<span>' + message + '</span>';
            container.appendChild(toast);
            lucide.createIcons();
            setTimeout(() => {
                toast.style.animation = 'fadeOut 0.3s forwards';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        let selected = []; let fmt = 'line'; let allRegions = [];
        
        async function init() {
            try {
                const res = await fetch('?get_regions=1');
                const data = await res.json();
                allRegions = data.regions || [];
                
                if (data.generated_at) {
                    const timeStr = new Date(data.generated_at).toLocaleString('zh-CN');
                    document.getElementById('dataTime').innerHTML = '<i data-lucide="clock" class="w-3.5 h-3.5"></i> 数据更新于: ' + timeStr + ' (共 ' + data.total_ips + ' 个原生 IP)';
                }

                const grid = document.getElementById('regionGrid');
                grid.innerHTML = allRegions.map(item => 
                    '<button onclick="toggle(\\'' + item.code + '\\')" id="r-' + item.code + '" class="region-card p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-2 border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 cursor-pointer shadow-sm">' +
                        '<div class="flex items-center gap-2 overflow-hidden">' +
                            '<span class="text-xl flex-shrink-0 font-emoji">' + (item.flag || '') + '</span>' +
                            '<span class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">' + (item.name || item.code) + '</span>' +
                        '</div>' +
                        '<span class="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-mono flex-shrink-0">' + (item.count || 0) + '</span>' +
                    '</button>'
                ).join('');
                lucide.createIcons();
                
                selected.forEach(r => {
                    const el = document.getElementById('r-' + r);
                    if(el) el.classList.add('active');
                });
            } catch(e) { console.error(e); }
        }

        function toggle(r) {
            const el = document.getElementById('r-' + r);
            if(!el) return;
            if(selected.includes(r)) { selected = selected.filter(i => i !== r); el.classList.remove('active'); } 
            else { selected.push(r); el.classList.add('active'); }
        }

        function selectAll() {
            if(selected.length === allRegions.length) { 
                selected = []; 
                document.querySelectorAll('.region-card').forEach(el => el.classList.remove('active')); 
            } else { 
                selected = allRegions.map(i => i.code); 
                document.querySelectorAll('.region-card').forEach(el => el.classList.add('active')); 
            }
        }
        
        async function autoRun(format) {
            fmt = format;
            const btns = document.querySelectorAll('.btn-cfnew, .btn-edge');
            btns.forEach(b => b.style.opacity = '0.5'); btns.forEach(b => b.style.pointerEvents = 'none');
            document.getElementById('loadingState').classList.remove('hidden');
            await fetchIps();
            btns.forEach(b => b.style.opacity = '1'); btns.forEach(b => b.style.pointerEvents = 'auto');
            document.getElementById('loadingState').classList.add('hidden');
        }
        
        async function fetchIps() {
            if(selected.length === 0) { showToast('请至少选择一个地区！', 'error'); return; }
            const limitVal = document.getElementById('limitInput').value;
            const limit = parseInt(limitVal) || 0;
            try {
                const res = await fetch('?api=1&region=' + selected.join(',') + '&format=' + fmt + '&limit=' + limit);
                const data = await res.text();
                document.getElementById('out').value = data;
                const isComma = fmt.includes('comma') || fmt === 'comma';
                const count = data ? (isComma ? data.split(',').length : data.trim().split('\\n').length) : 0;
                document.getElementById('stats').innerText = 'SUCCESS: ' + count + ' EXTRACTED';
                document.getElementById('out').scrollIntoView({ behavior: 'smooth', block: 'center' });
                showToast('成功提取 ' + count + ' 个项目', 'success');
            } catch(e) { showToast('获取数据失败，请重试', 'error'); console.error(e); }
        }
        
        function copy() {
            const out = document.getElementById('out');
            if(!out.value) { showToast('没有内容可复制', 'error'); return; }
            navigator.clipboard.writeText(out.value);
            showToast('内容已复制到剪贴板', 'success');
        }

        function randomSelect() {
            selected = [];
            document.querySelectorAll('.region-card.active').forEach(el => el.classList.remove('active'));
            const minSelect = 1;
            const maxSelect = Math.min(8, allRegions.length);
            const finalCount = Math.floor(Math.random() * (maxSelect - minSelect + 1)) + minSelect;
            
            let tempArray = [...allRegions];
            for (let i = tempArray.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [tempArray[i], tempArray[j]] = [tempArray[j], tempArray[i]];
            }
            
            const selectedRegions = tempArray.slice(0, finalCount);
            selectedRegions.forEach(r => toggle(r.code));
            showToast('🎲 随机选中了 ' + finalCount + ' 个地区', 'success');
        }

        function toggleLinkMenu(e) {
            e.stopPropagation();
            document.getElementById('linkMenu').classList.toggle('open');
        }

        function generateLink(type) {
            if(selected.length === 0) { showToast('请先选择地区！', 'error'); return; }
            const limitVal = document.getElementById('limitInput').value;
            const limit = parseInt(limitVal) || 0;
            
            let urlObj = new URL(window.location.origin + '/' + type + '/' + selected.join('-'));
            if (limit > 0) urlObj.searchParams.set('limit', limit);
            
            navigator.clipboard.writeText(urlObj.toString());
            let msg = '【' + type + '】订阅地址已复制';
            if(limit > 0) msg += '\\n(已限制最大 ' + limit + ' 个)';
            
            showToast(msg, 'success');
            document.getElementById('linkMenu').classList.remove('open');
        }

        let currentThemeMode = localStorage.getItem('themeMode') || 'system';
        function applyTheme() {
            let isDark = false;
            if (currentThemeMode === 'system') { isDark = window.matchMedia('(prefers-color-scheme: dark)').matches; } 
            else { isDark = currentThemeMode === 'dark'; }
            
            document.documentElement.classList.toggle('dark', isDark); 
            document.body.classList.toggle('dark', isDark); 
            document.body.classList.toggle('light', !isDark);
            
            const icon = document.getElementById('themeIcon');
            if(icon) {
                icon.setAttribute('data-lucide', isDark ? 'moon' : 'sun');
                lucide.createIcons();
            }
            
            document.querySelectorAll('.theme-opt').forEach(btn => {
                if(btn.dataset.mode === currentThemeMode) { btn.classList.add('text-blue-600', 'dark:text-blue-400', 'bg-slate-100', 'dark:bg-slate-700'); } 
                else { btn.classList.remove('text-blue-600', 'dark:text-blue-400', 'bg-slate-100', 'dark:bg-slate-700'); }
            });
        }
        function setThemeMode(mode) { currentThemeMode = mode; localStorage.setItem('themeMode', mode); applyTheme(); document.getElementById('themeDropdown').classList.remove('open'); }
        function toggleDropdown(e) { e.stopPropagation(); document.getElementById('themeDropdown').classList.toggle('open'); }
        function closeAllDropdowns(e) { 
            document.getElementById('themeDropdown').classList.remove('open');
            document.getElementById('linkMenu').classList.remove('open');
        }
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => { if(currentThemeMode === 'system') applyTheme(); });
        applyTheme(); init(); lucide.createIcons();
    </script>
</body>
</html>
    `;
}
