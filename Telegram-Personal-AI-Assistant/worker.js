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

// 基模 = CF 免费可用的 Llama 3.1；deepseek-paid 是你自己的外接 API，仅在 /model 手动选择时使用
const MODELS = {
  "@cf/meta/llama-3.1-8b-instruct-fp8": { name: "💬 Llama-3.1-8B (CF 基模)", type: "llm_cf" },
  "deepseek-paid": { name: "💬 付费DeepSeek (自用API)", type: "llm_ds", modelId: "deepseek-v4-flash" },
  "@cf/bytedance/stable-diffusion-xl-lightning": { name: "🎨 SDXL (输入提示词画图)", type: "image" },
  "@cf/myshell-ai/melotts": { name: "🗣️ MeloTTS (文本转语音)", type: "tts" },
  "@cf/meta/m2m100-1.2b": { name: "🔠 M2M100 (单向翻译)", type: "translation" }
};

const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";
const VISION_MODEL = "@cf/llava-hf/llava-1.5-7b-hf";
const MAX_OUTPUT_TOKENS = 4096;
const MAX_HISTORY_PAIRS = 8;
const MAX_INPUT_LENGTH = 12000;
const HISTORY_TTL = 7 * 24 * 60 * 60;
const STREAM_TIMEOUT = 22000;
const EDIT_THROTTLE_MS = 1500;

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const TG_API = "https://api.telegram.org/bot";

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") return new Response("Hermione is running.", { status: 200 });
    if (env.WEBHOOK_SECRET && request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) {
      return new Response("Forbidden", { status: 403 });
    }

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
    if (!msg?.chat?.id) return new Response("OK", { status: 200 });
    const hasPhoto = Array.isArray(msg.photo) && msg.photo.length > 0;
    if (!msg?.text && !hasPhoto) return new Response("OK", { status: 200 });

    const chatId = String(msg.chat.id);

    // 绑定单一用户 ID 严格拦截
    if (!env.ALLOWED_ID || chatId !== String(env.ALLOWED_ID)) return new Response("OK", { status: 200 });

    // 可选 Queues 绑定：耗时图片/语音任务不受 waitUntil 的 30 秒窗口限制。
    if (env.TASK_QUEUE) {
      await env.TASK_QUEUE.send({ message: msg });
      return new Response("OK", { status: 200 });
    }

    // 输入分类：图片走识图链路，纯文本走对话链路
    if (hasPhoto) {
      ctx.waitUntil(handlePhoto(chatId, msg, env));
    } else {
      ctx.waitUntil(handleMessage(chatId, msg.text.trim(), env));
    }
    return new Response("OK", { status: 200 });
  },
  async queue(batch, env) {
    // 消费者配置 max_concurrency=1，串行写入聊天历史。
    for (const task of batch.messages) {
      const msg = task.body?.message;
      const id = String(msg?.chat?.id);
      if (id !== String(env.ALLOWED_ID)) { task.ack(); continue; }
      try {
        if (msg.photo?.length) await handlePhoto(id, msg, env);
        else if (msg.text) await handleMessage(id, msg.text.trim(), env);
        task.ack();
      } catch (e) {
        console.error("Queue task failed", { message: e.message });
        // 不自动重发已发送的消息，避免重复回复。
        task.ack();
      }
    }
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
    if (text.length > MAX_INPUT_LENGTH) return sendMsg(id, "这条消息太长了，请分成几条发送，我不想漏掉你说的话。", env);
    const safeInput = text;
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

// 图片消息：先下载 → 视觉模型识图 → 交给基模组织人设化回复
async function handlePhoto(id, msg, env) {
  if (!env.AI) return sendMsg(id, "未绑定 Cloudflare AI。", env);

  const sent = await sendMsg(id, "<i>让我看看这张图...</i>", env);
  const mid = sent?.result?.message_id;
  const caption = (msg.caption || "").trim();

  try {
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    const file = await getTelegramFile(fileId, env);
    if (!file) {
      await editMsgSimple(id, mid, "📷 图片下载失败了，再发一次好吗？", env);
      return;
    }

    // 视觉识别（Moondream 在本账户不可用，改用可用的 LLaVA）
    const question = caption
      ? `Look at this image carefully and answer this question in detail: "${caption}"`
      : "Describe this image in detail, including the main subjects, scene, colors and any text.";
    let desc = "";
    try {
      const vision = await env.AI.run(VISION_MODEL, {
        image: Array.from(new Uint8Array(file.buf)),
        prompt: question,
        max_tokens: 512
      });
      desc = (vision?.description || vision?.response || "").trim();
    } catch (e) {
      console.error("Vision error:", e);
    }
    if (!desc) desc = caption || "一张图片";

    // 交给基模，按 Hermione 人设回复
    const rawL = await env.DB?.get(`l_${id}`);
    const rawH = await env.DB?.get(`h_${id}`);
    const history = rawH ? JSON.parse(rawH) : [];
    const sysPrompt = buildPrompt(rawL || "auto");
    const userContent = `[对方发来一张图片]\n图片内容：${desc}${caption ? `\n对方附言：${caption}` : ""}`;
    const msgs = [{ role: "system", content: sysPrompt }, ...history, { role: "user", content: userContent }];

    const res = await env.AI.run(DEFAULT_MODEL, { messages: msgs, max_tokens: MAX_OUTPUT_TOKENS });
    const { think, answer } = splitThink(modelText(res));
    const reply = answer || desc;
    const head = think ? `<blockquote expandable>💭 <b>思考</b>\n${esc(think)}</blockquote>\n\n` : "";
    await sendLongText(id, mid, reply, env, head);

    const stored = `[图片]${caption ? ` ${caption}` : ""}（${desc.slice(0, 200)}）`;
    const newHistory = trimHistory([...history, { role: "user", content: stored }, { role: "assistant", content: reply }]);
    await env.DB?.put(`h_${id}`, JSON.stringify(newHistory), { expirationTtl: HISTORY_TTL });

  } catch (e) {
    console.error("handlePhoto:", e);
    await editMsgSimple(id, mid, `📷 抱歉，这张图我没看懂，再试一次好吗？`, env).catch(() => {});
  }
}

// /mood：DistilBERT 并行分析最近 5 条聊天记录（数值只作内部依据），由默认基模像真人一样自然表达心情
async function handleMoodCheck(id, env) {
  if (!env.AI) return sendMsg(id, "尚未绑定 Cloudflare AI 实例，无法分析心情。", env);

  const sent = await sendMsg(id, "<i>让我想想现在是什么心情...</i>", env);
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

// 用非推理模型生成心情话语并编辑上屏（非流式，稳定可靠、不会吐出思考）
async function streamMoodReply(id, mid, msgs, env) {
  try {
    const res = await env.AI.run(CAPTION_MODEL, { messages: msgs, max_tokens: 512 });
    const { answer } = splitThink(modelText(res));
    if (answer) await sendLongText(id, mid, answer, env);
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
      const res = await env.AI.run(modelKey, { messages: msgs, max_tokens: MAX_OUTPUT_TOKENS });
      const { think, answer } = splitThink(modelText(res));
      if (!answer) {
        await editMsgSimple(id, sentMid, "⚠️ 模型没有返回任何内容，请换一个模型再试。", env);
        return;
      }
      const head = think ? `<blockquote expandable>💭 <b>思考</b>\n${esc(think)}</blockquote>\n\n` : "";
      await sendLongText(id, sentMid, answer, env, head);
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

      let arrayBuffer, info;
      // 静音或损坏时重试一次，不把无声文件交给 Telegram。
      for (let attempt = 0; attempt < 2; attempt++) {
        const audio = await env.AI.run(modelKey, { prompt: say, lang: ttsLang });
        arrayBuffer = await audioToArrayBuffer(audio);
        info = inspectAudio(arrayBuffer);
        console.log("TTS output", { attempt: attempt + 1, bytes: arrayBuffer.byteLength, ...info });
        if (info.valid) break;
      }
      if (!info.valid) {
        await sendLongText(id, sentMid, `语音暂时生成失败，我先把想说的话发给你：\n${say}`, env);
        return;
      }
      const fmt = detectAudioFormat(arrayBuffer);
      // Telegram 的 WAV 使用文件发送；MP3 / OGG 使用可播放的语音消息。
      const method = ["mp3", "ogg"].includes(fmt.ext) ? "sendVoice" : "sendDocument";
      const field = method === "sendVoice" ? "voice" : "document";
      const form = new FormData();
      form.append("chat_id", id);
      form.append(field, new File([arrayBuffer], `hermione.${fmt.ext}`, { type: fmt.mime }));
      form.append("caption", say.slice(0, 900));
      const response = await fetch(`${TG_API}${env.TELEGRAM_TOKEN}/${method}`, { method: "POST", body: form });
      const result = await response.json();
      if (!result.ok) throw new Error(`Telegram audio: ${result.description || response.status}`);
      if (sentMid) await deleteMsg(id, sentMid, env);
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
  const timer = setTimeout(() => ctrl.abort(), env.TASK_QUEUE ? 120000 : STREAM_TIMEOUT);
  const payload = { model: modelId || "deepseek-v4-flash", messages: msgs, stream: true, max_tokens: MAX_OUTPUT_TOKENS };
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
  if (!res.body) throw new Error("Empty stream");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", completed = false;
  const process = async frame => {
    const data = frame.split("\n").filter(line => line.startsWith("data:"))
      .map(line => line.slice(5).trimStart()).join("\n");
    if (!data) return;
    if (data.trim() === "[DONE]") { completed = true; return; }
    const parsed = JSON.parse(data);
    if (parsed.error) throw new Error("Model stream returned an error");
    await onData(parsed);
  };
  try {
    while (!completed) {
      const {done, value} = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, {stream: true});
      let match;
      while (!completed && (match = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, match.index).replace(/\r\n/g, "\n");
        buffer = buffer.slice(match.index + match[0].length);
        await process(frame);
      }
      if (done) {
        if (!completed && buffer.trim()) await process(buffer.replace(/\r\n/g, "\n"));
        break;
      }
    }
    if (!completed) throw new Error("Stream ended without completion marker");
  } finally {
    try { await reader.cancel(); } catch {}
    reader.releaseLock();
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
  let answer = "", finishReason = null, interrupted = null;
  try {
    await forEachSseData(res, d => {
      const piece = sseDelta(d);
      if (piece.content) answer += piece.content;
      const reason = d?.choices?.[0]?.finish_reason;
      if (reason) finishReason = reason;
    });
  } catch (e) { interrupted = e; }
  // 最终统一分条发送，避免并发编辑覆盖和 HTML 截断。
  if (answer) await sendLongText(id, mid, splitThink(answer).answer, env);
  if (interrupted || finishReason === "length") {
    await sendMsg(id, interrupted
      ? "⚠️ 回复连接中断，上面是已收到的部分内容，请让我继续。"
      : "⚠️ 回复达到了生成长度上限，请让我继续。", env);
    console.warn("Incomplete AI response", { finishReason, interrupted: !!interrupted, length: answer.length });
  }
  if (!answer) throw interrupted || new Error("Model returned no answer");
  return answer;
}

async function editMsg(id, mid, think, answer, env) {
  return sendLongText(id, mid, answer || "思考中...", env);
}

async function telegram(method, payload, env) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`${TG_API}${env.TELEGRAM_TOKEN}/${method}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (result.ok) return result;
    if (method === "editMessageText" && result.description?.includes("message is not modified")) return result;
    const delay = result.parameters?.retry_after;
    if (result.error_code === 429 && attempt < 2 && delay <= 3) {
      await new Promise(resolve => setTimeout(resolve, delay * 1000));
      continue;
    }
    throw new Error(`Telegram ${method}: ${result.description || response.status}`);
  }
}
async function editMsgSimple(id, mid, text, env) {
  if (!mid) return sendMsg(id, text, env);
  return telegram("editMessageText", { chat_id: id, message_id: mid, text, parse_mode: "HTML" }, env);
}

async function deleteMsg(id, mid, env) {
  return fetch(`${TG_API}${env.TELEGRAM_TOKEN}/deleteMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: id, message_id: mid })
  });
}

// 把长文本按 ~limit 字符切段，优先在换行/句末标点处断开
function splitText(text, limit = 3800) {
  const s = String(text || "");
  const chunks = [];
  let rest = s;
  while (rest.length > limit) {
    let cut = -1;
    for (const sep of ["\n\n", "\n", "。", "！", "？", ". ", "! ", "? ", "；", ";", "，", ", "]) {
      const idx = rest.lastIndexOf(sep, limit);
      if (idx > cut) cut = idx + sep.length;
    }
    if (cut <= 0) cut = limit;
    if (cut > 0 && /[\uD800-\uDBFF]/.test(rest[cut - 1]) && /[\uDC00-\uDFFF]/.test(rest[cut] || "")) cut--;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) chunks.push(rest);
  return chunks.length ? chunks : [""];
}

// 发送长文本：首段编辑占位消息，其余分条发送；headHtml 为可选的思考折叠块（仅加在首段）
async function sendLongText(id, mid, rawText, env, headHtml = "") {
  // 只发送正文；思考块不挤占正文，也不公开内部推理。
  const chunks = splitText(rawText, 3800);
  for (let i = 0; i < chunks.length; i++) {
    if (!chunks[i]) continue;
    const payload = { chat_id: id, text: chunks[i] }; // 纯文本，无 HTML 实体问题
    if (i === 0 && mid) {
      try { await telegram("editMessageText", { ...payload, message_id: mid }, env); }
      catch (e) {
        console.warn("Placeholder edit failed; sending new message", { message: e.message });
        await telegram("sendMessage", payload, env);
      }
    } else await telegram("sendMessage", payload, env);
  }
}
async function sendMsg(id, text, env) {
  return telegram("sendMessage", { chat_id: id, text, parse_mode: "HTML" }, env);
}

// ArrayBuffer → base64（分块，避免大文件栈溢出）
function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// 通过 Telegram getFile 下载用户发送的图片，返回 { buf, base64 }
async function getTelegramFile(fileId, env) {
  try {
    const r = await fetch(`${TG_API}${env.TELEGRAM_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`);
    const j = await r.json();
    if (!j?.ok || !j.result?.file_path) return null;
    const fileRes = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_TOKEN}/${j.result.file_path}`);
    if (!fileRes.ok) return null;
    const buf = await fileRes.arrayBuffer();
    if (!buf.byteLength) return null;
    return { buf, base64: arrayBufferToBase64(buf) };
  } catch (e) {
    console.error("getTelegramFile:", e);
    return null;
  }
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
  const fmt = detectAudioFormat(arrayBuffer) || { ext: "wav", mime: "audio/wav" };
  const formData = new FormData();
  formData.append("chat_id", id);
  formData.append("audio", new File([arrayBuffer], `voice.${fmt.ext}`, { type: fmt.mime }));
  return fetch(`${TG_API}${env.TELEGRAM_TOKEN}/sendAudio`, { method: "POST", body: formData });
}

async function sendDocument(id, arrayBuffer, env) {
  const fmt = detectAudioFormat(arrayBuffer) || { ext: "wav", mime: "audio/wav" };
  const formData = new FormData();
  formData.append("chat_id", id);
  formData.append("document", new File([arrayBuffer], `voice.${fmt.ext}`, { type: fmt.mime }));
  return fetch(`${TG_API}${env.TELEGRAM_TOKEN}/sendDocument`, { method: "POST", body: formData });
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
    ],
    max_tokens: 512
  });
  return splitThink(modelText(res)).answer.trim();
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

// base64 字符串解码为 ArrayBuffer
function base64ToArrayBuffer(b64) {
  const bin = atob(String(b64).replace(/^data:[^,]+,/, "").replace(/\s+/g, "").trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

// 根据文件头识别音频格式（MeloTTS 实际返回 WAV，文档写 MP3）
function detectAudioFormat(buf) {
  const b = new Uint8Array(buf);
  if (b.length < 12) return null;
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x41 && b[10] === 0x56 && b[11] === 0x45)
    return { ext: "wav", mime: "audio/wav" };
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return { ext: "mp3", mime: "audio/mpeg" };
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return { ext: "mp3", mime: "audio/mpeg" };
  if (b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return { ext: "ogg", mime: "audio/ogg" };
  if (b[0] === 0x66 && b[1] === 0x4c && b[2] === 0x61 && b[3] === 0x43) return { ext: "flac", mime: "audio/flac" };
  if (b[0] === 0x66 && b[1] === 0x74 && b[2] === 0x79 && b[3] === 0x70) return { ext: "m4a", mime: "audio/mp4" };
  return null;
}

// 把 TTS 响应统一转成 ArrayBuffer，兼容 Response / Stream / ArrayBuffer / Uint8Array / {audio|result.audio: base64} / base64 字符串
async function audioToArrayBuffer(resp) {
  if (resp instanceof ArrayBuffer) return resp;
  if (ArrayBuffer.isView(resp)) return resp.buffer.slice(resp.byteOffset, resp.byteOffset + resp.byteLength);
  if (resp instanceof Response) {
    if (!resp.ok) throw new Error(`TTS response ${resp.status}`);
    if ((resp.headers.get("content-type") || "").includes("json")) return audioToArrayBuffer(await resp.json());
    return audioToArrayBuffer(await resp.arrayBuffer());
  }
  if (resp instanceof ReadableStream) return audioToArrayBuffer(await new Response(resp).arrayBuffer());
  if (typeof resp === "string") {
    const trimmed = resp.trim();
    if (trimmed.startsWith("{")) return audioToArrayBuffer(JSON.parse(trimmed));
    return base64ToArrayBuffer(trimmed);
  }
  for (const candidate of [resp?.audio, resp?.result?.audio]) {
    if (candidate != null) return audioToArrayBuffer(candidate);
  }
  if (resp && typeof resp.arrayBuffer === "function") return audioToArrayBuffer(await resp.arrayBuffer());
  throw new Error("Unsupported TTS response; expected audio bytes or base64 audio");
}

// 音频是否有效：非空且是已知音频格式
function isValidAudio(buf) {
  const b = new Uint8Array(buf);
  return b.length > 1024 && detectAudioFormat(b) !== null;
}


function modelText(res) {
  const text = res?.choices?.[0]?.message?.content ?? res?.response ?? res?.text;
  const reason = res?.choices?.[0]?.finish_reason ?? res?.finish_reason;
  console.log("Model response", { finish_reason: reason ?? "unknown", usage: res?.usage, length: typeof text === "string" ? text.length : 0 });
  if (typeof text !== "string") throw new Error("Unsupported model response");
  return reason === "length" ? text + "\n\n⚠️ 回复达到生成长度上限，请让我继续。" : text;
}

function inspectAudio(buf) {
  const fmt = detectAudioFormat(buf);
  if (!fmt || buf.byteLength < 128) return { valid: false, reason: "没有可识别的音频数据" };
  if (fmt.ext !== "wav") return { valid: true, format: fmt.ext, silenceChecked: false };
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let format, channels, rate, bits, dataStart, dataLength;
  const four = off => String.fromCharCode(...bytes.slice(off, off + 4));
  for (let off = 12; off + 8 <= bytes.length;) {
    const size = view.getUint32(off + 4, true);
    const start = off + 8;
    if (size > bytes.length - start) return { valid: false, reason: "WAV 数据不完整" };
    if (four(off) === "fmt " && size >= 16) {
      format = view.getUint16(start, true); channels = view.getUint16(start + 2, true);
      rate = view.getUint32(start + 4, true); bits = view.getUint16(start + 14, true);
    }
    if (four(off) === "data") { dataStart = start; dataLength = size; }
    off = start + size + (size % 2);
  }
  if (!dataLength || !channels || !rate || !bits) return { valid: false, reason: "WAV 缺少有效音轨" };
  const duration = dataLength / (rate * channels * bits / 8);
  if (duration < 0.1) return { valid: false, reason: "音频时长不足 0.1 秒" };
  if (format === 1 && bits === 16) {
    let energy = 0;
    const count = Math.floor(dataLength / 2);
    for (let i = 0; i < count; i++) { const sample = view.getInt16(dataStart + i * 2, true) / 32768; energy += sample * sample; }
    const rms = Math.sqrt(energy / count);
    if (rms < 0.0001) return { valid: false, reason: "音轨是静音", duration, rms };
    return { valid: true, format: "wav", duration, rms, silenceChecked: true };
  }
  return { valid: true, format: "wav", duration, silenceChecked: false };
}
