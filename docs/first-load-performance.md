# 首次加载资源预算

## 2026-10-10 测量

在本地 Next.js 16.2.10 生产构建中，使用全新 Chromium context、中文、
Archive 主题、1280×900 视口，模拟 4 Mbps 下载、1 Mbps 上传、100 ms 延迟。
以 `PerformanceNavigationTiming.loadEventStart` 为页面加载事件时间，
字体体积取 `PerformanceResourceTiming.encodedBodySize`。

| 指标 | 调整前 | 调整后 |
| --- | ---: | ---: |
| 字体 preload 数 | 98 | 1 |
| 加载事件前的字体请求数 | 121 | 26 |
| 字体传输体积 | 2,995 KiB | 1,534 KiB |
| 首次内容绘制（FCP） | 1.244 s | 0.764 s |
| 页面加载事件 | 8.197 s | 4.819 s |

这是同条件下的一次实验对比，不代表线上延迟保证；CDN、后端冷启动、
文章内容及实际网络会影响结果。字体按字符子集加载，文章页的请求数量可能不同。

## 加载策略

- 保留字体家族和 `display: swap`；Gowun Batang、Noto CJK 与 Orbitron
  不做全局预载，由浏览器按文字需要加载。Noto 与 Orbitron 使用可变字重。
- 桌宠引擎会预取两套素材的所有动画帧；自动启动等待页面 `load` 后的空闲时段，
  手动开启直接响应。关闭或进入登录页会取消尚未启动的任务。
- 无保存偏好时，移动端、减少动态效果、省流量及 2G 网络默认关闭桌宠；
  用户保存的开启/关闭选择优先。
- CI 检查 `next-font-manifest.json`，每条路由最多预载 4 个字体、80 KiB。
  旧构建的 98 个预载能被该检查捕获。

## 回归

Node 24 下通过生产构建、ESLint、TypeScript、构建预算及 19 组博客契约。
浏览器检查包含三套主题、390px 移动端与登录页字体，以及桌宠延迟启动、
取消、手动开关、省流量偏好、无 `requestIdleCallback` 时的兼容和导航清理。
契约测试复制源码前清理旧副本，避免被移动或删除的路由残留。
