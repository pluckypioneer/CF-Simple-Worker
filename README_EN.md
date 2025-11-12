# 📄 ChronoAlert: Telegram Timer Bot (Cloudflare Worker)

## Introduction

ChronoAlert is a lightweight, secure, and self-hosted Telegram reminder bot. It runs entirely on the **Cloudflare Workers** platform, utilizing Cron Triggers and KV storage to provide reliable scheduled alerts. The project is designed for single-user operation, enforced by a strict authorization mechanism to ensure the security of your tasks.

## ✨ Key Features

  * **Single KV Storage:** Task data and session state are consolidated into one KV Namespace (`TASKS_KV`), simplifying deployment.
  * **Single-User Authorization:** Strictly limits command execution and task management to a single, predefined `CHAT_ID`.
  * **Multi-Mode Single Task (`/addone`):** Flexible scheduling for one-time tasks:
      * Full date/time: `YYYY-MM-DD HH:MM`
      * Month/Day/Time: `MM-DD HH:MM` (defaults to the current year).
      * Time only: `HH:MM` (defaults to the current day).
  * **Daily Repeat Shortcut (`/add`):** Quick setup for daily recurring tasks.
  * **Automatic Cleanup:** All single-time tasks are automatically deleted from KV storage immediately after the reminder is sent.

## ⚙️ Prerequisites

1.  **Cloudflare Account:** Required for hosting the Worker and KV store.
2.  **Telegram Bot Token:** Obtained by creating your bot via BotFather.
3.  **Your Chat ID:** The user or group ID where you wish to receive alerts.

## 🚀 Deployment Guide

### Step 1: Create KV Namespace

In your Cloudflare dashboard, create a new KV Namespace. We recommend naming it something descriptive, like `TGT_TASKS`.

### Step 2: Configure and Deploy the Worker

1.  Create a new Worker Service.
2.  Paste the **final code** from our conversation into the Worker editor.
3.  Navigate to the Worker's **Settings** -\> **Variables** page for configuration.

#### 2.1 Environment Variables

| Name | Value | Description |
| :--- | :--- | :--- |
| `BOT_TOKEN` | Your Telegram Bot Token. | The secret token provided by BotFather. |
| `CHAT_ID` | Your Telegram User/Group ID. | Only this ID can send commands to the bot. |

#### 2.2 KV Namespace Binding

| Variable Name | KV Namespace | Description |
| :--- | :--- | :--- |
| `TASKS_KV` | Bind to the Namespace created in **Step 1** (e.g., `TGT_TASKS`). | Used for all task data and session state. |

> ⚠️ **IMPORTANT SECURITY NOTE:** If you are reusing an existing KV namespace, you **must clear all existing data** to prevent conflicts with the new task schema.

### Step 3: Set up Cron Trigger

1.  In the Worker's **Triggers** page, add a **Cron Trigger**.
2.  Set the Cron Expression to: `*/1 * * * *`
      * This ensures the Worker runs every minute to check for expiring tasks.

### Step 4: Set the Webhook

Point the Telegram Webhook to your Worker's URL to enable real-time message reception.

Use the following format, replacing `[BOT_TOKEN]` and `[WORKER_URL]` with your actual values:

```
https://api.telegram.org/bot[BOT_TOKEN]/setWebhook?url=[WORKER_URL]/webhook
```

## 📖 Usage and Commands

All reminders are scheduled and triggered based on **Beijing Time (BJT / UTC+8)**.

| Command | Example | Task Type | Description |
| :--- | :--- | :--- | :--- |
| `/start` | `/start` | N/A | Displays the command list. |
| `/add` | `/add 09:00 Daily task content` | **Daily Repeat** | Sets a task to fire every day at the specified time. |
| `/addone` | `/addone` | **Single Task** | Enters the multi-step setup mode. |
| `/list` | `/list` | N/A | Shows the current list of scheduled tasks. |
| `/del` | `/del 8a4b` | N/A | Deletes the task matching the provided ID prefix. |
| `/cancel` | `/cancel` | N/A | Exits the `/addone` multi-step setup flow immediately. |

### `/addone` Single Task Modes

After typing `/addone`, you must choose the input format for your one-time task:

| Option | Input Format Example | Schedule Determined By |
| :--- | :--- | :--- |
| **1** | `2026-11-09 12:30 Server renewal alert` | Full date and time. |
| **2** | `11-09 12:30 Birthday reminder` | Month/Day/Time (Year defaults to current). |
| **3** | `12:30 Take a quick break` | Hour/Minute (Date defaults to today). |
