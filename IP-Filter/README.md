# 🌍 Cloudflare 优选节点国家/地区筛选器 (增强版)

这是一个基于 Cloudflare Workers 的轻量级工具，用于实时从全球 Cloudflare 优选节点池中提取、筛选指定国家/地区的 IP，并生成适用于代理订阅平台的 `CFnew` 或 `edgetunnel` 订阅链接。

💡 **特别声明与致谢：**
本项目是从 [alienwaregf/Cloudflare-Country-Specific-IP-Filter](https://github.com/alienwaregf/Cloudflare-Country-Specific-IP-Filter) 的开源代码改进而来。在此对原作者的优秀框架，以及数据源提供者（CM 大佬、Joey 大佬）表示最诚挚的感谢！

---

## ✨ 新增与改进特性

相比于原版，此增强版进行了以下核心升级：

* 🔒 **后台密码保护：** 网页访问入口移至 `/admin` 并加入了 HTTP Basic 认证，防止你的 Worker 被他人滥用刷量。
* 🇨🇳 **解除地区限制：** 移除了对 `CN`（中国大陆）节点的强制屏蔽，现在可以自由获取所有存活地区的 IP。
* 🧹 **精准脏数据清洗：** 优化了正则表达式与匹配逻辑，严格校验 2 位字母的国家代码，彻底消灭了原版中“出现 `U` 卡片却无法获取 IP”的脏数据 Bug。
* 🔀 **动态随机打乱：** 每次通过 API 拉取节点时，程序会自动对该地区的 IP 池进行洗牌，确保每次获取的节点都不同，自动淘汰失效节点。

---

## 🚀 部署指南

本项目完全依赖 Cloudflare Workers 运行，零成本、免服务器。

### 1. 部署代码
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 在左侧菜单找到 **Workers & Pages** -> 点击 **Create application** -> **Create Worker**。
3. 为你的 Worker 起个名字，点击 **Deploy**。
4. 进入刚刚创建的 Worker，点击右上角的 **Edit code**。
5. 清空左侧编辑器里的默认代码，将本项目修改后的完整代码粘贴进去，点击右上角的 **Deploy** 保存。

### 2. 设置访问密码 (重要)
为了让密码验证生效并修改默认密码：
1. 返回 Worker 的详情页，点击 **Settings (设置)** 选项卡。
2. 在左侧菜单选择 **Variables and Secrets (变量和机密)**。
3. 点击 **Add variable (添加变量)**：
   * **Variable name (变量名称):** 输入 `PASSWORD`
   * **Value (值):** 输入你想要的密码（例如 `mysecret123`）
4. 点击 **Deploy** 保存。

*(注：如果不设置此环境变量，默认访问密码为 `666666`)*

---

## 📖 使用说明

### 1. 访问可视化后台
* 访问路径：`https://你的worker域名.workers.dev/admin` (访问根目录 `/` 会自动跳转)。
* **登录凭证：** 弹出的登录框中，用户名可**随意填写**（例如填 `admin`），密码填写你在上一步设置的 `PASSWORD`。
* 登录后，你可以通过点击国家卡片，可视化地生成 IP 列表，或一键复制 API 订阅地址。

### 2. API 订阅拉取 (客户端使用)
生成的 API 链接可以直接填入代理客户端的“订阅/Servers”设置中。**API 路径无需密码即可访问**，方便客户端自动更新。

**支持的格式：**
* **CFnew 格式:** `https://你的worker域名.workers.dev/CFnew/HK-SG-JP?limit=10`
* **edgetunnel 格式:** `https://你的worker域名.workers.dev/edgetunnel/US-GB?limit=5`

**URL 参数说明：**
* 路径中的 `HK-SG-JP` 为你需要提取的国家代码组合，使用 `-` 隔开。
* `?limit=10` 为**单地区**获取上限限制。如果不加该参数或设置为 `0`，则返回该地区所有存活 IP。

### 3. 建议的最佳实践
强烈建议在你的客户端（Clash / v2rayN 等）中，将该订阅链接的**自动更新频率设置为“每日更新”**。因为本程序具备随机洗牌机制，每日更新可以确保你淘汰死节点，永远获取最新鲜的优选 IP。
