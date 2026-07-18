# 内网穿透

## 1. Cloudflare Tunnel

## 1. 安装 cloudflared

### Windows

[Cloudflare Tunnel 官方文档](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/?utm_source=chatgpt.com)

winget：

```powershell
winget install Cloudflare.cloudflared
```

安装完成后检查：

```powershell
# 能显示版本即可。
cloudflared --version
```

---

## 2. 启动 Next.js

`package.json`：

```json
{
  "scripts": {
    "dev": "next dev -H 0.0.0.0 -p 9999"
  }
}
```

运行：

```powershell
npm run dev
```

---

## 3. 创建临时公网隧道

新开一个 PowerShell：

执行：

```powershell
cloudflared tunnel --url http://localhost:9999
```

等待几秒。

你会看到类似：

```plaintext
Your quick Tunnel has been created!

https://random-name.trycloudflare.com
```

例如：

```plaintext
https://abc-def.trycloudflare.com
```

---

## 4. 测试

访问：

```plaintext
https://abc-def.trycloudflare.com
```

请求路径：

```plaintext
浏览器
 ↓
Cloudflare节点
 ↓
你的电脑 cloudflared
 ↓
localhost:9999
 ↓
Next.js
```

---

## 5. 注意 Next.js 热更新

开发模式下：

```bash
next dev
```

可能出现 HMR(WebSocket) 连接问题。

可以修改：

`.env.local`

添加：

```env
NEXT_PUBLIC_HOST=https://你的隧道地址
```

或者直接关闭 HMR 测试：

```bash
next dev --hostname 0.0.0.0 --port 9999
```

一般 Cloudflare Tunnel 已经可以正常支持。

---

## 2. ngrok

[ngrok 官方网站](https://ngrok.com/?utm_source=chatgpt.com)

启动：

```powershell
ngrok http 9999
```

得到：

```plaintext
Forwarding
https://xxxx.ngrok-free.app -> http://localhost:9999
```

---
