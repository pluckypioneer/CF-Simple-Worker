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
const MAX_OUTPUT_TOKENS = 2048;
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
    if (!msg?.chat?.id) return new Response("OK", { status: 200 });
    const hasPhoto = Array.isArray(msg.photo) && msg.photo.length > 0;
    if (!msg?.text && !hasPhoto) return new Response("OK", { status: 200 });

    const chatId = String(msg.chat.id);

    // 绑定单一用户 ID 严格拦截
    if (!env.ALLOWED_ID || chatId !== String(env.ALLOWED_ID)) return new Response("OK", { status: 200 });

    // 输入分类：图片走识图链路，纯文本走对话链路
    if (hasPhoto) {
      ctx.waitUntil(handlePhoto(chatId, msg, env));
    } else {
      ctx.waitUntil(handleMessage(chatId, msg.text.trim(), env));
    }
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
    const { think, answer } = splitThink(res.response || "");
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
      const res = await env.AI.run(modelKey, { messages: msgs, max_tokens: MAX_OUTPUT_TOKENS });
      const { think, answer } = splitThink(res.response || "");
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

      // 两种调用方式都试，取第一个有效音频
      let arrayBuffer = null;
      const attempts = [
        () => env.AI.run(modelKey, { prompt: say, lang: ttsLang }, { returnRawResponse: true }),
        () => env.AI.run(modelKey, { prompt: say, lang: ttsLang })
      ];
      for (const run of attempts) {
        try {
          const buf = await audioToArrayBuffer(await run());
          if (isValidAudio(buf)) { arrayBuffer = buf; break; }
        } catch (e) {
          console.error("TTS attempt failed:", e);
        }
      }
      if (!arrayBuffer) {
        await editMsgSimple(id, sentMid, "🔇 抱歉，语音没生成好，重新试试看？", env);
        return;
      }
      // 先按音频发送；若 Telegram 不接受该格式，退回文件发送
      let sentOk = false;
      try {
        const voiceRes = await sendAudio(id, arrayBuffer, env);
        const voiceData = await voiceRes.json();
        sentOk = !!voiceData.ok;
        if (!sentOk) console.error("sendAudio failed:", voiceData.description);
      } catch (e) {
        console.error("sendAudio error:", e);
      }
      if (!sentOk) {
        const docRes = await sendDocument(id, arrayBuffer, env);
        const docData = await docRes.json();
        sentOk = !!docData.ok;
        if (!sentOk) throw new Error(docData.description || "不好意思宝宝，语音发送失败");
      }
      if (sentOk && sentMid) await deleteMsg(id, sentMid, env);
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
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks.length ? chunks : [""];
}

// 发送长文本：首段编辑占位消息，其余分条发送；headHtml 为可选的思考折叠块（仅加在首段）
async function sendLongText(id, mid, rawText, env, headHtml = "") {
  const chunks = splitText(rawText, 3800);
  for (let i = 0; i < chunks.length; i++) {
    const body = (i === 0 && headHtml ? headHtml : "") + esc(chunks[i]);
    if (i === 0 && mid) await editMsgSimple(id, mid, body, env).catch(() => {});
    else await sendMsg(id, body, env).catch(() => {});
  }
}

async function sendMsg(id, text, env) {
  const res = await fetch(`${TG_API}${env.TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: id, text, parse_mode: "HTML" })
  });
  return res.json();
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
  let buf = null;

  if (resp instanceof ArrayBuffer) buf = resp;
  else if (ArrayBuffer.isView(resp)) buf = resp.buffer.slice(resp.byteOffset, resp.byteOffset + resp.byteLength);
  else if (resp instanceof ReadableStream) buf = await new Response(resp).arrayBuffer();
  else if (typeof Response !== "undefined" && resp instanceof Response) {
    const ct = resp.headers.get("content-type") || "";
    const ab = await resp.arrayBuffer();
    if (ct.includes("json")) {
      try { return await audioToArrayBuffer(JSON.parse(new TextDecoder().decode(ab))); } catch {}
    }
    buf = ab;
  }
  else if (resp?.arrayBuffer) buf = await resp.arrayBuffer();
  else if (resp && typeof resp.audio === "string") return base64ToArrayBuffer(resp.audio);
  else if (resp?.result && typeof resp.result.audio === "string") return base64ToArrayBuffer(resp.result.audio);
  else if (resp && resp.audio != null) return await audioToArrayBuffer(resp.audio);
  else if (typeof resp === "string") return base64ToArrayBuffer(resp);
  else buf = await new Response(resp).arrayBuffer();

  // 若拿到的不是可识别音频（例如是 base64 文本流），尝试按 base64 解码
  if (!detectAudioFormat(buf)) {
    const text = new TextDecoder().decode(new Uint8Array(buf)).trim();
    if (text.length > 100 && /^[A-Za-z0-9+/=\s]+$/.test(text)) {
      try {
        const decoded = base64ToArrayBuffer(text);
        if (detectAudioFormat(decoded)) return decoded;
      } catch {}
    }
  }
  return buf;
}

// 音频是否有效：非空且是已知音频格式
function isValidAudio(buf) {
  const b = new Uint8Array(buf);
  return b.length > 1024 && detectAudioFormat(b) !== null;
}
