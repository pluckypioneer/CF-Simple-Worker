import sys
import os
import requests
import time

# 你的 Worker 地址和刚才设置的密码
WORKER_URL = "https://r2-image-upload.yourname.workers.dev" 
TOKEN = "MySuperSecretToken123"

# Typora 会把图片路径作为参数传给脚本 (sys.argv[1:])
for filepath in sys.argv[1:]:
    # 生成一个带时间戳的文件名，防止重名覆盖
    ext = os.path.splitext(filepath)[1]
    filename = f"typora_{int(time.time())}{ext}"

    with open(filepath, 'rb') as f:
        headers = {
            'Authorization': f'Bearer {TOKEN}',
            'X-File-Name': filename
        }
        # 发送请求到 Cloudflare Worker
        response = requests.post(WORKER_URL, headers=headers, data=f)
        
        if response.status_code == 200:
            # Typora 通过读取标准输出来获取图片 URL
            print(response.text)
        else:
            print(f"Upload Error: {response.text}")
