# Hermione AI Telegram Bot 部署指南
这是一个部署在 Cloudflare Workers 上的轻量级 Telegram AI 伴侣。它支持 DeepSeek 和 Cloudflare Workers AI 双引擎切换，具备记忆功能（基于 KV 存储），并拥有深度定制的人设。

## 1. 准备工作
在开始之前，你需要准备以下信息：

### A. Telegram 相关
- Telegram Bot Token: 通过 @BotFather 创建机器人获取。

- ALLOWED_ID: 你的 Telegram 用户 ID（用于防止他人盗用你的机器人）。可以通过 @userinfobot 获取。

### B. API 密钥
DEEPSEEK_API_KEY: 从 DeepSeek 开放平台 获取。

CFID (Cloudflare Account ID): 登录 Cloudflare 控制台，在侧边栏“概述”页面右侧即可看到“账户 ID”。

CFAI (Cloudflare API Token):

前往 My Profile > API Tokens。

创建一个具有 Workers AI (Read/Write) 权限的 Token。

## 2. Cloudflare 部署步骤
### 第一步：创建 KV 命名空间
登录 Cloudflare 控制台，进入 Workers & Pages > KV。

点击 Create a namespace，命名为 HERMIONE_DB（或其他你喜欢的名字）。

### 第二步：创建 Worker
进入 Workers & Pages > Create application > Create Worker。

命名后点击 Deploy。

点击 Edit Code，将项目代码全部粘贴进去并保存。

### 第三步：绑定变量与 KV
在 Worker 详情页，进入 Settings > Variables。

KV Namespace Bindings: 点击 Add binding，变量名称填 **DB**，命名空间选择你刚才创建的 HERMIONE_DB。

Environment Variables: 点击 Add variable 依次添加：

**ALLOWED_ID**: 你的 TG ID

**TELEGRAM_TOKEN**: 你的机器人 Token

**DEEPSEEK_API_KEY**: DeepSeek 密钥

**CFID**: 你的 CF 账户 ID

**CFAI**: 你的 CF API Token

### 第四步：设置 Webhook
你需要告诉 Telegram 将消息发往何处。在浏览器访问以下 URL（替换为你自己的信息）：
https://api.telegram.org/bot<你的机器人Token>/setWebhook?url=https://<你的Worker域名>/

## 3. 定制化修改指南

### 修改人设（不同风格的 AI）

定位到代码最顶部的 SYSTEM_PROMPT 变量。

温柔型: 增加“体贴”、“包容”、“语气温和”等词汇。

高冷型: 修改为“言简意赅”、“逻辑性强”、“不带感情色彩”。

特定职业: 修改背景描述，例如将“医疗器械背景”改为“资深律师”或“二次元少女”。

注意: 在人设末尾保留“使用纯文本”和“不要描述动作”的指令，以保持 Telegram 聊天的沉浸感。

> 可向ai说明你的需求，从而让它帮你写出合适的提示词。

### 修改 API 实现（使用其他模型）
如果你想增加或更换其他 AI 供应商（如 OpenAI 或 Anthropic），可以仿照 callDeepSeek 函数：

```JavaScript
async function callNewAI(messages, env) {
  const response = await fetch("API_ENDPOINT", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.NEW_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "model-name",
      messages: messages
    })
  });
  const data = await response.json();
  return data.choices[0].message.content; // 确保根据 API 文档解析正确字段
}
```
### 修改ai读取上下文的范围

```javascript
  const MAX_HISTORY = 12;
```
原代码默认读取上文十二条消息，及你输入的6条和它的6条回复，KV中也会保存十二条消息，多余的消除。

通过更改上述代码中MAX_HISTORY的值从而实现改变AI可读取的聊天记录多少。

但建议使用默认值即可，太小了AI的上下文读取能力小，太多了就会导致Token消耗太大，可以根据自己的实际情况调整适当增大，不建议调小。
## 4. 使用指令
直接发送消息：与 Hermione 聊天（默认 DeepSeek）。

/clear: 清空当前的聊天记忆。

/cf_ai: 切换到 Cloudflare Llama 3 引擎。

/deepseek: 切换回 DeepSeek 引擎。

> 可以在telegram绑定指令，实现便捷操作

## 5. 故障排查
机器人无反应: 检查 Cloudflare Worker 的 Logs（实时日志），查看是否有 API 报错或变量未定义的错误。

身份验证失败: 确认 ALLOWED_ID 是否与你的 Telegram ID 完全一致（必须是数字串）。

KV 错误: 确认代码中的 env.DB 是否与设置页面的“变量名称”一致。
