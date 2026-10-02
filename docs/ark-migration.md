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

1. **两代鉴权不同。** 旧站为 token + uid 请求头；Ark 登录为 HttpOnly Cookie。服务端适配层负责当前账号凭据转发，不在客户端存储或展示 token。游客接口将凭据放在 `data` 内；普通登录放在顶层，适配层统一处理且只返回公开账号字段。
2. **V2 公共路由排除匹配异常。** `auth-v2` 处于挂载的子 router，`req.path` 不含 `/api/v2`，但排除列表包含此前缀。实际匿名请求 `/api/knowledge?limit=1` 为 200，`/api/v2/knowledge?limit=1` 为 401。公开内容使用既有 V1 公共读取接口；需要身份的请求使用经过验证的适配方式，不能依赖客户端 uid 自报身份。
3. **游客 Cookie 名称不一致。** Ark 保存 `blog_guest_token`，后端 V2 只从 `blog_tokens` 中按 `blog_active_uid` 查找。转发与续期必须兼容，同时保留其他账号。
4. **Token 续期。** V1 通过 `X-Refreshed-Token`，V2 通过 `Set-Cookie`；同源适配层需要把续期写回浏览器。SSE 中的 token 事件不能直接暴露给前端脚本。
5. **文章 GET 会增加浏览量。** 避免额外调用 `/knowledge/view` 造成重复，也避免为预取额外读取详情。
6. **混合归档服务端最多各取 20 条。** 全量时间线应从文章分页与动态列表构建，或明确保留此上限，不能显示成完整历史。
7. **图库当前没有真实游标分页。** 后端忽略 continueFrom，返回 `hasMore:false`；不能把相同文件重复追加。
8. **动态无已发布内容更新接口。** 保留发布/草稿/删除能力，不伪造编辑成功。草稿重新提交会新建文档。
9. **About PUT 尚未实现持久化。** 不展示虚假的资料编辑成功功能。
10. **旧站计划中的改密/重置密码未实现。** 不列作已存在功能或迁移完成项。
11. **旧密码迁移。** 先发送 SHA-256 格式；仅当后端返回 `legacy_user_detected` 时，按原站流程重新验证并由后端完成一次性密码格式迁移。
12. **同源校验。** Next 开发环境可能将内部请求 URL 归一为 localhost；使用浏览器实际 Host 与 Origin 匹配，并拒绝 `Sec-Fetch-Site: cross-site`，兼容 127.0.0.1 和 TLS 代理。

## 验证依据

2026-10-02，只读探测已确认配置的后端健康检查返回 200，文章总数为 15，已发布动态列表为 53 条。开发测试不得向真实后端自动发布、留言、发送消息或删除内容；写入与权限契约使用本地替身验证。

## 实施记录

- [x] 新分支与来源版本固定
- [x] PV 实际关键帧分析
- [x] 旧站功能、路由与后端契约盘点
- [x] 同源数据适配与账号兼容
- [x] 首页和全站视觉布局
- [x] 文章、动态、图库、归档
- [x] 留言、友链、聊天和工具
- [x] 旧链接、多语言、主题与全局交互
- [x] 类型、构建、浏览器与接口契约验证（范围见下文）

### 当前实现与验证

- 同源白名单网关：`src/app/api/blog/[...path]/route.ts`。公开读取用 V1；受保护请求先在服务端验证账号，忽略客户端提供的身份标记。
- 额外发现：V2 在 token 不匹配时会按 uid 回查最新 token，不能独立作为可信身份验证。Ark 先使用 V1 的 `chat/hasPrivate?userId=<uid>` 验证 token 与 uid 确实匹配，再读取 V2 用户信息。
- V1 响应头续期与 SSE 续期由 `blog-session.ts` 转为 HttpOnly Cookie。SSE 内的 token 帧只保留在服务端，浏览器收到刷新通知后重新读取 session。续期映射为进程内短期缓存；若部署进程在 Cookie 更新前重启，需要重新登录。
- 旧后端的 links 与 comment/get 实际也需要游客身份：采用服务端临时只读游客账号，凭据不进入浏览器，不作为用户登录状态。线上测试应避免触发其创建，使用本地替身验证。
- 首页、全局外壳、四语言词典、浅深/系统主题、文章列表/阅读/编辑/发布已写入。
- 图片生成服务连续返回“生成中”占位图，未用于页面。首屏图形改用自绘 SVG 与 CSS：朱红拱形、同心圆、轨道和衬线字母。
- 已通过当前新增代码 ESLint 与 TypeScript 检查；`/home`、`/articles` 返回 200，浏览器已确认首页版式及真实文章/动态数据。

### 完整栏目实现

- 动态：列表/日期筛选/分页、详情、评论与回复、点赞、发布、草稿恢复/覆盖、删除、附件上传与旧文件名 URL 解析。
- 图库：瀑布流、图片/视频筛选、媒体预览与键盘切换、上传；遵循后端 `hasMore:false`，不追加重复文件。
- 归档：读取全部文章分页并合并动态，按类型和年份筛选；文章列表也支持日期筛选。
- 关于：个人资料、外链分类、管理员新增/编辑/删除链接、公开留言与分页。
- 聊天：公共/私聊会话、历史分页、回复、媒体、SSE、断线轮询；切换会话和账号时隔离私聊状态。
- 工具：旧版函数变速播放器 HTML/JS 迁入 `public/lab/`，在仅允许脚本的 sandbox iframe 中运行。
- 旧链接：`/town/*`、`/account/*`、kid/mid、旧私聊 hash 与 hash 形式路由兼容；未知路径进入 404。
- 公告/约定：保留旧版三语言原文，约定补充德语翻译；历史公告单独折叠，避免将旧版问题误当现状。
- 登录：补齐游客入口、社区约定链接、表单错误展示、验证码发送反馈与登录后返回原页面；删除本地账号历史代替身份验证的回退。
- Cookie：新增 V2 `Set-Cookie` 续期导入，只接收已验证账号的 token；新登录复用同源 HttpOnly Cookie 策略。
- 缓存：文章编辑成功直接替换详情缓存；重新进入博客时重新验证会话，评论数组缓存参与实时失效。
- 2026-10-02 检查：上述变更通过 TypeScript 与定向 ESLint；浏览器动态列表显示 53 条记录、首批 12 条，桌面无横向溢出。
- 构建路由表检查发现并补齐 `/articles/new`；移植播放器的 7 条 lint warning 已清理。

## 最终回归（2026-10-02）

### 可重复执行的接口测试

`npm run verify:blog` 使用 Node.js 24 启动内存后端与独立 Next 实例。源代码复制到 `.git/ark-research/contract-app/`，不复制 `.env`，明确覆盖 `BACKEND_URL` 为本地地址；测试过程没有线上写入。

14 / 14 组通过：

- 公共读取、私有接口保护和网关白名单。
- 登录 HttpOnly Cookie、JSON 不泄露 token。
- 游客嵌套响应、Cookie 与会话验证、游客发布限制。
- 无登录状态下的友链和评论读取。
- 旧密码回退及后端错误状态码。
- 注册与验证码参数契约。
- 伪造 uid 无法利用 V2 身份恢复逻辑。
- 合法 Origin 成功，跨站写入在到达后端前被拒绝。
- V1 / V2 续期、其他账号保留、切换与退出。
- 文章增改删、聊天身份由服务端确定。
- multipart 上传、动态草稿/发布/删除、评论回复/点赞、友链维护、留言。
- SSE token 帧过滤、损坏帧处理、分块 CRLF 与会话续期。
- 上游错误保留可读提示。
- `/town`、kid/mid、注册与私聊旧链接保留参数，未知路径返回 404。

`npm run verify:blog:preview` 保留该环境供浏览器检查，地址 `http://127.0.0.1:10000`。测试登录为 `tester` / `fixture-password`，仅适用于本地替身。结果写入 `.git/ark-research/contract-results.json`。

### 构建与界面

- 生产构建成功，包含全部内容与编辑路由；构建内 TypeScript 检查通过。
- 全量 ESLint：0 error；仅原 `/test` 页未使用的 `Input` import 有 1 条 warning。
- 桌面：1316px 首页与动态版式、文章发布/Markdown 预览/编辑回显、登录后返回目标页面、聊天回复和 Ctrl+Enter 发送、私聊切换隔离。
- 移动：390px 首页截图、展开/收起菜单、44px 主要操作区与深色主题；320px 生产版本关于页的导航、标题及表单无越界。
- 语言：系统英文自动选择与德语切换已在浏览器确认。
- 弹窗：Tab 保持在原生 dialog 内，Escape 关闭并释放页面滚动。
- 减弱动效：已核对浏览器加载的 `prefers-reduced-motion` 规则会禁用动画、过渡、视差和滚动动画；未进行操作系统偏好切换测试。
- 浅色辅助文字与背景对比度 4.61，朱红文字 5.12；深色辅助文字 7.10、朱红 5.91。

### 验证边界

- 真实后端只读确认文章和动态；真实邮件投递、Cloudinary 上传、数据库写入及长时间 SSE 断线恢复未在生产账号上执行。内存替身验证的是请求与状态契约，不能替代这些外部服务的实际运行验证。
- 登录页继续保留 Ark 已有的中文终端视觉和连接动画；四语言切换覆盖博客共享布局与栏目。独立变速播放器保留旧工具界面，未对真实音视频文件做全量回归。
- 首页日历对应动态；文章可在文章列表单独按日期筛选。
- SSE 续期桥接仍是进程内缓存；多实例部署需要共享续期存储或固定会话路由。
