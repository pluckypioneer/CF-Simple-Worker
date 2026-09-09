# Hermione AI Companion - Telegram Bot (Cloudflare Workers Edition)

基于 **Cloudflare Workers** 托管的智能 Telegram AI 伴侣。本项目将多模态开源 AI（大语言模型、文生图、语音合成）与专属拟人化人格（Hermione）深度结合，支持通过 Telegram 内联菜单无缝切换 AI 模型、多语言以及实时心情感知。

---

## 🌟 项目特色

1. **零服务器成本 (Serverless & Free)**：
* 基于 Cloudflare Workers 运行，完全免去购买云服务器（VPS）的烦恼。
* 充分利用 Cloudflare Workers AI 平台的每日免费额度，零成本运行多个顶级开源大模型。


2. **拟人化女友设定 (Hermione Persona)**：
* 拥有独特的工程学背景、医疗器械造诣与知书达理的大家闺秀风度。
* 严格的 Prompt 限制：拒绝机械的动作描写（如 `*微笑*`）与多余的 Markdown 排版，所有情绪通过纯文本口语化自然流露。


3. **创新性的后台心情感知系统 (`/mood`)**：
* 废弃传统的硬编码关键词触发，转而采用 **DistilBERT 情感分析模型** 在后台静默分析历史对话，结合大模型将冰冷的情感得分转化为女友专属的温柔独白。


4. **丰富的模型与多模态扩展 (`/model`)**：
* 支持在 **DeepSeek-V3 (API)**、**Llama 3.1 8B**、**Qwen QwQ 32B** 等多个大语言模型间一键切换。
* 支持通过 **SDXL** 自动根据提示词进行图文生成，并直接将图片发送至 Telegram。
* 支持通过 **Bark** 将文本合成为 `.ogg` 语音消息（语音回复）。
* 支持 **M2M100** 多语言翻译。


5. **极其安全的私密绑定**：
* 内置严格的 `ALLOWED_ID` 校验，不仅拦截所有非白名单用户的文本消息，还对内联键盘的点击回调（Callback Query）进行鉴权，防止额度被白嫖。


6. **精致的交互体验**：
* 采用 Telegram **Inline Keyboard（内联交互菜单）** 统一管理 `/model` 与 `/lang`。
* 实时拟真：“正在思考中”优雅升级为微信/微信风格的“对方正在输入中…”。
* 温柔的容错：所有系统报错统一以“不好意思宝宝……”开头，完美契合人设。



---

## 🛠️ 详细部署指南

### 第一步：准备工作

1. 注册一个免费的 [Cloudflare 账号](https://dash.cloudflare.com/)。
2. 创建一个 **Cloudflare D1 数据库** 或使用 **Cloudflare KV**（代码中使用了 KV 绑定，名称对应 `DB`）。
3. 拥有一个 Telegram Bot（通过 [@BotFather](https://t.me/BotFather) 创建并获取 `TELEGRAM_TOKEN`）。
4. 获取你自己的 Telegram 数字 ID（通过 [@userinfobot](https://t.me/userinfobot) 获取，即 `ALLOWED_ID`）。
5. （可选）准备一个 DeepSeek API Key。

### 第二步：创建 Cloudflare Worker 项目

1. 登录 Cloudflare Dashboard，进入 **Workers & Pages** -> 点击 **Create application** -> **Create Worker**。
2. 命名你的 Worker（例如 `hermione-bot`），点击部署。
3. 进入刚刚创建的 Worker -> 点击 **Edit code**，将本项目的完整代码粘贴进去并保存。

### 第三步：配置环境变量与绑定

在 Worker 的 **Settings (设置)** -> **Variables (变量)** 页面中配置以下内容：

* **Environment Variables (环境变量)**：
* `TELEGRAM_TOKEN` = `你的Telegram机器人Token`
* `ALLOWED_ID` = `你的Telegram数字ID`
* `DEEPSEEK_API_KEY` = `你的DeepSeek密钥 (可选)`


* **Bindings (服务绑定)**：
* 添加一个 **AI** 绑定，变量名固定写为 `AI`（用于调用 Cloudflare Workers AI）。
* 添加一个 **KV** 绑定，变量名固定写为 `DB`（用于存储聊天记忆与用户配置）。



### 第四步：设置 Telegram Webhook

在浏览器中访问以下 URL（将 Token 和你的 Cloudflare Worker 域名替换进去）以绑定 Webhook：

```text
https://api.telegram.org/bot<你的TELEGRAM_TOKEN>/setWebhook?url=https://你的worker子域名.workers.dev

```

若返回 `{"ok":true,"result":true,"description":"Webhook was set"}` 即代表部署成功！

---

## 📱 指令说明

* `/start` - 唤醒 Hermione 并查看欢迎提示
* `/clear` - 清空当前的聊天记忆与状态缓存
* `/mood` - 智能分析过去对话，查看 Hermione 当前的心情指数与专属独白
* `/lang` - 弹出内联菜单切换对话回复语言（自动、中文、英文、粤语、法语）
* `/model` - 弹出内联菜单切换 AI 模型或工具（切换对话、画图、语音合成等）

---

## 🧬 二次开发指南（自定义模型）

Cloudflare Workers AI 的模型库经常更新。如果你想根据个人需求调整模型、添加新模型或替换默认基模，可以按照以下步骤进行二次开发：

### 1. 查看 Cloudflare 官方最新模型列表

在终端通过 Wrangler CLI 运行以下命令，可以实时拉取你当前 Cloudflare 账户支持的最新模型清单：

```bash
npx wrangler ai models

```

或者随时查阅官方文档：[Cloudflare Workers AI Models 官方目录](https://developers.cloudflare.com/workers-ai/models/)。

### 2. 在代码中修改模型映射

打开代码中的 `MODELS` 常量对象，根据你的需求调整模型 ID。例如：

```javascript
const MODELS = {
  "@cf/meta/llama-3.1-8b-instruct-fp8": { name: "💬 Llama 3.1 8B (默认基模)", type: "llm_cf" },
  "deepseek": { name: "💬 DeepSeek-V3 (备用 API)", type: "llm_ds" },
  "@cf/qwen/qwq-32b": { name: "💬 Qwen QwQ 32B (推理对话)", type: "llm_cf" },
  // 你可以在这里添加官网上查到的其他模型，例如更换图像生成模型：
  "@cf/black-forest-labs/flux-1-schnell": { name: "🎨 Flux Schnell (极速画图)", type: "image" },
  "@cf/suno/bark": { name: "🗣️ Bark (文本转语音)", type: "tts" },
  "@cf/meta/m2m100-1.2b": { name: "🔠 M2M100 (单向翻译)", type: "translation" }
};

```

* **`type` 字段说明**：
* `"llm_cf"`：调用 Cloudflare 托管的开源对话大模型。
* `"llm_ds"`：调用外部 DeepSeek API。
* `"image"`：调用文生图模型（会自动将输出转为图片发给用户）。
* `"tts"`：调用文本转语音模型（会自动转为 `.ogg` 语音消息发给用户）。
* `"translation"`：调用翻译模型。
