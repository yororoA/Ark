方案二（内网穿透）最简单的是使用 **Cloudflare Tunnel** 或 **ngrok**。这里以开发 Next.js 最常用的 **Cloudflare Tunnel** 为例。

## 方案：Cloudflare Tunnel 暴露本地 Next.js

你的当前服务：

```bash
npm run dev
```

运行：

```
http://localhost:9999
```

目标：

生成一个公网地址：

```
https://xxxx.trycloudflare.com
```

别人打开这个地址即可访问你的本地项目。

---

## 1. 安装 cloudflared

### Windows

推荐直接下载安装：

[Cloudflare Tunnel 官方文档](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/?utm_source=chatgpt.com)

或者使用 winget：

```powershell
winget install Cloudflare.cloudflared
```

安装完成后检查：

```powershell
cloudflared --version
```

能显示版本即可。

---

## 2. 启动你的 Next.js

保持你的配置：

```json
{
  "scripts": {
    "dev": "next dev --hostname 0.0.0.0 --port 9999"
  }
}
```

运行：

```powershell
npm run dev
```

确认：

```
Local: http://localhost:9999
```

可以打开。

---

## 3. 创建临时公网隧道

新开一个 PowerShell：

执行：

```powershell
cloudflared tunnel --url http://localhost:9999
```

等待几秒。

你会看到类似：

```
Your quick Tunnel has been created!

https://random-name.trycloudflare.com
```

例如：

```
https://abc-def.trycloudflare.com
```

把这个地址发给别人即可。

---

## 4. 测试

别人访问：

```
https://abc-def.trycloudflare.com
```

请求路径：

```
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

不需要：

* 开防火墙9999端口
* 配路由器
* 公网IP
* 同一个WiFi

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

## ngrok 方案（更简单）

安装：

[ngrok 官方网站](https://ngrok.com/?utm_source=chatgpt.com)

启动：

```powershell
ngrok http 9999
```

得到：

```
Forwarding
https://xxxx.ngrok-free.app -> http://localhost:9999
```

也是直接访问。

---

对于你现在这种 **Next.js 前端开发调试**，我更推荐：

* 临时给别人看效果 → `cloudflared tunnel --url http://localhost:9999`
* 团队协作 → Cloudflare Tunnel + 固定域名
* 手机测试动画/UI → Cloudflare Tunnel 最方便

你现在已经用了 `--hostname 0.0.0.0`，所以不需要改 Next.js 配置，直接启动 tunnel 即可。
