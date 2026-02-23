# 🌐 Network Locator 部署手册

> 以下为PLUS版部署说明，对应代码为`Worker_Plus.js`，简单版本`worker.js`无须绑定密码和KV，只粘贴代码即可使用。
> 
这是一个基于 **Cloudflare Workers** 和 **KV 数据库** 构建的轻量级 IP 查询与访客统计系统。

### ✨ 核心功能

* **实时检测**：显示访问者 IP、详细地理位置、ASN 运营商信息。
* **IP 属性预判**：自动识别机房（数据中心）IP 或住宅/移动网络 IP。
* **交互地图**：根据访问者位置自动切换高德地图（中国境内）或 Google 地图（境外）。
* **访客全景（/graph）**：记录最近 100 位访客，并在全球地图上标记归属地。
* **安全保护**：统计页面支持环境变量密码验证。
* **视觉效果**：毛玻璃 UI 设计，支持动态交互式水波纹背景。

---

## 🛠️ 部署步骤

### 1. 创建 KV 命名空间

1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)。
2. 导航至 **Workers & Pages** -> **KV**。
3. 点击 **Create a namespace**，名称命名为 `VISITOR_STORAGE`（或者你喜欢的名字）。

### 2. 创建 Worker 并部署代码

1. 点击 **Create application** -> **Create Worker**，起个名字（如 `ip-locator`）。
2. 点击 **Deploy** 后的 **Edit Code**。
3. 将项目代码全部粘贴进去，点击 **Save and deploy**。

### 3. 绑定 KV 与 设置密码 (关键)

1. 回到该 Worker 的管理界面，点击 **Settings** 选项卡。
2. **绑定 KV**：在 **Variables** -> **KV Namespace Bindings** 中点击 **Add binding**：
* **Variable name**: 必须填写 `VISITOR_KV` (代码中引用的变量名)。
* **KV namespace**: 选择你刚才创建的那个空间。


3. **设置访问密码**：在 **Environment Variables** 区域点击 **Add variable**：
* **Variable name**: `GRAPH_AUTH_CODE`
* **Value**: 设置你的进入密码（如 `admin888`）。


4. 点击 **Save and deploy**。

---

## 🖼️ 如何设置背景图

本项目采用了单张高清背景图，并配合水波纹（Ripples）特效。修改背景图非常简单：

1. 在代码中搜索关键字 `background-image` 或图片链接 `https://tc.john-life.sbs/api/rfile/girlpuppy.jpg`。
2. 你会发现代码中有 **两处** 需要修改（一处是主页，一处是 `/graph` 页面）：

### 修改点一：主页面背景

在 `export default` 的 `body` 样式表中：

```css
body { 
  /* ...其他样式... */
  background-image: url('这里替换成你的图片直链');
  /* ...其他样式... */
}

```

### 修改点二：统计页与验证页

在 `generateAuthHTML` 和 `renderGraphPage` 两个函数中，同样搜索 `background-image` 并替换 URL。

> **💡 小贴士**：
> * 建议使用 **1920x1080** 以上分辨率的高清图。
> * 请使用**直链**（链接以 `.jpg`, `.png`, `.webp` 结尾），否则水波纹效果可能无法加载。
> 
> 

---

## 📁 路径说明

* `/` : 主页面，查看当前 IP 信息。
* `/graph` : 访客统计仪表盘（需密码验证）。

---

## ⚠️ 常见问题

* **地图加载不出来？** 如果你在中国境内访问，代码会自动调用高德地图；境外则调用 Google 地图。请确保网络环境可以正常连接对应的地图服务商。
* **提示 KV 错误？** 请检查环境变量名是否精准设置为 `VISITOR_KV`，且已点击“部署”生效。
