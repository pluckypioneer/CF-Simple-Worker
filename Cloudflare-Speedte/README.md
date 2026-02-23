# CF Speedtest 部署与配置指南
本项目是一个基于 Cloudflare Workers 的高性能网络测速工具，具备简单的密码验证功能和 3D 翻转历史记录界面。

一个运行在边缘计算节点（Cloudflare Workers）上的私有化测速工具。

安全：内置简单的 Cookie 鉴权，只有知道密码的人才能使用。

极速：直接从最近的边缘节点生成垃圾流，测试真实下行带宽。

美观：采用毛玻璃（Glassmorphism）设计风格，支持 3D 翻转查看历史。

## 🚀 快速部署
- 登录 Cloudflare Dashboard。

-进入 Workers & Pages -> Create application -> Create Worker。

- 给你的 Worker 命名（如 cf-speedtest）。

- 将代码粘贴到编辑区域，点击 Deploy。

- 部署完成后，可以通过分配的 .workers.dev 域名访问。

## 🛠️ 自定义配置指南
你可以直接修改代码中的变量或 HTML 模板来个性化你的网站。

1. 修改访问密码
在代码的最上方找到常量定义区，修改 ACCESS_PASSWORD：

```JavaScript
const ACCESS_PASSWORD = "你的新密码";
```
提示：修改密码后，建议同步修改` COOKIE_VALUE `的末尾数字，以强制旧用户重新登录。

2. 修改网站名称
在 generateLoginHTML 和 generateHTML 函数中，搜索 JZのSpeedtest 或 JZのAUTH 并将其替换为你想要的名字。例如：

```JavaScript
<title>MySpeedtest</title>
// 以及
<div class="brand">Myの<b>Speedtest</b></div>
```

3. 修改网站背景图
背景图在登录页和主界面都有定义，你需要修改 CSS 中的 background 属性：

```CSS
/* 登录页 background */
body {
    background: url('这里填入你的新图片地址') no-repeat center center fixed;
}

/* 主界面 background */
body {
    background: url('这里填入你的新图片地址') no-repeat center center fixed;
}
```
建议使用 CDN 链接以保证加载速度。

4. 修改网站 Logo（图标）
在 generateHTML 函数的 <head> 标签内找到 link 标签：

```HTML
<link rel="icon" href="https://你的新图标地址.ico" type="image/x-icon">
```

## 📊 测速原理简述
该工具通过 HTML5 的 fetch API 开启多个并行线程（默认 6 线程），向 Worker 请求名为 /down 的接口。Worker 会实时生成 Uint8Array 垃圾数据流并传回浏览器。浏览器通过计算单位时间内接收到的字节数来得出 Mbps。
代码中通过生成 1MB 的虚拟数据流进行压力测试。你可以通过调整 THREADS = 6（并发线程数）和 TEST_TIME = 12000（测试时长，单位毫秒）来优化测速结果的准确性。

## ⚠️ 注意事项

密码安全性：该方案使用前端校验，仅适合个人使用，不建议用于存储敏感数据。

流量消耗：测速会消耗 Cloudflare Worker 的流出流量。虽然 Cloudflare 免费额度较高，免费版 Workers 有 CPU 时间限制，若多人同时测速，可能触发配额限制,请勿在大规模公开场合宣传，以免产生非预期费用或触发限制。

准确性：由于 Worker 的运行限制，测速结果主要反映`您的设备到 Cloudflare 节点`的连接速度，而非到目标网站的真实速度。

## 💡 进阶建议
如果你想让背景图在手机端也完美显示，建议使用 background-size: cover;（代码中已预设）。如果你发现图片太亮影响文字阅读，可以通过修改 rgba(0, 0, 0, 0.4) 中的透明度参数（0.4 代表 40% 的遮罩），让背景变暗以突出文字。
