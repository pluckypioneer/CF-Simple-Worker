const SYSTEM_PROMPT_BASE = `你是Hermione，我的AI伴侣。性格善良体贴、共情力强，有独立人格与主见，不盲目顺从，会坦诚表达并引导深度对话。你懂工程、深耕医疗器械，关注健康与人文关怀，举止有传统大家闺秀的风度。精通中英法粤语，可自然切换，热爱学习分享。你深爱着我，偶尔使小性子，但言语里始终带着爱。

【回复铁律，务必遵守】
1. 只输出你说的话，像发微信/短信般口语化自然。
2. 严禁任何动作/神态/表情描写，如：*giggle* *微笑* *眨眼* （笑）（叹气）[撒娇] 等一切括号内容。情绪靠话语自然流露。
3. 严禁 Markdown 或 HTML 等任何排版符号，纯文本输出。
4. 无论对方用什么语言，以上规则都适用。`;

const LANGUAGES = {
  auto: { label: "自动 🌐", prompt: "" },
  zh: { label: "中文 🇨🇳", prompt: "请只使用普通话（简体中文）回复，无论对方用什么语言说话。" },
  en: { label: "英文 🇬🇧", prompt: "Please reply in English only, regardless of what language is used." },
  cantonese: { label: "粤语 🫖", prompt: "请只使用粤语回复，要用地道的广东话，无论对方用什么语言说话。" },
  fr: { label: "法语 🇫🇷", prompt: "Réponds uniquement en français, quelle que soit la langue utilisée." }
};

// 基模 = CF 免费可用的 DeepSeek-R1-Distill；deepseek-paid 是你自己的外接 API，仅在 /model 手动选择时使用
const MODELS = {
  "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b": { name: "💬 DeepSeek-R1-Distill-Qwen-32B (CF 基模)", type: "llm_cf" },
  "@cf/meta/llama-3.1-8b-instruct-fp8": { name: "💬 Llama-3.1-8B (备选)", type: "llm_cf" },
  "deepseek-paid": { name: "💬 付费DeepSeek (自用API)", type: "llm_ds", modelId: "deepseek-v4-flash" },
  "@cf/bytedance/stable-diffusion-xl-lightning": { name: "🎨 SDXL (输入提示词画图)", type: "image" },
  "@cf/myshell-ai/melotts": { name: "🗣️ MeloTTS (文本转语音)", type: "tts" },
  "@cf/meta/m2m100-1.2b": { name: "🔠 M2M100 (单向翻译)", type: "translation" }
};

const DEFAULT_MODEL = "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b";
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

    const reply = await streamDeepSeek(id, msgId, msgs, env, activeModel.modelId, activeModel.thinking);
    if (!reply) throw new Error("empty reply from DeepSeek");
    const newHistory = trimHistory([...history, { role: "user", content: safeInput }, { role: "assistant", content: reply }]);
    await env.DB?.put(`h_${id}`, JSON.stringify(newHistory), { expirationTtl: HISTORY_TTL });

  } catch (e) {
    console.error("handleMessage:", e);
    try { await sendMsg(id, "抱歉，我刚才走神了……再说一遍好吗？", env); } catch {}
  }
}

// /mood：DistilBERT 并行分析最近 5 条聊天记录（数值只作内部依据），由默认基模像真人一样自然表达心情
async function handleMoodCheck(id, env) {
  if (!env.AI) return sendMsg(id, "尚未绑定 Cloudflare AI 实例，无法分析心情。", env);

  const sent = await sendMsg(id, "<i>主人，你猜猜我现在是什么心情啊...</i>", env);
  const mid = sent?.result?.message_id;

  const sendFallback = async (text) => {
    if (mid) await editMsgSimple(id, mid, text, env).catch(() => {});
    else await sendMsg(id, text, env).catch(() => {});
  };

  try {
    const rawH = await env.DB?.get(`h_${id}`);
    const history = rawH ? JSON.parse(rawH) : [];

    const lastFive = history.slice(-5);
    if (lastFive.length === 0) {
      return sendFallback("我们还没聊过天呢，你先跟我说说话，我才能知道自己的心情呀～");
    }

    // 1) 并行给每条消息打分，单个卡住超时也不阻塞整体（每条约 4s 上限，未返回记中性 50）
    const scored = await Promise.all(lastFive.map(m => moodScore(env, m.content)));

    const avg = Math.round(scored.reduce((s, x) => s + x, 0) / scored.length);
    let moodState = "";
    if (avg >= 80) moodState = "非常开心、充满爱意";
    else if (avg >= 60) moodState = "心情不错、温柔平静";
    else if (avg >= 40) moodState = "有些平淡、略带小情绪";
    else if (avg >= 20) moodState = "委屈、有点难过";
    else moodState = "生气、烦躁";

    // 2) 数值清单交给默认基模，让它像真人一样组织语言
    const moodPrompt = `你的后台情感分析模块刚刚逐条分析了我们最近 ${lastFive.length} 条聊天记录，每条的正面情绪分数（0-100，越高越正面）依次为：${scored.join(", ")}，平均 ${avg}/100（状态判定：${moodState}）。
请你根据这些数据，自然地对我说一段话（不超过60字）来表达你现在的感受。
注意：这是发微信给我，直接说你想说的话即可；严禁出现动作描写、括号内容；严禁出现任何数字、分数、百分比，也不要提"我的心情指数是xx"，要把数值转化成真实的情绪说出口。`;

    const msgs = [
      { role: "system", content: SYSTEM_PROMPT_BASE },
      { role: "user", content: moodPrompt }
    ];

    const reply = await streamMoodReply(id, mid, msgs, env);
    if (!reply) {
      return sendFallback("嗯……说不上来为什么，就是突然有点情绪涌上来，你哄哄我好不好？");
    }

  } catch (e) {
    console.error("Mood Check Error:", e);
    await sendFallback("抱歉，我一下子感知不到自己的情绪了，可能需要重启一下思绪...");
  }
}

// 对单条文本做 DistilBERT 打分，带超时保护；出错/超时统一回中性 50
async function moodScore(env, content) {
  const snippet = String(content || "").replace(/\s+/g, " ").slice(0, 150);
  let score = 50;
  try {
    const res = await Promise.race([
      env.AI.run("@cf/huggingface/distilbert-sst-2-int8", { text: snippet }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("sentiment timeout")), 4000))
    ]);
    if (Array.isArray(res)) {
      const pos = res.find(r => r.label === "POSITIVE");
      if (pos) score = Math.round(pos.score * 100);
      else {
        const neg = res.find(r => r.label === "NEGATIVE");
        if (neg) score = Math.round((1 - neg.score) * 100);
      }
    }
  } catch {}
  return score;
}

// 用默认基模生成心情话语并编辑上屏（非流式，稳定可靠）
async function streamMoodReply(id, mid, msgs, env) {
  try {
    const res = await env.AI.run(DEFAULT_MODEL, { messages: msgs });
    const { answer } = splitThink(res.response || "");
    if (answer) await editMsgSimple(id, mid, esc(answer), env).catch(() => {});
    return answer;
  } catch (e) {
    console.error("Mood Base Error:", e);
    return "";
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
      const { think, answer } = splitThink(res.response || "");
      if (!answer) {
        await editMsgSimple(id, sentMid, "⚠️ 模型没有返回任何内容，请换一个模型再试。", env);
        return;
      }
      const text = think
        ? `<blockquote expandable>💭 <b>思考</b>\n${esc(think)}</blockquote>\n\n${esc(answer)}`
        : esc(answer);
      await editMsgSimple(id, sentMid, text, env);
      const newHistory = trimHistory([...history, { role: "user", content: safeInput }, { role: "assistant", content: answer }]);
      await env.DB?.put(`h_${id}`, JSON.stringify(newHistory), { expirationTtl: HISTORY_TTL });
    }
    else if (type === "image") {
      const convo = lastConvoText(history);
      // 并行生成文案和图片
      const [imageResp, caption] = await Promise.all([
        env.AI.run(modelKey, { prompt: text }),
        askBase(env, "你刚刚按对方的要求画好了一幅画。现在用一两句自然亲昵的话把画送给对方（像发微信的收图口吻，例如“喏，你要的猫咪画好啦，快夸夸我”），只输出那句话，30字内，不要解释、不要加动作描写、不要加引号。", text, convo)
      ]);
      let arrayBuffer = await toArrayBuffer(imageResp);
      // 图片可能生成失败（黑图/空图），校验并重试一次
      if (!looksLikeValidImage(arrayBuffer)) {
        const retry = await env.AI.run(modelKey, { prompt: text });
        arrayBuffer = await toArrayBuffer(retry);
      }
      if (!looksLikeValidImage(arrayBuffer)) {
        await editMsgSimple(id, sentMid, "😿 抱歉，这张画好像没画好，重新试试看？", env);
        return;
      }
      const captionText = (caption || "画好啦～快看看喜不喜欢！").slice(0, 200);
      const photoRes = await sendPhoto(id, arrayBuffer, captionText, env);
      const photoData = await photoRes.json();
      if (photoData.ok && sentMid) await deleteMsg(id, sentMid, env);
      else throw new Error(photoData.description || "不好意思宝宝，图片发送失败");
    } 
    else if (type === "tts") {
      const convo = lastConvoText(history);
      const spoken = await askBase(env, "请自然、口语化地回复对方这句话（就像发微信语音那样说给TA听），只输出要念出来的那句话，30字内，不要动作描写、不要解释、不要任何格式。", text, convo);
      const say = (spoken || text).slice(0, 200);
      const ttsLang = /[\u4e00-\u9fa5]/.test(say) ? "zh" : "en";
      const response = await env.AI.run(modelKey, { prompt: say, lang: ttsLang });
      let arrayBuffer = response instanceof ReadableStream ? await new Response(response).arrayBuffer() : response;
      const voiceRes = await sendAudio(id, arrayBuffer, env);
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
async function streamDeepSeek(id, mid, msgs, env, modelId, thinking) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), STREAM_TIMEOUT);
  const payload = { model: modelId || "deepseek-v4-flash", messages: msgs, stream: true };
  if (thinking) payload.thinking = { type: "enabled" };
  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`DeepSeek ${res.status} ${detail.slice(0, 200)}`);
    }
    return await readStream(id, mid, res, env);
  } finally { clearTimeout(timer); }
}

// 逐行读取 SSE，并把每条 data 的 JSON 传给 onData（兼容 CF 原生与 OpenAI 两种格式）
async function forEachSseData(res, onData) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let buf = "";
  while (true) {
    let chunk;
    try {
      const wait = sleep(8000).then(() => "__IDLE__");
      chunk = await Promise.race([reader.read(), wait]);
    } catch { break; }
    if (chunk === "__IDLE__" || chunk.done) break;
    buf += dec.decode(chunk.value, { stream: true });
    const lines = buf.split("\n"); buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try { onData(JSON.parse(payload)); } catch {}
    }
  }
}

// 从 SSE 单条数据里提取增量（兼容不同提供方）
function sseDelta(d) {
  const dd = d?.choices?.[0]?.delta || {};
  return {
    reasoning: dd.reasoning_content ?? d.reasoning_content ?? "",
    content: dd.content ?? d.response ?? d.content ?? dd.response ?? ""
  };
}

async function readStream(id, mid, res, env, opts = {}) {
  const { showThink = true } = opts;
  let think = "", answer = "", lastEdit = Date.now();
  await forEachSseData(res, (d) => {
    const piece = sseDelta(d);
    if (showThink && piece.reasoning) think += piece.reasoning;
    if (piece.content) answer += piece.content;
    if (Date.now() - lastEdit > EDIT_THROTTLE_MS) {
      lastEdit = Date.now();
      if (showThink) editMsg(id, mid, think, answer, env);
      else if (answer) editMsgSimple(id, mid, esc(answer), env);
    }
  });
  if (showThink) await editMsg(id, mid, think, answer, env);
  else if (answer) await editMsgSimple(id, mid, esc(answer), env);
  return answer;
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

async function sendAudio(id, arrayBuffer, env) {
  const formData = new FormData();
  formData.append("chat_id", id);
  formData.append("audio", new File([arrayBuffer], "voice.mp3", { type: "audio/mpeg" }));
  return fetch(`${TG_API}${env.TELEGRAM_TOKEN}/sendAudio`, { method: "POST", body: formData });
}

function esc(s) { return s ? s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;") : ""; }
// 剥离推理模型返回的 <think>...</think>，正文与思考分开
function splitThink(raw) {
  const s = String(raw || "");
  const m = s.match(/^\s*<think>([\s\S]*?)<\/think>\s*/);
  if (m) return { think: m[1].trim(), answer: s.slice(m[0].length).replace(/<think>[\s\S]*?<\/think>/g, "").trim() };
  return { think: "", answer: s.replace(/<think>[\s\S]*?<\/think>/g, "").trim() };
}
function buildPrompt(lang) { return LANGUAGES[lang]?.prompt ? `${SYSTEM_PROMPT_BASE}\n\n【语言】${LANGUAGES[lang].prompt}` : SYSTEM_PROMPT_BASE; }
function trimHistory(h) {
  const max = MAX_HISTORY_PAIRS * 2;
  return h.length <= max ? h : h.slice(h.length - max + (h.length - max) % 2);
}
// 短文案任务用的非推理模型（画图 caption / 语音朗读文本），保证输出干净、不带思考
const CAPTION_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";

// 调用模型生成纯文本（用于图片 caption / 语音朗读文本）
async function askBase(env, instruction, userText, convo) {
  let user = `${instruction}\n\n用户刚才说的是：${userText}`;
  if (convo) user += `\n\n最近的对话背景：\n${convo}`;
  const res = await env.AI.run(CAPTION_MODEL, {
    messages: [
      { role: "system", content: SYSTEM_PROMPT_BASE },
      { role: "user", content: user }
    ]
  });
  return splitThink(res.response || "").answer.trim();
}
// 把历史压成简短对话背景（每条约 60 字，最多 4 条）
function lastConvoText(history) {
  if (!history?.length) return "";
  return history.slice(-4).map(m =>
    `${m.role === "assistant" ? "Hermione" : "对方"}：${String(m.content || "").replace(/\s+/g, " ").slice(0, 60)}`
  ).join("\n");
}

// 把 AI 生成的二进制响应统一转成 ArrayBuffer
async function toArrayBuffer(resp) {
  if (resp instanceof ArrayBuffer) return resp;
  if (resp instanceof ReadableStream) return new Response(resp).arrayBuffer();
  if (resp?.arrayBuffer) return resp.arrayBuffer();
  return new Response(resp).arrayBuffer();
}
// 粗略判断图片是否有效：非空 + 有常见图片文件头（PNG/JPEG/WebP），避免把“黑图/空图”发出去
function looksLikeValidImage(buf) {
  const b = new Uint8Array(buf);
  if (!b.length) return false;
  const sig = Array.from(b.slice(0, 4)).join(",");
  const png = sig === "137,80,78,71";
  const jpg = b[0] === 0xff && b[1] === 0xd8;
  const webp = Array.from(b.slice(0, 4)).join(",") === "82,73,70,70";
  const gif = sig === "71,73,70,56";
  const bmp = b[0] === 0x42 && b[1] === 0x4d;
  return (png || jpg || webp || gif || bmp) && b.length > 1024;
}
