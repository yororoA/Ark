# YororoIce Blog → Ark

## 来源与基线

- 分支：`feat/ark-blog-anniversary`，从 `origin/main` 的 `ffc45dd` 创建。
- 旧首页试验保留于 `cursor/home-cover-redesign-e31e`，不合并。
- 前端：[yororoIceBlog_React](https://github.com/yororoA/yororoIceBlog_React)，盘点版本 `398f7e2`。
- 后端：[yororoIceBlogBackend](https://github.com/yororoA/yororoIceBlogBackend)，盘点版本 `9ff4213`。
- 视觉参考：[六周年庆典活动宣传 PV](https://www.bilibili.com/video/BV15HLdz6E99/)，实际第一分 P1 约 4:35；元数据总时长包含重复分 P，分析以 P1 为准。
- 本地研究资料位于 `.git/ark-research/`，不作为应用依赖或提交内容。

## 视觉转译

| 时间 | 已观察到的设计 | Ark 应用 |
| --- | --- | --- |
| 00:24 / 00:34 | 蓝色测绘底、细线圆环、数字与轮廓 | 背景细线、局部圆环，作为构图而非假数据 |
| 00:45 / 00:54 | 白底高曝光、衬线字拆分重叠、线稿 | 首页大字、品牌字标、分层进场 |
| 02:20 | 白底朱红弧形、错位文字、紧凑说明栏 | 首页主视觉、激活态、栏目标题 |
| 03:26 | 明亮底色、环形主体、左右错位信息 | 图库和内容封面构图 |
| 03:36 | 黑白铜色、巨大竖排字、四角星 | 深色章节、导航细节 |
| 04:15 | 大小悬殊的模块、留白、轻背景 | 内容列表层级，避免平均卡片网格 |

视觉原则见根目录 `.uicraft.md`。从 PV 学习平面结构与动效，不将视频画面作为网站背景直接铺贴。

## 功能与路由清单

| 旧站功能 / 路由 | Ark 目标 | 核心契约 |
| --- | --- | --- |
| `/town` | `/home`，`/` 导向首页 | 个人资料、Bines 状态、GitHub 统计、最新内容、内容日历 |
| `/town/articles?kid=…` | `/articles`、`/articles/[id]` | 搜索、分类、分页、Markdown 阅读/导出、点赞、发布/编辑/删除、图片上传 |
| `/town/moments?mid=…` | `/moments`、`/moments/[id]` | 列表、日期筛选、媒体、评论/回复/点赞、发布、草稿、删除 |
| `/town/gallery` | `/gallery` | 图片/视频、预览、上传、真实 hasMore |
| `/town/archive` | `/archive` | 类型/年份筛选、时间线、统计、跳转详情 |
| `/town/chat/*` | `/chat` | 群聊/与管理员私聊、历史分页、回复、媒体、SSE |
| `/town/other` | `/about` | 个人信息、友链/工具分类、留言板、管理员友链维护 |
| `/town/lol` | `/lab` | 旧版函数变速播放器工具保留 |
| `/account/*` | `/login` 与 `/terms` | Ark 现有多账号登录、注册、游客、验证码、退出、约定文案 |
| 全局体验 | 博客共享布局 | 中/英/日/德、主题、公告、移动导航、返回顶部、实时更新 |

旧 `/town`、`kid`、`mid`、`/account` 链接应转到对应新地址并保留参数。数据库 ID、已有 Markdown 内容和 Cloudinary 媒体不需要改写。

## 已核实的接口

所有内容接口共享既有 Express + MongoDB 后端；浏览器通过 Ark 的同源 Route Handler 调用。`BACKEND_URL` 只在服务端使用。

| 模块 | 接口（相对于 `/api` 或 `/api/v2`） |
| --- | --- |
| 文章 | `GET/POST knowledge`、`GET/PUT/DELETE knowledge/:id`、`GET knowledge/meta/categories`、`GET knowledge/liked`、`POST knowledge/like`、`POST knowledge/upload-image` |
| 动态 | `GET moments/get?isEditing=false`（草稿为 true）、`POST moments/post`（multipart）、`DELETE moments/delete`、`POST moments/view`、`GET moments/files` |
| 评论/点赞 | `POST moments/comment/get`（commentIds）、`POST moments/comment/post`（momentId/comment/belong）、`POST moments/comment/like`、`GET moments/comments/liked`、`GET moments/liked`、`POST moments/like` |
| 图库 | `GET gallery/get`、`POST gallery/post`（multipart） |
| 归档 | `GET archive?type=moment&year=…&page=…`（文章类型为 knowledge）、`GET archive/stats` |
| 关于 | `GET about`、`GET links`、`POST/PUT/DELETE admin/links[/id]`、`GET/POST guestbook` |
| 状态 | `GET status/bines`、`GET github/summary` |
| 聊天 | `GET chat/conversations`、`GET chat/history?type=…&userId=…`、`POST chat/send`、`POST chat/upload`、`GET chat/hasPrivate` |
| 实时 | `GET sse/subscribe`；moment/comment/moment-like/comment-like/article/guestbook/chat 事件 |

## 兼容性重点

1. **两代鉴权不同。** 旧站为 token + uid 请求头；Ark 登录为 HttpOnly Cookie。服务端适配层负责当前账号凭据转发，不在客户端存储或展示 token。
2. **V2 公共路由排除匹配异常。** `auth-v2` 处于挂载的子 router，`req.path` 不含 `/api/v2`，但排除列表包含此前缀。实际匿名请求 `/api/knowledge?limit=1` 为 200，`/api/v2/knowledge?limit=1` 为 401。公开内容使用既有 V1 公共读取接口；需要身份的请求使用经过验证的适配方式，不能依赖客户端 uid 自报身份。
3. **游客 Cookie 名称不一致。** Ark 保存 `blog_guest_token`，后端 V2 只从 `blog_tokens` 中按 `blog_active_uid` 查找。转发与续期必须兼容，同时保留其他账号。
4. **Token 续期。** V1 通过 `X-Refreshed-Token`，V2 通过 `Set-Cookie`；同源适配层需要把续期写回浏览器。SSE 中的 token 事件不能直接暴露给前端脚本。
5. **文章 GET 会增加浏览量。** 避免额外调用 `/knowledge/view` 造成重复，也避免为预取额外读取详情。
6. **混合归档服务端最多各取 20 条。** 全量时间线应从文章分页与动态列表构建，或明确保留此上限，不能显示成完整历史。
7. **图库当前没有真实游标分页。** 后端忽略 continueFrom，返回 `hasMore:false`；不能把相同文件重复追加。
8. **动态无已发布内容更新接口。** 保留发布/草稿/删除能力，不伪造编辑成功。草稿重新提交会新建文档。
9. **About PUT 尚未实现持久化。** 不展示虚假的资料编辑成功功能。
10. **旧站计划中的改密/重置密码未实现。** 不列作已存在功能或迁移完成项。

## 验证依据

2026-10-02，只读探测已确认配置的后端健康检查返回 200，文章总数为 15，已发布动态列表为 53 条。开发测试不得向真实后端自动发布、留言、发送消息或删除内容；写入与权限契约使用本地替身验证。

## 实施记录

- [x] 新分支与来源版本固定
- [x] PV 实际关键帧分析
- [x] 旧站功能、路由与后端契约盘点
- [ ] 同源数据适配与账号兼容
- [ ] 首页和全站视觉布局
- [ ] 文章、动态、图库、归档
- [ ] 留言、友链、聊天和工具
- [ ] 旧链接、多语言、主题与全局交互
- [ ] 类型、构建、浏览器与接口契约验证
