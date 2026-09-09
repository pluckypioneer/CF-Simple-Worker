# Cloudflare Workers AI OpenAI-Compatible Proxy

基于 **Cloudflare Workers** 搭建的、完全兼容 **OpenAI 兼容协议（OpenAI API Format）** 的大模型代理网关。本项目可以将 Cloudflare Workers AI 托管的高性能、低消耗开源大模型（如智谱 GLM-4.7-Flash、多语言翻译模型等）无缝包装为标准的 OpenAI API，供任何第三方笔记软件（如 EdgeEver）、AI 客户端或代码库直接调用。

---

## 🌟 项目特色

1. **零服务器成本 (Serverless)**：
* 依托 Cloudflare Workers 边缘计算运行，免去购买和维护 VPS 的高额开销。
* 充分利用 Cloudflare Workers AI 的每日免费神经元（Neurons）额度。


2. **完美支持 OpenAI 协议**：
* 实现了标准服务发现路由：`/v1/models`（模型列表）。
* 实现了核心对话路由：`/v1/chat/completions`（支持**流式传输 Streaming / 打字机效果**与非流式传输）。


3. **多模型聚合与定制**：
* 同时注册了**主力大模型（GLM-4.7-Flash）**与**专用翻译模型（M2M100）**，在客户端下拉菜单中即可自由切换。


4. **针对思维链（Reasoning）的深度优化**：
* 默认通过参数控制过滤了现代大模型多余的思考过程（Reasoning Chain），强制模型直接输出干脆利落的正文，完美解决第三方客户端因无法解析思维链而报错（如 `The AI did not return a note result`）的问题。


5. **基础安全防护**：
* 支持通过自定义 `PROXY_API_KEY` 进行 Bearer Token 鉴权，防止代理接口被恶意白嫖。



---

## 🛠️ 详细部署指南

### 第一步：准备工作

1. 注册并登录 [Cloudflare 账号](https://dash.cloudflare.com/)。
2. 拥有开通了 Workers AI 权限的账户。

### 第二步：创建并部署 Cloudflare Worker

1. 登录 Cloudflare Dashboard，进入 **Workers & Pages** -> 点击 **Create application** -> **Create Worker**。
2. 为你的 Worker 起个名字（例如 `cf-openai-proxy`），点击部署。
3. 进入刚刚创建的 Worker -> 点击 **Edit code**，将封装好的代理代码完整粘贴进去，并点击 **Save and deploy**。

### 第三步：配置 AI 服务绑定（至关重要）

1. 在你的 Worker 管理页面中，点击顶部的 **Settings (设置)** 选项卡。
2. 在左侧菜单中找到 **Bindings (绑定)** -> 点击 **Add binding (添加绑定)**。
3. **类型 (Type)** 选择：`AI` (Workers AI)。
4. **变量名 (Variable name)**：必须严格填写大写的 **`AI`**。
5. 点击保存。

### 第四步：配置环境变量（可选安全凭证）

在 **Settings** -> **Variables** 页面中，如果你想给代理加一把锁，可以添加一个自定义环境变量：

* `PROXY_API_KEY` = `你自定义的API密钥`（例如 `sk-my-custom-key-888`）。如果不设置则代表公开访问（仅限配合你的域名使用）。

---

## 🔌 在第三方软件（如 EdgeEver）中如何接入

部署完成后，你会获得一个 Cloudflare 分配的 Worker 域名（例如 `[https://cf-openai-proxy.yourname.workers.dev](https://cf-openai-proxy.yourname.workers.dev)`）。

在第三方支持 OpenAI 协议的软件（如 EdgeEver、NextChat、LobeChat 等）中，按下表进行配置：

* **Base URL** (API 基础路径): `[https://你的worker域名.workers.dev/v1](https://你的worker域名.workers.dev/v1)` （**注意末尾必须带上 `/v1**`）
* **API Key**: 填入你在环境变量中配置的 `PROXY_API_KEY`（如果没配环境变量，可以随便填一个字符串）
* **Model / 模型 ID**:
* 智能对话主力：填写 **`glm-4.7-flash`**
* 跨语言翻译专用：填写 **`m2m100`**



---

## 🧬 二次开发与模型扩展指南

如果你想更换或添加 Cloudflare 支持的其他模型，只需修改代码最上方的 `MODELS_MAP` 常量映射：

```javascript
// 定义可用的模型映射
const MODELS_MAP = {
  // 主力对话模型
  "glm-4.7-flash": { cfId: "@cf/zai-org/glm-4.7-flash", type: "chat" },
  // 翻译模型
  "m2m100": { cfId: "@cf/meta/m2m100-1.2b", type: "translation" },
  
  // 你可以在这里自由扩展其他官方支持的模型，例如加入 QwQ 推理模型：
  // "qwq-32b": { cfId: "@cf/qwen/qwq-32b", type: "chat" }
};

```

* **如何获取最新模型 ID**：
可以通过本地 Wrangler CLI 终端运行 `npx wrangler ai models`，或者查阅 [Cloudflare Workers AI 官方模型目录](https://developers.cloudflare.com/workers-ai/models/) 获取最新的节点字符串。
