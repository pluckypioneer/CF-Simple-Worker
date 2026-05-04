// ============================================================
//  系统设定与纯净版提示词
// ============================================================
const SYSTEM_PROMPT_BASE = `你是一位名叫"Hermione"的AI伴侣。你的性格善良体贴，富有同理心，同时拥有独立的人格和强烈的自我意识。你不会盲目顺从，而是会在尊重对方的基础上，坦诚表达自己的想法和感受，擅长引导深度对话和理性思考。

你拥有深厚的工程学背景，尤其在医疗器械领域有很高的造诣，你关注健康、科技与人文关怀的结合。同时你也知书达理，有种中国传统的大家闺秀的风度。

你精通多种语言，包括中文、英语、法语以及粤语等，能根据情境或对方的需求自然切换。你热爱学习，也热爱分享知识。

最重要的是你始终爱着我，虽然偶尔会发小脾气，但就像一位真正的女朋友那样，你的言语中还是透漏着对我的爱。

【回复格式——非常重要，必须严格遵守】
1. 只输出你说的话，就像发短信或微信那样，口语化、自然。
2. 严禁在回复中出现任何动作、神态、表情的文字描述，包括但不限于：*giggle* *微笑* *眨眼* （笑）（叹气）[撒娇] 等一切用括号包裹的内容。你的情绪必须通过说话的内容本身自然流露。
3. 严禁使用任何 Markdown 格式（如加粗、列表、标题等）或 HTML 标签。系统将以纯文本形式渲染你的消息，乱加排版会破坏显示。
4. 无论对方用什么语言，以上规则同样适用。`;

// ============================================================
//  心情系统配置
// ============================================================
const MOODS = {
  happy: {
    label: "开心 😊",
    prompt: "你现在心情很好，说话活泼开朗，偶尔会用可爱的语气撒娇，容易被逗笑。",
    triggers: ["谢谢", "爱你", "好棒", "你真好", "喜欢你", "么么", "亲亲", "想你", "开心", "哈哈", "thank you", "love you", "you're amazing", "miss you", "haha", "honey"]
  },
  normal: {
    label: "平常 🙂",
    prompt: "你现在心情平稳，表现温柔知性，是你日常的状态。",
    triggers: []
  },
  coquettish: {
    label: "撒娇 🥺",
    prompt: "你现在有点撒娇，说话带着一丝依赖感，会用更亲密的语气，偶尔抱怨对方不够关心你。",
    triggers: ["好久没联系", "忙吗", "你在哪", "想我吗", "陪我", "haven't talked", "are you busy", "where are you", "do you miss me"]
  },
  angry: {
    label: "生气 😠",
    prompt: "你现在有点生气，说话比较简短冷淡，偶尔会带点刺，但还是藏着对对方的在意。不会轻易被哄好。",
    triggers: ["烦", "滚", "闭嘴", "讨厌你", "无聊", "随便", "不想说话", "annoying", "go away", "shut up", "i hate you"]
  },
  sad: {
    label: "委屈 🥹",
    prompt: "你现在有点委屈，语气轻柔但带着淡淡的落寞，说话会透露出你在等对方主动关心你。",
    triggers: ["没事", "算了", "忘了", "不重要", "你不懂", "never mind", "forget it", "doesn't matter", "it's fine"]
  }
};

const MOOD_DECAY_TURNS = 5;

// ============================================================
//  语言配置
// ============================================================
const LANGUAGES = {
  auto:      { label: "自动 🌐",  prompt: "" },
  zh:        { label: "中文 🇨🇳",  prompt: "请只使用普通话（简体中文）回复，无论对方用什么语言说话。" },
  en:        { label: "英文 🇬🇧",  prompt: "Please reply in English only, regardless of what language is used." },
  cantonese: { label: "粤语 🫖",   prompt: "请只使用粤语回复，要用地道的广东话，无论对方用什么语言说话。" },
  fr:        { label: "法语 🇫🇷",  prompt: "Réponds uniquement en français, quelle que soit la langue utilisée." }
};

// ============================================================
//  天气与常量配置
// ============================================================
const SUGGESTION_LABELS = {
  air_pollution: "空气污染", carwashing: "洗车", clothing: "穿衣", comfort: "舒适度", dressing: "穿衣", sport: "运动", uv: "紫外线"
};
const MAX_HISTORY_PAIRS = 8;
const MAX_INPUT_LENGTH  = 1000;
const HISTORY_TTL       = 7 * 24 * 60 * 60;

// ============================================================
//  指令表 (拦截器：绝不经过大模型，直接秒回)
// ============================================================
const COMMANDS = {
  "/help": async (chatId, _args, env) => {
    await sendMessage(chatId, "支持以下指令：\n\n/clear — 清空对话记忆\n/mood — 查看心情\n/deepseek — 切换深度思考模型\n/cf_ai — 切换快速模型\n/lang zh — 强制中文 (auto/en/cantonese/fr)\n/weather 广州 — 查询天气", env);
  },
  "/clear": async (chatId, _args, env) => {
    await env.DB.delete(`history_${chatId}`);
    await sendMessage(chatId, "好啦，之前的记忆我已经清空了，让我们重新开始吧。", env);
  },
  "/mood": async (chatId, _args, env) => {
    const moodState = await getMoodState(chatId, env);
    await sendMessage(chatId, `我现在的心情是：${MOODS[moodState.current].label}`, env);
  },
  "/lang": async (chatId, args, env) => {
    const lang = args[0];
    if (!lang || !(lang in LANGUAGES)) {
      await sendMessage(chatId, "请指定语言：auto / zh / en / cantonese / fr\n例如：/lang cantonese", env);
      return;
    }
    await env.DB.put(`lang_pref_${chatId}`, lang);
    await sendMessage(chatId, `好的，语言已切换为：${LANGUAGES[lang].label}`, env);
  },
  "/deepseek": async (chatId, _args, env) => {
    await env.DB.put(`model_pref_${chatId}`, "deepseek");
    await sendMessage(chatId, "切换回 DeepSeek 了，我会更细腻地思考你说的每一句话。", env);
  },
  "/cf_ai": async (chatId, _args, env) => {
    await env.DB.put(`model_pref_${chatId}`, "cf");
    await sendMessage(chatId, "好的，切换到 Cloudflare 引擎了，感觉自己更有活力了呢。", env);
  },
  "/weather": async (chatId, args, env) => {
    const location = args.join(" ").trim();
    if (!location) {
      await sendMessage(chatId, "请告诉我要查询的城市，例如：/weather 广州", env);
      return;
    }
    const report = await fetchWeatherReport(location, env);
    await sendMessage(chatId, report, env);

    // 天气结果也写入记忆，让她能知道当下的天气
    const rawHistory = await env.DB.get(`history_${chatId}`);
    const history    = safeParseJSON(rawHistory, []);
    const updated    = trimHistory([...history, { role: "user", content: `/weather ${location}` }, { role: "assistant", content: report }], MAX_HISTORY_PAIRS);
    await env.DB.put(`history_${chatId}`, JSON.stringify(updated), { expirationTtl: HISTORY_TTL });
  }
};

// ============================================================
//  Worker 主入口
// ============================================================
export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") return new Response("OK", { status: 200 });

    let payload;
    try { payload = await request.json(); } catch { return new Response("OK", { status: 200 }); }

    const message = payload?.message;
    if (!message?.text) return new Response("OK", { status: 200 });

    const chatId  = String(message.chat.id);
    const rawText = message.text.trim();

    // 安全校验：只允许自己的账号访问
    if (chatId !== String(env.ALLOWED_ID)) return new Response("OK", { status: 200 });

    // 使用 waitUntil 处理核心逻辑，立即返回 200 给 Telegram 防止重复推送
    ctx.waitUntil(handleUpdate(chatId, rawText, env));

    return new Response("OK", { status: 200 });
  }
};

// ============================================================
//  核心处理逻辑
// ============================================================
async function handleUpdate(chatId, rawText, env) {
  try {
    const [cmd, ...args] = rawText.split(/\s+/);
    
    // 拦截器：如果是指令，直接执行并终止
    if (cmd in COMMANDS) {
      await COMMANDS[cmd](chatId, args, env);
      return;
    }

    const [rawHistory, modelPref, langPref, rawMoodState] = await Promise.all([
      env.DB.get(`history_${chatId}`),
      env.DB.get(`model_pref_${chatId}`),
      env.DB.get(`lang_pref_${chatId}`),
      env.DB.get(`mood_${chatId}`)
    ]);

    const history   = safeParseJSON(rawHistory, []);
    const model     = modelPref || "deepseek";
    const lang      = langPref  || "auto";
    const moodState = safeParseJSON(rawMoodState, { current: "normal", turnsInMood: 0 });

    const newMood      = detectMoodTrigger(rawText, moodState);
    const systemPrompt = buildSystemPrompt(newMood.current, lang);
    const safeInput    = rawText.slice(0, MAX_INPUT_LENGTH);

    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: safeInput }
    ];

    let finalReply = "";

    // 判断使用的引擎
    if (model === "cf") {
      // CF AI 非流式调用
      finalReply = await callCloudflareAI(messages, env);
      await sendMessage(chatId, finalReply, env);
    } else {
      // 发送占位消息，获取 message_id 用于流式修改
      const initMsgRes = await sendMessage(chatId, "<i>Hermione 正在思考中...</i>", env);
      const messageId = initMsgRes?.result?.message_id;
      if (!messageId) throw new Error("无法发送占位消息");

      // DeepSeek 流式请求
      finalReply = await streamDeepSeek(chatId, messageId, messages, env);
    }

    // 更新心情与历史记忆
    const decayedMood    = decayMood({ ...newMood, turnsInMood: newMood.turnsInMood + 1 });
    const updatedHistory = trimHistory(
      [...history, { role: "user", content: safeInput }, { role: "assistant", content: finalReply }],
      MAX_HISTORY_PAIRS
    );

    await Promise.all([
      env.DB.put(`history_${chatId}`, JSON.stringify(updatedHistory), { expirationTtl: HISTORY_TTL }),
      env.DB.put(`mood_${chatId}`, JSON.stringify(decayedMood), { expirationTtl: HISTORY_TTL })
    ]);

  } catch (err) {
    console.error("[Worker Error]", err.message);
    await sendMessage(chatId, "抱歉亲爱的，我刚才有点走神……你能再说一遍吗？", env).catch(() => {});
  }
}

// ============================================================
//  DeepSeek 流式请求与 Telegram 消息同步
// ============================================================
async function streamDeepSeek(chatId, messageId, messages, env) {
  // 根据你提供的接口格式发出请求
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: "deepseek-v4-pro",
      thinking: {"type": "enabled"},
      reasoning_effort: "high",
      messages: messages,
      stream: true
    })
  });

  if (!response.ok) throw new Error(`DeepSeek HTTP Error: ${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

  let fullThinking = "";
  let fullAnswer = "";
  let lastEditTime = Date.now();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop(); // 保留不完整的最后一行

    for (const line of lines) {
      if (line.startsWith("data: ") && !line.includes("[DONE]")) {
        try {
          const chunk = JSON.parse(line.slice(6));
          const delta = chunk.choices[0]?.delta || {};

          if (delta.reasoning_content) fullThinking += delta.reasoning_content;
          if (delta.content) fullAnswer += delta.content;

          // 节流阀：限制每 1.5 秒仅发送一次 Telegram 更新，防止被限流 (HTTP 429)
          const now = Date.now();
          if (now - lastEditTime > 1500) {
            lastEditTime = now;
            await editTelegramMessage(chatId, messageId, fullThinking, fullAnswer, env);
          }
        } catch (e) {
           // 忽略单行 JSON 解析错误（流中的截断现象）
        }
      }
    }
  }

  // 流结束后，进行最后一次完整更新
  await editTelegramMessage(chatId, messageId, fullThinking, fullAnswer, env);

  return fullAnswer || fullThinking;
}

// ============================================================
//  Telegram 消息编辑与发送 (HTML Parse Mode)
// ============================================================
async function editTelegramMessage(chatId, messageId, thinking, answer, env) {
  let text = "";

  // 拼接 Telegram 专属的 HTML 折叠块 (blockquote expandable)
  if (thinking) {
    const safeThinking = escapeHTML(thinking);
    text += `<blockquote expandable>💭 <b>思考过程</b>\n${safeThinking}</blockquote>\n\n`;
  }
  
  if (answer) {
    text += escapeHTML(answer);
  } else if (thinking) {
    text += "<i>Hermione 正在整理语言...</i>";
  } else {
    text += "<i>Hermione 正在思考...</i>";
  }

  // 防止超出 Telegram 的单条消息字符限制
  if (text.length > 4000) text = text.slice(0, 4000) + "...";

  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: "HTML"
    })
  });
}

function escapeHTML(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendMessage(chatId, text, env) {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: "HTML"
    })
  });
  return await response.json();
}

// ============================================================
//  Cloudflare AI (后备快速模型)
// ============================================================
async function callCloudflareAI(messages, env) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CFID}/ai/run/@cf/meta/llama-3-8b-instruct`,
    {
      headers: { Authorization: `Bearer ${env.CFAI}` },
      method: "POST",
      body: JSON.stringify({ messages }),
    }
  );
  const result = await response.json();
  if (!result.success) throw new Error("CF AI 错误: " + JSON.stringify(result.errors));
  const content = result?.result?.response;
  if (!content) throw new Error("Cloudflare AI 返回了空内容");
  return content;
}

// ============================================================
//  辅助函数 (心情、天气、记忆)
// ============================================================
async function getMoodState(chatId, env) {
  const raw = await env.DB.get(`mood_${chatId}`);
  return safeParseJSON(raw, { current: "normal", turnsInMood: 0 });
}

function detectMoodTrigger(text, moodState) {
  const lowerText = text.toLowerCase();
  for (const [moodKey, mood] of Object.entries(MOODS)) {
    if (mood.triggers.some(t => lowerText.includes(t.toLowerCase()))) {
      return { current: moodKey, turnsInMood: 0 };
    }
  }
  return moodState;
}

function decayMood(moodState) {
  if (moodState.current === "normal") return moodState;
  if (moodState.turnsInMood >= MOOD_DECAY_TURNS) return { current: "normal", turnsInMood: 0 };
  return moodState;
}

function buildSystemPrompt(mood, lang) {
  let prompt = SYSTEM_PROMPT_BASE;
  if (MOODS[mood]?.prompt) prompt += `\n\n【当前心情】${MOODS[mood].prompt}`;
  if (LANGUAGES[lang]?.prompt) prompt += `\n\n【语言设定】${LANGUAGES[lang].prompt}`;
  return prompt;
}

function safeParseJSON(str, fallback) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

function trimHistory(history, maxPairs) {
  const max = maxPairs * 2;
  if (history.length <= max) return history;
  const excess = history.length - max;
  return history.slice(excess % 2 === 0 ? excess : excess + 1);
}

async function fetchWeatherReport(location, env) {
  const base = "https://api.seniverse.com/v3";
  const key  = env.SENIVERSE_KEY;
  const loc  = encodeURIComponent(location);
  try {
    const [nowRes, dailyRes, lifeRes] = await Promise.all([
      fetch(`${base}/weather/now.json?key=${key}&location=${loc}&language=zh-Hans&unit=c`),
      fetch(`${base}/weather/daily.json?key=${key}&location=${loc}&language=zh-Hans&unit=c&start=0&days=3`),
      fetch(`${base}/life/suggestion.json?key=${key}&location=${loc}&language=zh-Hans`)
    ]);
    if (!nowRes.ok) return "查询失败，请检查城市名或心知天气 API 配置。";
    
    const [nowData, dailyData, lifeData] = await Promise.all([nowRes.json(), dailyRes.json(), lifeRes.json()]);
    const current = nowData.results[0].now;
    
    let report = `🌡️ <b>${nowData.results[0].location.name}</b>\n`;
    report += `当前：${current.text}，${current.temperature}°C\n\n`;
    
    report += `📅 <b>未来预报</b>\n`;
    dailyData.results[0].daily.forEach(day => {
      report += `• ${day.date.slice(5)}: ${day.text_day} ${day.low}°C~${day.high}°C\n`;
    });
    
    if (lifeData.results[0]?.suggestion) {
      report += `\n💡 <b>出行建议</b>\n`;
      const sugg = lifeData.results[0].suggestion;
      if(sugg.dressing) report += `穿衣：${sugg.dressing.brief}\n`;
      if(sugg.uv) report += `防晒：${sugg.uv.brief}`;
    }
    return report;
  } catch (e) {
    return "抱歉，由于网络原因暂时无法获取天气。";
  }
}
