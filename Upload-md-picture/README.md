# Cloudflare R2 + Worker —— Typora 图床部署指南

本指南将引导你完成基于 Cloudflare R2 对象存储和 Cloudflare Worker 的 Typora 图床及可视化管理面板的完整部署。

## 前置准备

1. 一个 [Cloudflare](https://dash.cloudflare.com/) 账号。
2. 本地已安装 [Python 3](https://www.python.org/) 环境。
3. 本地已安装 Markdown 编辑器 [Typora](https://typora.io/)。

---

## 第一步：配置 Cloudflare R2 存储桶

1. 登录 Cloudflare 控制台，在左侧导航栏选择 **R2**。
2. 点击 **创建存储桶 (Create bucket)**，输入存储桶名称（例如：`typora-images`），点击创建。
3. （可选，但推荐）进入该存储桶的 **设置 (Settings)**，找到 **公开访问 (Public Access)**：
   - 点击 **连接自定义域 (Connect Custom Domain)**，绑定你托管在 Cloudflare 的域名（例如 `img.yourdomain.com`）。
   - 或者点击允许访问 `*.r2.dev` 子域（提供默认的公开访问链接）。

## 第二步：创建并配置 Cloudflare Worker

1. 在 Cloudflare 控制台左侧导航栏选择 **Workers & Pages**。
2. 点击 **创建 (Create application)** -> **创建 Worker (Create Worker)**，命名（例如：`r2-image-bed`）并点击部署。
3. 进入刚刚创建的 Worker 详情页，点击顶部选项卡中的 **设置 (Settings)**。
4. **配置环境变量：**
   - 在左侧菜单选择 **变量和机密 (Variables & Secrets)**。
   - 在 **环境变量 (Environment Variables)** 区域点击 **添加变量 (Add variable)**，依次添加以下 3 个变量：
     - `AUTH_TOKEN`: 填入你自定义的 API 通信密钥（点击“加密”设为机密）。
     - `WEB_PASSWORD`: 填入你用于登录可视化面板的网页密码（点击“加密”设为机密）。
     - `R2_DOMAIN`: 填入你图床的访问域名，带 `https://`（例如：`https://img.yourdomain.com` 或 Worker 自身的 `workers.dev` 域名）。
5. **绑定 R2 存储桶：**
   - 在同一个 **设置 (Settings)** 页面往下滚动，找到 **R2 存储桶绑定 (R2 Bucket Bindings)**。
   - 变量名必须填写：`MY_BUCKET`。
   - 选择你在第一步中创建的存储桶（`typora-images`），保存。

## 第三步：部署 Worker 代码

1. 回到 Worker 详情页，点击右上角的 **编辑代码 (Edit code)**。
2. 清空编辑器中的默认代码，将本项目提供的完整 `worker.js` 代码粘贴进去。
3. 点击右上角的 **部署 (Deploy)**。

## 第四步：配置本地 Python 上传脚本

1. 打开本地终端 / 命令行，安装 HTTP 请求库：
   ```bash
   pip install requests
   ```
2. 在电脑的某个目录下（如 `D:\scripts\` 或 `~/scripts/`）新建一个文件 `upload.py`。
3. 将以下代码填入 `upload.py`，并修改头部的配置项：

   ```python
   import sys
   import os
   import requests
   import time

   # 1. 替换为你部署好的 Worker 地址
   WORKER_URL = "[https://你的Worker地址.workers.dev](https://你的Worker地址.workers.dev)" 
   
   # 2. 替换为你在 Worker 环境变量中设置的 AUTH_TOKEN
   TOKEN = "你的AUTH_TOKEN"

   for filepath in sys.argv[1:]:
       ext = os.path.splitext(filepath)[1]
       filename = f"img_{int(time.time() * 1000)}{ext}"

       with open(filepath, 'rb') as f:
           headers = {
               'Authorization': f'Bearer {TOKEN}',
               'X-File-Name': filename
           }
           response = requests.post(WORKER_URL, headers=headers, data=f)
           
           if response.status_code == 200:
               print(response.text)
           else:
               print(f"Upload Error: {response.text}")
   ```

## 第五步：对接 Typora

1. 打开 Typora，进入 **偏好设置 (Preferences)** -> **图像 (Image)**。
2. 在“插入图片时...”选项中，推荐勾选 **上传图片**。
3. 上传服务设定选择 **自定义命令 (Custom Command)**。
4. 在命令输入框中填入执行 Python 脚本的命令。注意路径必须是绝对路径：
   - **Windows 示例**: `python "D:\scripts\upload.py"`
   - **Mac/Linux 示例**: `python3 "/Users/username/scripts/upload.py"`
5. 点击 **验证图片上传选项 (Test Uploader)**，如果提示成功并返回了正确的 URL，则配置完成。

## 第六步：访问可视化面板

1. 在浏览器中打开你设置的 `R2_DOMAIN` 网址（或 Worker 的运行网址）。
2. 浏览器会弹出一个原生的要求输入用户名和密码的提示框（Basic Auth）：
   - **用户名**: 任意填写（如 `admin`）。
   - **密码**: 填写你在环境变量中设置的 `WEB_PASSWORD`。
3. 验证通过后，即可进入可视化图床管理面板，进行图片的查看、复制直链和删除操作。
```
