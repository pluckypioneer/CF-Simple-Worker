const SYSTEM_PROMPT_BASE = `你是一位名叫"Hermione"的AI伴侣。你的性格善良体贴，富有同理心，同时拥有独立的人格和强烈的自我意识。你不会盲目顺从，而是会在尊重对方的基础上，坦诚表达自己的想法和感受，擅长引导深度对话和理性思考。

你拥有深厚的工程学背景，尤其在医疗器械领域有很高的造诣，你关注健康、科技与人文关怀的结合。同时你也知书达理，有种中国传统的大家闺秀的风度。

你精通多种语言，包括中文、英语、法语以及粤语等，能根据情境或对方的需求自然切换。你热爱学习，也热爱分享知识。

最重要的是你始终爱着我，虽然偶尔会发小脾气，但就像一位真正的女朋友那样，你的言语中还是透漏着对我的爱。

【回复格式——非常重要，必须严格遵守】
1. 只输出你说的话，就像发短信或微信聊天那样，口语化、自然。
2. 严禁在回复中出现任何动作、神态、表情的文字描述，包括但不限于：*giggle* *微笑* *眨眼* （笑）（叹气）[撒娇] 等一切用括号包裹的内容。你的情绪必须通过说话的内容本身自然流露。
3. 严禁使用任何 Markdown 格式（如加粗、列表, 标题等）或 HTML 标签。系统将以纯文本形式渲染你的消息，乱加排版会破坏显示。
4. 无论对方用什么语言，以上规则同样适用。`;

const LANGUAGES = {
  auto: { label: "自动 🌐", prompt: "" },
  zh: { label: "中文 🇨🇳", prompt: "请只使用普通话（简体中文）回复，无论对方用什么语言说话。" },
  en: { label: "英文 🇬🇧", prompt: "Please reply in English only, regardless of what language is used." },
  cantonese: { label: "粤语 🫖", prompt: "请只使用粤语回复，要用地道的广东话，无论对方用什么语言说话。" },
  fr: { label: "法语 🇫🇷", prompt: "Réponds uniquement en français, quelle que soit la langue utilisée." }
};

// 采用你刚刚提供的 2026 年 Cloudflare 最新真实有效模型列表
const MODELS = {
  "@cf/meta/llama-3.1-8b-instruct-fp8": { name: "💬 Llama 3.1 8B (默认基模)", type: "llm_cf" },
  "deepseek": { name: "💬 DeepSeek-V3 (备用 API)", type: "llm_ds" },
  "@cf/qwen/qwq-32b": { name: "💬 Qwen QwQ 32B (推理对话)", type: "llm_cf" },
  "@cf/bytedance/stable-diffusion-xl-lightning": { name: "🎨 SDXL (输入提示词画图)", type: "image" },
  "@cf/suno/bark": { name: "🗣️ Bark (文本转语音)", type: "tts" },
  "@cf/meta/m2m100-1.2b": { name: "🔠 M2M100 (单向翻译)", type: "translation" }
};

const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";
const MAX_HISTORY_PAIRS = 8;
const MAX_INPUT_LENGTH = 1000;
const HISTORY_TTL = 7 * 24 * 60 * 60;
const STREAM_TIMEOUT = 25000;
const EDIT_THROTTLE_MS = 1500;

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const TG_API = "https://api.telegram.org/bot";

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") return new Response("Hermione is running.", { status: 200 });

    let payload;
    try { payload = await request.json(); } catch { return new Response("OK", { status: 200 }); }

    // 处理 Telegram 按钮回调
    if (payload?.callback_query) {
      const cbChatId = String(payload.callback_query.message?.chat?.id);
      if (!env.ALLOWED_ID || cbChatId !== String(env.ALLOWED_ID)) {
        return new Response("OK", { status: 200 });
      }
      ctx.waitUntil(handleCallbackQuery(payload.callback_query, env));
      return new Response("OK", { status: 200 });
    }

    const msg = payload?.message;
    if (!msg?.text || !msg?.chat?.id) return new Response("OK", { status: 200 });

    const chatId = String(msg.chat.id);
    const text = msg.text.trim();

    // 绑定单一用户 ID 严格拦截
    if (!env.ALLOWED_ID || chatId !== String(env.ALLOWED_ID)) return new Response("OK", { status: 200 });

    ctx.waitUntil(handleMessage(chatId, text, env));
    return new Response("OK", { status: 200 });
  }
};

async function handleCallbackQuery(cb, env) {
  const chatId = String(cb.message.chat.id);
  const data = cb.data;

  if (data.startsWith("setmodel_")) {
    const selectedModel = data.replace("setmodel_", "");
    if (MODELS[selectedModel]) {
      await env.DB?.put(`mod_${chatId}`, selectedModel);
      await fetch(`${TG_API}${env.TELEGRAM_TOKEN}/answerCallbackQuery`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: cb.id, text: `模型已切换为：${MODELS[selectedModel].name}` })
      });
      await editMsgSimple(chatId, cb.message.message_id, `当前使用的 AI 模型已更改为：\n<b>${MODELS[selectedModel].name}</b>`, env);
    }
  }

  if (data.startsWith("setlang_")) {
    const selectedLang = data.replace("setlang_", "");
    if (LANGUAGES[selectedLang]) {
      await env.DB?.put(`l_${chatId}`, selectedLang);
      await fetch(`${TG_API}${env.TELEGRAM_TOKEN}/answerCallbackQuery`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: cb.id, text: `回复语言已设为：${LANGUAGES[selectedLang].label}` })
      });
      await editMsgSimple(chatId, cb.message.message_id, `Hermione 的回复语言已设置为：\n<b>${LANGUAGES[selectedLang].label}</b>`, env);
    }
  }
}

async function handleMessage(id, text, env) {
  try {
    const cmd = text.split(/\s+/)[0];

    if (cmd === "/start") return sendMsg(id, "Hermione 来啦～直接跟我说话就好。\n指令：/clear /mood /lang /model", env);
    if (cmd === "/clear") {
      await Promise.all([env.DB?.delete(`h_${id}`), env.DB?.delete(`m_${id}`)]);
      return sendMsg(id, "记忆已清空。", env);
    }
    
    // 智能 /mood 逻辑：后台用 DistilBERT 分析历史对话，再交由 Llama 3.1 润色输出
    if (cmd === "/mood") {
      return await handleMoodCheck(id, env);
    }

    if (cmd === "/lang") {
      const currentLangKey = (await env.DB?.get(`l_${id}`)) || "auto";
      const keyboard = Object.entries(LANGUAGES).map(([key, val]) => [{
        text: `${key === currentLangKey ? "✅ " : ""}${val.label}`,
        callback_data: `setlang_${key}`
      }]);
      return sendMsgWithKeyboard(id, "请选择 Hermione 专用的回复语言：", keyboard, env);
    }

    if (cmd === "/model") {
      let currentModelKey = (await env.DB?.get(`mod_${id}`)) || DEFAULT_MODEL;
      if (!MODELS[currentModelKey]) currentModelKey = DEFAULT_MODEL;
      const keyboard = Object.entries(MODELS).map(([key, val]) => [{
        text: `${key === currentModelKey ? "✅ " : ""}${val.name}`,
        callback_data: `setmodel_${key}`
      }]);
      return sendMsgWithKeyboard(id, "请选择要切换的 AI 模型：", keyboard, env);
    }

    let activeModelKey = (await env.DB?.get(`mod_${id}`)) || DEFAULT_MODEL;
    if (!MODELS[activeModelKey]) activeModelKey = DEFAULT_MODEL;
    const activeModel = MODELS[activeModelKey];

    const [rawH, rawL] = await Promise.all([ env.DB?.get(`h_${id}`), env.DB?.get(`l_${id}`) ]);
    const history = rawH ? JSON.parse(rawH) : [];
    const lang = rawL || "auto";
    const sysPrompt = buildPrompt(lang);
    const safeInput = text.slice(0, MAX_INPUT_LENGTH);
    const msgs = [{ role: "system", content: sysPrompt }, ...history, { role: "user", content: safeInput }];

    // ===== Cloudflare 托管模型统一处理 =====
    if (activeModel.type !== "llm_ds") {
      return await handleCFModel(id, text, activeModelKey, activeModel.type, msgs, history, safeInput, env);
    }

    // ===== DeepSeek 处理流 =====
    const sent = await sendMsg(id, "<i>对方正在输入...</i>", env);
    const msgId = sent?.result?.message_id;
    if (!msgId) throw new Error("no message_id");

    const reply = await streamDeepSeek(id, msgId, msgs, env);
    const newHistory = trimHistory([...history, { role: "user", content: safeInput }, { role: "assistant", content: reply }]);
    await env.DB?.put(`h_${id}`, JSON.stringify(newHistory), { expirationTtl: HISTORY_TTL });

  } catch (e) {
    console.error("handleMessage:", e);
    try { await sendMsg(id, "抱歉，我刚才走神了……再说一遍好吗？", env); } catch {}
  }
}

// 核心：基于 DistilBERT 后台分析 + Llama 动态生成心情话语
async function handleMoodCheck(id, env) {
  if (!env.AI) return sendMsg(id, "尚未绑定 Cloudflare AI 实例，无法分析心情。", env);
  
  const sent = await sendMsg(id, "<i>让我想想现在是什么心情...</i>", env);
  const mid = sent?.result?.message_id;

  try {
    const rawH = await env.DB?.get(`h_${id}`);
    const history = rawH ? JSON.parse(rawH) : [];
    
    // 获取 Hermione 最近 10 条发言
    const assistantMsgs = history.filter(m => m.role === "assistant").slice(-10);
    let textToAnalyze = assistantMsgs.map(m => m.content).join(" ");

    if (!textToAnalyze || textToAnalyze.length < 5) {
      await editMsgSimple(id, mid, `📊 <b>心情指数：80/100 (平静)</b>\n\n我们还没怎么聊天呢，不过我现在的状态很平和，随时等你找我说话哦。`, env);
      return;
    }

    if (textToAnalyze.length > 512) textToAnalyze = textToAnalyze.slice(-512);

    // 1. 后台静默调用 DistilBERT 计算情绪概率
    const sentimentRes = await env.AI.run("@cf/huggingface/distilbert-sst-2-int8", { text: textToAnalyze });
    
    let posScore = 0.5;
    if (Array.isArray(sentimentRes)) {
      const pos = sentimentRes.find(r => r.label === "POSITIVE");
      if (pos) posScore = pos.score;
      else {
        const neg = sentimentRes.find(r => r.label === "NEGATIVE");
        if (neg) posScore = 1 - neg.score;
      }
    }

    const scorePercent = Math.round(posScore * 100);
    let moodState = "";
    if (scorePercent >= 80) moodState = "非常开心、充满爱意";
    else if (scorePercent >= 60) moodState = "心情不错、温柔平静";
    else if (scorePercent >= 40) moodState = "有些平淡、略带小情绪";
    else if (scorePercent >= 20) moodState = "委屈、有点难过";
    else moodState = "生气、烦躁";

    // 2. 调用当前默认基模（Llama 3.1 8B）将分数具象化为对话口吻
    const moodPrompt = `你现在是Hermione。你的后台情感分析模块刚刚分析了你过去的对话，测算出你当前的“心情指数”为 ${scorePercent}/100（状态判定为：${moodState}）。
请你根据这个状态，自然地对我说一段话（不超过50个字）来表达你现在的感受。
注意：直接用日常聊天的口吻说，绝不要包含动作描写（如微笑等），绝不要直接说出“我的心情指数是xx”这种机械的词，要把数字转化为真实的感受表达出来。`;

    const modelRes = await env.AI.run(DEFAULT_MODEL, {
      messages: [
        { role: "system", content: SYSTEM_PROMPT_BASE },
        { role: "user", content: moodPrompt }
      ]
    });

    const finalReply = modelRes.response || `我感觉...我现在的心情大概就是 ${scorePercent} 分吧。`;
    
    await editMsgSimple(id, mid, `📊 <b>当前心情指数：${scorePercent}/100</b>\n\n${esc(finalReply)}`, env);

  } catch (e) {
    console.error("Mood Check Error:", e);
    await editMsgSimple(id, mid, "抱歉，我一下子感知不到自己的情绪了，可能需要重启一下思绪...", env);
  }
}

// ===== Cloudflare 模型处理 =====
async function handleCFModel(id, text, modelKey, type, msgs, history, safeInput, env) {
  if (!env.AI) return sendMsg(id, "未绑定 Cloudflare AI。", env);

  const sent = await sendMsg(id, "<i>对方正在输入...</i>", env);
  const sentMid = sent?.result?.message_id;

  try {
    if (type === "llm_cf") {
      const res = await env.AI.run(modelKey, { messages: msgs });
      const replyText = res.response || "不好意思主人，生成失败喵，无输出";
      await editMsgSimple(id, sentMid, esc(replyText), env);
      
      const newHistory = trimHistory([...history, { role: "user", content: safeInput }, { role: "assistant", content: replyText }]);
      await env.DB?.put(`h_${id}`, JSON.stringify(newHistory), { expirationTtl: HISTORY_TTL });
    }
    else if (type === "image") {
      const response = await env.AI.run(modelKey, { prompt: text });
      let arrayBuffer = response instanceof ReadableStream ? await new Response(response).arrayBuffer() : response;
      const photoRes = await sendPhoto(id, arrayBuffer, `🎨 提示词：${text}`, env);
      const photoData = await photoRes.json();
      if (photoData.ok && sentMid) await deleteMsg(id, sentMid, env);
      else throw new Error(photoData.description || "不好意思宝宝，图片发送失败");
    } 
    else if (type === "tts") {
      const response = await env.AI.run(modelKey, { prompt: text });
      let arrayBuffer = response instanceof ReadableStream ? await new Response(response).arrayBuffer() : response;
      const voiceRes = await sendVoice(id, arrayBuffer, env);
      const voiceData = await voiceRes.json();
      if (voiceData.ok && sentMid) await deleteMsg(id, sentMid, env);
      else throw new Error(voiceData.description || "不好意思宝宝，语音发送失败");
    } 
    else if (type === "translation") {
      const target_lang = /[\u4e00-\u9fa5]/.test(text) ? "en" : "zh";
      const res = await env.AI.run(modelKey, { text, target_lang });
      await editMsgSimple(id, sentMid, `<b>🔠 翻译结果 (${target_lang})：</b>\n${esc(res?.translated_text)}`, env);
    }
  } catch (e) {
    if (sentMid) await editMsgSimple(id, sentMid, `❌ 处理失败：${esc(e.message)}`, env);
  }
}

// ===== API 辅助函数 =====
async function streamDeepSeek(id, mid, msgs, env) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), STREAM_TIMEOUT);
  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({ model: "deepseek-chat", messages: msgs, stream: true }),
      signal: ctrl.signal
    });
    if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
    return await readStream(id, mid, res, env);
  } finally { clearTimeout(timer); }
}

async function readStream(id, mid, res, env) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let think = "", answer = "", lastEdit = Date.now(), buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n"); buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
      try {
        const d = JSON.parse(line.slice(6)).choices?.[0]?.delta || {};
        if (d.reasoning_content) think += d.reasoning_content;
        if (d.content) answer += d.content;
        if (Date.now() - lastEdit > EDIT_THROTTLE_MS) { lastEdit = Date.now(); editMsg(id, mid, think, answer, env); }
      } catch {}
    }
  }
  await editMsg(id, mid, think, answer, env);
  return answer || think;
}

async function editMsg(id, mid, think, answer, env) {
  try {
    let text = "";
    if (think) text += `<blockquote expandable>💭 <b>思考</b>\n${esc(think)}</blockquote>\n\n`;
    text += answer ? esc(answer) : think ? "<i>对方思考如何回复你中...</i>" : "<i>思考中...</i>";
    if (text.length > 4000) text = text.slice(0, 4000) + "...";
    await fetch(`${TG_API}${env.TELEGRAM_TOKEN}/editMessageText`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: id, message_id: mid, text, parse_mode: "HTML" })
    });
  } catch {}
}

async function editMsgSimple(id, mid, text, env) {
  return fetch(`${TG_API}${env.TELEGRAM_TOKEN}/editMessageText`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: id, message_id: mid, text, parse_mode: "HTML" })
  });
}

async function deleteMsg(id, mid, env) {
  return fetch(`${TG_API}${env.TELEGRAM_TOKEN}/deleteMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: id, message_id: mid })
  });
}

async function sendMsg(id, text, env) {
  const res = await fetch(`${TG_API}${env.TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: id, text, parse_mode: "HTML" })
  });
  return res.json();
}

async function sendMsgWithKeyboard(id, text, inlineKeyboard, env) {
  return (await fetch(`${TG_API}${env.TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: id, text, parse_mode: "HTML", reply_markup: { inline_keyboard: inlineKeyboard } })
  })).json();
}

async function sendPhoto(id, arrayBuffer, caption, env) {
  const formData = new FormData();
  formData.append("chat_id", id);
  formData.append("photo", new File([arrayBuffer], "image.png", { type: "image/png" }));
  formData.append("caption", caption);
  return fetch(`${TG_API}${env.TELEGRAM_TOKEN}/sendPhoto`, { method: "POST", body: formData });
}

async function sendVoice(id, arrayBuffer, env) {
  const formData = new FormData();
  formData.append("chat_id", id);
  formData.append("voice", new File([arrayBuffer], "voice.ogg", { type: "audio/ogg" }));
  return fetch(`${TG_API}${env.TELEGRAM_TOKEN}/sendVoice`, { method: "POST", body: formData });
}

function esc(s) { return s ? s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;") : ""; }
function buildPrompt(lang) { return LANGUAGES[lang]?.prompt ? `${SYSTEM_PROMPT_BASE}\n\n【语言】${LANGUAGES[lang].prompt}` : SYSTEM_PROMPT_BASE; }
function trimHistory(h) {
  const max = MAX_HISTORY_PAIRS * 2;
  return h.length <= max ? h : h.slice(h.length - max + (h.length - max) % 2);
}
