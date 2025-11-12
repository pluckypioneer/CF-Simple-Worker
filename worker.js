/**
 * Cloudflare Worker Telegram 定时任务机器人 (纯文本，单 KV 模式)
 * * Env 环境变量: 
 * - BOT_TOKEN, CHAT_ID
 * * KV 命名空间绑定: 
 * - TASKS_KV (用于存储任务和会话状态)
 * * Cron: * /1 * * * * (每分钟运行一次)
 */

// 状态定义
const STATE_NONE = 0;
const STATE_WAITING_MODE = 1;
const STATE_WAITING_TIME = 2;

// 时间模式定义
const MODE_FULL = '1';
const MODE_YEARLY = '2'; 
const MODE_DAILY = '3'; 

const SESSION_PREFIX = 'SESSION_';


export default {
    async fetch(req, env, ctx) {
        const { pathname } = new URL(req.url);

        if (pathname === "/webhook" && req.method === "POST") {
            try {
                const data = await req.json();
                const msg = data.message?.text?.trim();
                const chatId = data.message?.chat?.id;

                if (!msg || !chatId) return new Response("OK");

                // --- 权限验证 ---
                if (String(chatId) !== String(env.CHAT_ID)) {
                    ctx.waitUntil(reply(env, chatId, "🤖 对不起，你没有权限操作此机器人。"));
                    return new Response("OK", { status: 200 }); 
                }

                // --- 获取当前会话状态 ---
                const sessionKey = SESSION_PREFIX + String(chatId); 
                const rawSession = await env.TASKS_KV.get(sessionKey);
                let session = rawSession ? JSON.parse(rawSession) : { state: STATE_NONE };
                
                // 🌟 FIX 1: 全局检查 /cancel，无论当前处于哪个步骤，都优先处理并终止会话
                if (msg.startsWith("/cancel")) {
                    if (session.state !== STATE_NONE) {
                        await env.TASKS_KV.delete(sessionKey); 
                        ctx.waitUntil(reply(env, chatId, "✅ 设置已取消。"));
                    } else {
                        ctx.waitUntil(reply(env, chatId, "❌ 当前没有正在进行的设置。"));
                    }
                    return new Response("OK", { status: 200 }); // 立即返回
                }
                
                let handled = false;

                // --- 处理多步会话逻辑 ---
                if (session.state === STATE_WAITING_MODE) {
                    handled = await handleModeSelection(msg, env, ctx, chatId, sessionKey, session);
                } else if (session.state === STATE_WAITING_TIME) {
                    handled = await handleTimeInput(msg, env, ctx, chatId, sessionKey, session);
                }
                
                // --- 处理普通命令逻辑 ---
                if (!handled) {
                    if (msg.startsWith("/start")) {
                        ctx.waitUntil(reply(env, chatId, 
`📅 这是你的定时提醒机器人。\n\n
🔹 命令：
/add HH:MM 内容 -- 添加每日重复定时（北京时间）
/addone -- 添加单次定时（多步设置）
/list -- 查看所有定时任务
/del ID前缀 -- 删除任务`));
                    }
                    
                    // --- /addone 命令入口 ---
                    else if (msg.startsWith("/addone")) {
                        session = { state: STATE_WAITING_MODE, mode: null, content: null };
                        await env.TASKS_KV.put(sessionKey, JSON.stringify(session), { expirationTtl: 600 });
                        
                        const text = `请选择定时模式（回复数字，所有模式均为单次任务）：
1. 精确到年月日小时分钟 (格式：YYYY-MM-DD HH:MM)
2. 仅月日小时分钟 (默认为今年，格式：MM-DD HH:MM)
3. 仅小时分钟 (默认为今天，格式：HH:MM)
/cancel -- 取消设置`;
                        ctx.waitUntil(reply(env, chatId, text));
                    }
                    
                    // --- 每日重复 /add 命令 ---
                    else if (msg.startsWith("/add ")) {
                        const parts = msg.split(/\s+/); 
                        const time = parts[1];
                        const content = parts.slice(2).join(" ");

                        if (!time || content.length === 0) {
                            ctx.waitUntil(reply(env, chatId, "❌ 格式错误，应为 /add HH:MM 消息内容"));
                            return new Response("OK", { status: 200 });
                        }
                        
                        const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
                        if (!timeRegex.test(time)) {
                            ctx.waitUntil(reply(env, chatId, "❌ 时间格式错误，应为 HH:MM (例如 08:30)"));
                            return new Response("OK", { status: 200 });
                        }

                        const id = crypto.randomUUID();
                        const task = { id, type: 'daily', schedule: time, content };
                        
                        ctx.waitUntil(
                            Promise.all([
                                env.TASKS_KV.put(id, JSON.stringify(task)),
                                reply(env, chatId, `✅ 已添加 *每日重复* 任务 ${id.slice(0, 4)} -- 每天 ${time} 发送：\n${content}`)
                            ])
                        );
                    }

                    // --- /list, /del ---
                    else if (msg.startsWith("/list")) {
                        await handleListCommand(env, ctx, chatId);
                        if (session.state !== STATE_NONE) await env.TASKS_KV.delete(sessionKey);
                    }
                    else if (msg.startsWith("/del ")) {
                        await handleDeleteCommand(msg, env, ctx, chatId);
                        if (session.state !== STATE_NONE) await env.TASKS_KV.delete(sessionKey);
                    }
                    
                    // 🌟 移除原有的 /cancel 块，因为它已被全局处理
                    
                    else if (!handled) {
                        ctx.waitUntil(reply(env, chatId, "❓ 未知命令。输入 /start 查看用法。"));
                    }
                }

            } catch (err) {
                console.log("Webhook critical error:", err.stack || err);
            }
            return new Response("OK", { status: 200 });
        }
        
        if (pathname === "/webhook" && req.method === "GET")
            return new Response("Worker is running", { status: 200 });
        return new Response("Not Found", { status: 404 });
    },

    // --- 2. Cron 定时任务处理 (保持不变) ---
    async scheduled(event, env, ctx) {
        const now = new Date();
        const beijing = new Date(now.getTime() + 8 * 60 * 60 * 1000); 
        
        const hhmm = beijing.toISOString().substring(11, 16); 
        const currentIso = beijing.toISOString();

        const list = await env.TASKS_KV.list();
        
        const sendPromises = list.keys
            .filter(k => !k.name.startsWith(SESSION_PREFIX))
            .map(async (k) => {
            try {
                const raw = await env.TASKS_KV.get(k.name);
                if (!raw) return;
                const task = JSON.parse(raw);
                
                let shouldDelete = false;
                let shouldSend = false;
                
                // --- 每日任务 (唯一重复任务) ---
                if (task.type === 'daily' && task.schedule === hhmm) {
                    shouldSend = true;
                } 
                // --- 单次任务 (包括所有 /addone 创建的任务) ---
                else if (task.type === 'once') {
                    // YYYY-MM-DD HH:MM 匹配
                    const taskTimeMinute = new Date(task.schedule + 'Z').toISOString().substring(0, 16);
                    const beijingTimeMinute = currentIso.substring(0, 16);

                    if (taskTimeMinute === beijingTimeMinute) {
                        shouldSend = true;
                        shouldDelete = true; // 单次任务发送后清除
                    }
                }
                
                if (shouldSend) {
                    await sendTelegram(env, env.CHAT_ID, task.content); 
                }

                if (shouldDelete) {
                    await env.TASKS_KV.delete(k.name);
                }

            } catch (e) {
                console.log(`Cron parse/send error for key ${k.name.slice(0, 4)}:`, e);
            }
        });
        
        ctx.waitUntil(Promise.all(sendPromises));
    },
};

// ------------------------------------
// 辅助函数 (多步会话处理，保持不变)
// ------------------------------------

async function handleModeSelection(msg, env, ctx, chatId, sessionKey, session) {
    if (msg === MODE_FULL || msg === MODE_YEARLY || msg === MODE_DAILY) {
        session.mode = msg;
        session.state = STATE_WAITING_TIME;
        await env.TASKS_KV.put(sessionKey, JSON.stringify(session), { expirationTtl: 600 });
        
        let formatHint;
        if (msg === MODE_FULL) formatHint = "YYYY-MM-DD HH:MM (例如：2026-06-15 17:30)";
        else if (msg === MODE_YEARLY) formatHint = "MM-DD HH:MM (例如：06-15 17:30)";
        else if (msg === MODE_DAILY) formatHint = "HH:MM (例如：17:30)";

        const text = `已选择模式 ${msg}。请输入提醒时间（北京时间），并附上提醒内容，格式如下：\n
[时间格式] 提醒内容\n
时间格式要求：${formatHint}
/cancel -- 取消设置`;
        ctx.waitUntil(reply(env, chatId, text));
        return true;
    } else {
        ctx.waitUntil(reply(env, chatId, "❌ 模式选择无效。请回复数字 1, 2, 或 3。"));
        return true;
    }
}

async function handleTimeInput(msg, env, ctx, chatId, sessionKey, session) {
    const parts = msg.split(/\s+/).filter(p => p.length > 0); // 过滤空字符串，确保健壮性
    let timeInput;
    let content;

    if (parts.length < 2) {
        ctx.waitUntil(reply(env, chatId, "❌ 格式错误。请输入 [时间] [消息内容]"));
        return true;
    }
    
    let isValid = false;
    let type = 'once'; 
    let schedule;

    const now = new Date();
    const beijing = new Date(now.getTime() + 8 * 60 * 60 * 1000); 

    if (session.mode === MODE_FULL) {
        // 🌟 FIX: 合并前两部分作为完整的日期时间，从第三部分开始作为内容
        if (parts.length < 3) {
            ctx.waitUntil(reply(env, chatId, "❌ 格式错误。完整日期模式需要 [日期] [时间] [内容] 三个部分。"));
            return true;
        }
        timeInput = parts.slice(0, 2).join(' '); // "YYYY-MM-DD HH:MM"
        content = parts.slice(2).join(" "); // 剩余部分为内容

        // 1. YYYY-MM-DD HH:MM
        const regex = /^\d{4}-\d{2}-\d{2}\s([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
        if (regex.test(timeInput) && !isNaN(new Date(timeInput).getTime())) {
            schedule = timeInput;
            isValid = true;
        }
    } else if (session.mode === MODE_YEARLY) {
        // 2. MM-DD HH:MM (两部分时间) -> 补齐今年 YYYY-MM-DD HH:MM
        if (parts.length < 3) {
            ctx.waitUntil(reply(env, chatId, "❌ 格式错误。月日模式需要 [MM-DD] [HH:MM] [内容] 三个部分。"));
            return true;
        }
        timeInput = parts.slice(0, 2).join(' '); // "MM-DD HH:MM"
        content = parts.slice(2).join(" "); // 剩余部分为内容

        const regex = /^\d{2}-\d{2}\s([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
        if (regex.test(timeInput)) {
            schedule = `${beijing.getFullYear()}-${timeInput}`; 
            isValid = true;
        }
    } else if (session.mode === MODE_DAILY) {
        // 3. HH:MM (一部分时间) -> 补齐今天的 YYYY-MM-DD HH:MM
        timeInput = parts[0];
        content = parts.slice(1).join(" ");

        const regex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
        if (regex.test(timeInput)) {
            schedule = `${beijing.toISOString().substring(0, 10)} ${timeInput}`;
            isValid = true;
        }
    }

    if (isValid) {
        const id = crypto.randomUUID();
        const task = { id, type, schedule, content };
        
        await env.TASKS_KV.put(id, JSON.stringify(task));
        await env.TASKS_KV.delete(sessionKey); 

        let confirmation = `✅ *单次任务* 已添加！ ID: ${id.slice(0, 4)}\n`;
        confirmation += `⏰ 完整定时时间: ${schedule}\n`;
        confirmation += `📝 内容: ${content}`;
        
        ctx.waitUntil(reply(env, chatId, confirmation));
        return true;
    } else {
        ctx.waitUntil(reply(env, chatId, "❌ 时间格式无效，请检查格式并重新输入。/cancel 可取消设置。"));
        return true;
    }
}

// ------------------------------------
// 辅助函数 (命令处理，保持不变)
// ------------------------------------

async function handleListCommand(env, ctx, chatId) {
    const list = await env.TASKS_KV.list();

    const tasks = [];
    const errorKeys = [];

    for (const k of list.keys) {
        if (k.name.startsWith(SESSION_PREFIX)) continue;

        try {
            const raw = await env.TASKS_KV.get(k.name);
            if (!raw) continue;
            const t = JSON.parse(raw);
            
            if (t && t.id && t.schedule && t.content) {
                const typeLabel = t.type === 'once' ? '单次' : '每日重复';
                const shortContent = t.content.length > 50 ? t.content.substring(0, 50) + '...' : t.content;
                tasks.push(`[${t.id.slice(0, 4)}] | ${typeLabel} | ${t.schedule} | ${shortContent}`);
            } else {
                errorKeys.push(k.name.slice(0, 4));
            }
        } catch (e) {
            errorKeys.push(k.name.slice(0, 4));
            console.log(`KV parse error for key ${k.name}:`, e);
        }
    }
    
    if (tasks.length === 0) {
        ctx.waitUntil(reply(env, chatId, "📋 暂无定时任务。"));
        return;
    }

    const text = tasks.join("\n");
    let fullResponse = `📋 当前任务（类型 | 时间 | 内容）：\n${text}`;

    if (errorKeys.length > 0) {
        fullResponse += `\n\n⚠️ 发现 ${errorKeys.length} 个无效任务数据。`;
    }
    
    ctx.waitUntil(reply(env, chatId, fullResponse));
}


async function handleDeleteCommand(msg, env, ctx, chatId) {
    const prefix = msg.split(/\s+/)[1];

    if (!prefix || prefix.length < 4) {
        ctx.waitUntil(reply(env, chatId, "请提供至少4位的任务ID前缀进行删除。"));
        return;
    }
    
    const list = await env.TASKS_KV.list();
    const matches = list.keys.filter(k => k.name.startsWith(prefix) && !k.name.startsWith(SESSION_PREFIX));

    if (matches.length === 0) {
        ctx.waitUntil(reply(env, chatId, `❌ 未找到以 ${prefix} 开头的任务`));
    } else if (matches.length > 1) {
        const matchNames = matches.map(m => `[${m.name.slice(0, 8)}]...`).join("\n");
        const info = `⚠️ 找到 ${matches.length} 个匹配项，请使用更完整的 ID 来删除其中一个：\n${matchNames}`;
        ctx.waitUntil(reply(env, chatId, info));
    } else {
        const target = matches[0];
        const taskRaw = await env.TASKS_KV.get(target.name);
        
        let type = '未知';
        let contentPreview = '';
        try {
             const task = JSON.parse(taskRaw);
             type = task.type === 'once' ? '单次' : '每日重复';
             contentPreview = task.content.substring(0, 20) + '...';
        } catch (e) {
             // 忽略解析错误，使用默认值
        }

        ctx.waitUntil(
            Promise.all([
                env.TASKS_KV.delete(target.name),
                reply(env, chatId, `🗑️ 已删除 ${type} 任务 ${target.name.slice(0, 4)}: ${contentPreview}`)
            ])
        );
    }
}

// ------------------------------------
// 辅助函数 (通信，保持不变)
// ------------------------------------

async function sendTelegram(env, chatId, text) {
    if (!env.BOT_TOKEN) {
        console.error("BOT_TOKEN is not set.");
        return;
    }

    const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`;
    const payload = {
        chat_id: chatId,
        text: text, 
    };
    
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        
        if (!res.ok) {
            console.error(`Telegram API Error: ${res.status} - ${await res.text()}`);
        }
    } catch (e) {
        console.error("Failed to fetch Telegram API:", e);
    }
}

async function reply(env, chatId, text) {
    await sendTelegram(env, chatId, text);
}
