这是一份为你量身定制的**纯网页端部署指南**。你不需要在电脑上安装任何代码工具，全程只需在浏览器里“点点鼠标、复制粘贴”即可完成部署。

---

# 🚀 极简全栈旅行规划师 - Cloudflare 部署指南

本项目采用 **Cloudflare Workers (后端 + 前端托管)** 和 **Cloudflare D1 (Serverless SQLite 数据库)** 构建，完全免费且无需维护服务器。

## 准备工作
1. 拥有一个 [Cloudflare](https://dash.cloudflare.com/) 账号（免费注册）。
2. 准备好上一条回复中提供的完整 `worker.js` 代码。

---

## 第一步：创建 D1 数据库并建表

我们首先需要建立存储用户数据和旅行规划的数据库。

1. 登录 Cloudflare 控制台，在左侧导航栏点击 **“Storage & Databases” (存储和数据库)** -> **“D1 SQL Database”**。
2. 点击右上角的 **“Create database” (创建数据库)**，起名为 `travel-db`，然后点击创建。
3. 创建成功后，点击进入这个 `travel-db` 数据库。
4. 切换到 **“Console” (控制台)** 选项卡。
5. 将以下 **SQL 建表语句** 复制粘贴到输入框中，然后点击 **“Execute” (执行)**：

```sql
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    max_plans INTEGER DEFAULT 20,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    user_id INTEGER,
    title TEXT NOT NULL,
    content_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
```
*(执行成功后，下方会提示 `Execution successful`，数据库准备完毕！)*

---

## 第二步：创建 Worker 实例

1. 在 Cloudflare 左侧导航栏点击 **“Workers & Pages”**。
2. 点击右上角的 **“Create application” (创建应用)**。
3. 在新页面点击 **“Create Worker” (创建 Worker)** 按钮。
4. 给你的应用起个好记的名字，比如 `travel-planner`，然后点击右下角的 **“Deploy” (部署)**。（先不管里面的默认代码）。

---

## 第三步：绑定数据库 (关键步骤 ⚠️)

为了让 Worker 能读写我们刚创建的数据库，必须进行变量绑定。

1. 在刚部署成功的 Worker 页面，点击 **“Configure worker” (配置 Worker)** 进入详情页。
2. 切换到 **“Settings” (设置)** 选项卡。
3. 在左侧内部菜单找到并点击 **“Bindings” (绑定)**。
4. 点击 **“Add Binding” (添加绑定)**，在下拉菜单中选择 **“D1 database”**。
5. 填写绑定信息：
   - **Variable name (变量名)**：填写大写的 `DB` （必须完全一致，代码依赖这个变量）。
   - **D1 database**：在下拉框中选择你刚才创建的 `travel-db`。
6. 点击 **“Deploy”** 保存绑定设置。

---

## 第四步：粘贴完整代码

1. 回到该 Worker 的详情页，点击右上角的 **“Edit code” (编辑代码)** 按钮。
2. 在左侧文件树中选中 `worker.js`。
3. **清空右侧编辑器里的所有默认代码**。
4. 将之前发给你的**最新版完整 `worker.js` 代码**原封不动地粘贴进去。
5. 点击右上角的 **“Deploy” (部署)** 按钮。

🎉 **恭喜！你的应用已经上线了！**
在编辑器右上角或者 Worker 详情页，你可以找到类似 `https://travel-planner.<你的子域名>.workers.dev` 的专属链接，点击即可访问你的旅行规划工具。

---

## 第五步：设置管理员账号 (可选)

管理员账号可以无限制存储规划书，并且不受额度限制。

1. 打开你刚部署好的网站链接。
2. 点击左上角的“登录/注册”，注册一个你自己的账号（例如用户名：`myadmin`）。
3. 回到 Cloudflare 控制台 -> **“Storage & Databases”** -> **“D1”** -> 进入 `travel-db`。
4. 切换到 **“Console” (控制台)**，执行以下提权 SQL 语句（把 `myadmin` 换成你刚才注册的用户名）：

```sql
UPDATE users SET role = 'admin' WHERE username = 'myadmin';
```
5. 刷新你的旅行规划网站，你会发现该账号的配额已经变成了 **“(配额: 无限制)”**。

---

### 💡 常见问题排查

- **Q: 为什么点击“云端保存”报错？**
  A: 请检查【第三步】是否正确完成。`Variable name` 必须是 `DB`，且必须选中了 D1 数据库。
- **Q: 如何修改普通用户的默认额度（20条）？**
  A: 如果你想要新注册的用户拥有更多或更少的额度，只需在 Cloudflare 的 D1 Console 中执行：`UPDATE users SET max_plans = 新数字;` 即可全局修改现有用户的额度，或者在代码的 `/api/auth/register` 路由中修改插入语句的默认值。
