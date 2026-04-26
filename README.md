# CF-Simple-Worker

## 本项目用于收集一些我自己用ai写的一些方便使用Cloudflare的worker部署的小工具。

所有的项目均可通过复制woker.js代码，并在cf上选择worker部署“从hello world开始”，然后把代码粘贴到该worker项目，并按照具体的readme说明完成添加相应的变量或绑定KV等操作，从而实现简单的部署使用。

所有代码均为AI（主要是Gemini）编写，由我反复测试和修改后录入本项目。

1. Cloudflare-IP-Checker——用于查看当前IP

2. Cloudflare-Speedre——在cloudflare上实现建议的speedtest

3. HoneyPot——蜜罐系统，用于🎣

4. Telegram-Personal-AI-Assistant——在telegram上搭建ai助手

5. Telegram-Timer——在telegram上搭建定时器bot，配合设置telegram内置代理实现及时接收定时提示

6. Travel-Planner——用于直观的进行旅行规划，并支持到处markdown格式的规划书

7. IP-FILTER——用于实时从全球 Cloudflare 优选节点池中提取、筛选指定国家/地区的 IP，并生成适用于代理订阅平台的 CFnew 或 edgetunnel 的API订阅链接
   
8. Upload-md-picture——自动上传markdown中引用图片到R2存储桶的方案，实现方便的markdown图片管理。

9. 。。。
