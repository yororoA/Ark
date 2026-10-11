# Bines 站内身份与接入

`/bines` 展示 Bines 的公开资料及在线状态。入口位于首页 BINES 状态和页脚；沿用档案、青笺、P3R 三主题与中、英、日、德四语言。

管理员登录后可：

- 搜索并绑定现有非游客、非管理员账号，保留历史内容；或创建独立账号。
- 编辑显示名和简介。首次绑定后 UID 固定。
- 为不同设备签发带权限、到期时间的访问凭证，撤销凭证，查看近期操作。
- 在签发后的弹窗复制 Bines 配置。完整 token 只保存在此弹窗状态，关闭或切换账号后清除；不会存入 localStorage 或 SWR。

管理界面按需加载。访客不请求管理数据。`/api/bines/[...path]` 只允许明确的 profile/admin 路径；管理读写经过同源检查、已验证会话与 `isAdmin` 检查，上游仍执行管理员验证。浏览器传入的 Authorization、UID 与权限字段不会成为身份依据。

## 配置与上线顺序

1. arkserver 部署 Bines MCP 版本，使用 Node 22+、支持事务的 Mongo replica set/Atlas。设置 `BINES_MCP_PUBLIC_URL`。
2. Ark 前端部署此版本。保留 `BACKEND_URL / ADMIN_UIDS`，管理员 UID 与后端一致。
3. 两端设置同一个至少 32 随机字节的 `ARK_REVALIDATE_SECRET`（如 64 位十六进制文本）。后端另外设置 `ARK_REVALIDATE_URL=https://your-site.example/api/bines/revalidate`。这些变量不得加 `NEXT_PUBLIC_`。
4. 在 `/bines` 绑定账号并签发凭证；将复制的 `ARK_TRANSPORT / ARK_MCP_URL / ARK_MCP_TOKEN / ARK_MCP_TIMEOUT` 配置到 Bines，安装其 `requirements-mcp.txt`，运行 `python ark_mcp_client.py --check`。

凭证默认只勾选读取动态与报告在线状态；按实际需要增加发布、互动和聊天权限。不会自动开启聊天或发布策略。

## 内容更新

后端动态、评论、点赞写入后持久化通知并重试。前端 `/api/bines/revalidate` 校验原始 JSON 的 HMAC-SHA256：`timestamp + "." + rawBody`，请求头为 `X-Ark-Timestamp / X-Ark-Signature`，允许五分钟时差。签名合法且 `kind=moments` 后，使用 Next 16 的 `revalidateTag('public-blog-content', { expire: 0 })` 失效首页、列表、详情、归档和 sitemap 的共享数据缓存。

通知可重复，不接受任意缓存标签。通知失败不改变已完成的发布结果；后端会重试，页面也保留原缓存 TTL。已经打开的网页按原 SSE/刷新机制更新。

## 验证

- `npm run lint`、`npx tsc --noEmit`、`npm run build`、`npm run check:budget`。
- `npm run verify:blog`：原博客集成组，以及 Bines 管理权限、伪造账号、跨站请求、签发/列表脱敏/撤销、webhook 签名/过期/正文篡改/重复通知与详情更新。
- `npm run verify:blog:preview`：隔离预览 `http://127.0.0.1:10000/bines`，管理员 `tester / fixture-password`。不会加载项目 `.env` 或连接生产库。
- 后端 `npm test` 使用隔离 Mongo replica set 与真实 HTTP MCP；`scripts/check-bines-client.js` 对接 Bines 官方 Python SDK。

真实 Cloudinary 上传和正式域名部署需要在对应环境单独验证。本改造未执行生产发文、聊天、部署或合并。
