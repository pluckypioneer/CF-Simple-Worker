# 🔔 ChronoAlert：Telegram 计时提醒机器人 (基于 Cloudflare Worker)

## 简介

ChronoAlert，这是一个轻量、安全、自托管的 Telegram 定时提醒机器人。它运行在 Cloudflare Workers 环境中，利用 Cron 触发器和 KV 命名空间实现精确的定时提醒功能。该项目专注于单用户使用，并通过严格的授权机制确保您的任务安全。

## ✨ 主要功能

  * **单一 KV 存储：** 任务数据和会话状态统一存储在一个 KV 命名空间 (`TASKS_KV`) 中，简化了配置。
  * **单用户授权：** 严格限制仅预设的 `CHAT_ID` 才能发送命令和管理任务。
  * **多模式单次定时 (`/addone`)：**
      * 支持 `YYYY-MM-DD HH:MM` (年月日时分)。
      * 支持 `MM-DD HH:MM` (默认为今年)。
      * 支持 `HH:MM` (默认为当天)。
  * **每日重复定时 (`/add`)：** 快速设置每天固定时间发送的重复任务。
  * **任务自动清理：** 所有单次定时任务发送完成后，会自动从 KV 中清除。

## ⚙️ 部署要求

1.  **Cloudflare 账户：** 用于托管 Worker 和 KV 存储。
2.  **Telegram Bot Token：** 通过 BotFather 创建您的机器人并获取 Token。
3.  **您的 Chat ID：** 您用于接收提醒的 Telegram 用户或群组 ID。（可以通过向 [userinfobot](https://t.me/userinfobot) 发消息获取）。
4.  **最终代码：** 本次对话中为您提供的最终版本代码。

## 🚀 部署指南

### 步骤 1: 创建 KV 命名空间

在 Cloudflare 仪表盘中创建一个新的 KV 命名空间，例如命名为 `TGT_TASKS`。

### 步骤 2: 创建并配置 Worker

1.  创建一个新的 Worker 服务。
2.  将本次对话中为您提供的**最终代码**粘贴到 Worker 的代码编辑器中。
3.  进入 Worker 的 **设置 (Settings)** -\> **变量 (Variables)** 页面进行配置：

#### 2.1 环境变量 (Environment Variables)

| 名称 | 值 | 描述 |
| :--- | :--- | :--- |
| `BOT_TOKEN` | 您的 Telegram Bot Token | 机器人的密钥。 |
| `CHAT_ID` | 您的 Telegram 用户/群组 ID | 机器人将向此 ID 发送所有提醒和命令反馈。 |

#### 2.2 KV 命名空间绑定 (KV Namespace Bindings)

| 变量名称 | KV 命名空间 | 描述 |
| :--- | :--- | :--- |
| `TASKS_KV` | 绑定到您在**步骤 1**中创建的命名空间（如 `TGT_TASKS`）。 | 用于存储所有任务数据和会话状态。 |

### 步骤 3: 设置 Cron 触发器

1.  在 Worker 的 **触发器 (Triggers)** 页面，添加 **Cron 触发器**。
2.  设置 Cron 表达式为：`*/1 * * * *`
      * **作用：** 这将确保 Worker 每分钟运行一次，检查是否有到期的任务需要发送。

### 步骤 4: 设置 Webhook

将 Telegram Webhook 指向您的 Worker 的 URL，以确保您的 Worker 能实时接收 Telegram 消息。

请使用以下格式设置 Webhook，确保将 `[BOT_TOKEN]` 和 `[WORKER_URL]` 替换为您的实际值：

```
https://api.telegram.org/bot[BOT_TOKEN]/setWebhook?url=[WORKER_URL]/webhook
```

> 示例：如果您的 Worker URL 是 `https://tgtimer.workers.dev`，则 Webhook URL 是 `https://tgtimer.workers.dev/webhook`。

-----

## 📖 使用说明

所有命令都必须由配置在 `CHAT_ID` 中的用户或群组发送。

| 命令 | 示例 | 描述 |
| :--- | :--- | :--- |
| `/start` | `/start` | 显示命令列表。 |
| `/add` | `/add 09:00 记得每日打卡` | **每日重复任务。** 每天 09:00 (北京时间) 发送提醒。 |
| `/addone` | `/addone` | **单次定时任务**，进入多步设置模式（推荐）。 |
| `/list` | `/list` | 查看当前所有任务列表。 |
| `/del` | `/del 8a4b` | 删除 ID 前缀匹配的任务。 |
| `/cancel` | `/cancel` | 取消正在进行的 `/addone` 设置流程。 |

### `/addone` 多步设置模式

在回复 `/addone` 后，您将看到三个单次任务模式供选择：

| 选项 | 格式示例 | 任务类型 |
| :--- | :--- | :--- |
| **1** | `2026-11-09 12:30 服务器续费` | **单次**：完整日期时间。 |
| **2** | `11-09 12:30 抢购时间` | **单次**：月日时分，年份默认为当前年份。 |
| **3** | `12:30 每日午休提醒` | **单次**：时分，日期默认为今天。 |
