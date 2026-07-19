我看完你这版改动了。你的方向（把动画层从 `page.tsx` 提到 `layout.tsx`）是对的，但你现在的实现里有一个关键误区：

> **RSC refresh 不会重新挂载 layout segment ≠ layout 里的 Client Component 不会重新 render。**

你的注释：

> "Server Action 中 cookies().set() 触发的 RSC refresh 只重渲染 page segment，不会让此组件重新挂载/重渲染"

这个前提不完全成立。

---

## 真正的问题点

你的树现在：

```
RootLayout(Server)
 └─ BrightnessProvider(Client)
      ├─ BgImage(Client)
      ├─ LoginScene(Client)
      └─ login/page(Client)
```

Server Action:

```
authAction()
   |
   cookies().set()
   |
   Next 返回 RSC payload
   |
   React merge router tree
```

这里虽然 `BrightnessProvider` 不一定重新 mount，但是：

### 1. children prop 会变化

你的：

```tsx
<BrightnessProvider>
  <BgImage />
  <LoginScene />
  {children}
</BrightnessProvider>
```

`children` 是 RSC 注入的 React Element。

Server Action 后：

旧：

```
BrightnessProvider
   children=A
```

新：

```
BrightnessProvider
   children=B
```

React 会重新 reconcile。

而你的：

```tsx
const LoginScene = memo(...)
```

实际上挡不住。

原因：

`LoginScene` 是 `BrightnessProvider` 的 children：

```tsx
<BrightnessProvider value={value}>
    <LoginScene />
</BrightnessProvider>
```

RSC payload 更新时：

```
<LoginScene />
```

这个 React Element 本身被重新创建：

旧：

```js
{
 type: LoginScene,
 key:null
}
```

新：

```js
{
 type: LoginScene,
 key:null
}
```

虽然 type 一样，但是父级 reconciliation 仍可能触发 render。

`memo` 只比较 props：

```tsx
memo(LoginScene)
```

你的 props：

```ts
{}
```

确实相等。

但是：

## 关键问题在这里

你的 `LoginScene` 内部：

```tsx
function LoginSceneInner(){
 const {isConnecting, progress}=useBrightness()
```

而你的 Context value：

```tsx
const value = useMemo(() => ({
    isDimmed,
    setDimmed,
    isConnecting,
    setIsConnecting,
    progress,
    setProgress,
}), [isDimmed,isConnecting,progress])
```

问题：

这里依然有变化。

因为：

```tsx
setIsConnecting
setProgress
```

都是新的函数引用。

虽然 React state setter 通常稳定，但是你的 object 每次 layout render 都会重新生成。

所以：

RSC refresh

↓

BrightnessProvider render

↓

value 新引用

↓

所有 context consumer 更新

---

# 第一处修改

你的 context：

改成：

```tsx
const value = useMemo(() => ({
  isDimmed,
  setDimmed,
  isConnecting,
  setIsConnecting,
  progress,
  setProgress,
}), [
  isDimmed,
  isConnecting,
  progress,
])
```

这个你已经做了。

但是还不够。

因为：

## BrightnessProvider 本身也需要隔离

---

# 推荐结构

不要把动画状态放 Root Layout Context。

改：

```
layout.tsx

<BrightnessProvider>
    <BgImage/>
    {children}
</BrightnessProvider>
```

不要：

```
<BrightnessProvider>
    <LoginScene/>
    {children}
</BrightnessProvider>
```

然后：

login/layout.tsx：

```tsx
import LoginScene from './components/login-scene'


export default function LoginLayout({
 children
}:{
 children:React.ReactNode
}){

 return (
   <div className="min-h-screen flex flex-col relative">
      <LoginScene/>
      {children}
   </div>
 )
}
```

这样：

```
RootLayout
 |
 BrightnessProvider
 |
 login/layout
 |
 LoginScene
 |
 page
```

Server Action 更新：

```
login/page
```

但是：

```
login/layout
```

保持。

这是 Next App Router 推荐隔离动态 segment 的方式。

---

# 第二个问题：你的 Sphere 组件一定会重绘

你 Sphere：

```tsx
useEffect(()=>{
 ...
},[
 color,
 edges,
 edgeWidth,
 dotRadius,
 enableBlinking
])
```

但是：

你的 className 变化：

```tsx
translate-y
scale
opacity
```

这些是 CSS transition。

如果父组件 render：

```tsx
<Sphere
 className="..."
/>
```

重新进入：

Sphere内部：

```tsx
useEffect
```

不会重新执行。

这个没问题。

真正的问题应该是：

你的 canvas 容器：

```tsx
<div
 className={className}
 style={{
 width:'30rem',
 height:'30rem'
 }}
>
```

CSS transition 状态来自 class。

如果组件重新 mount：

transition 状态丢失。

所以你看到：

```
缩小中
 ↓
闪一下
 ↓
回初始
 ↓
继续缩小
```

这不是 z-index 问题。

---

# 第三个问题：不要用 Server Action 做登录动画阶段

你的：

```tsx
await switchUser()
```

触发：

```
cookies.set
↓
RSC refresh
```

这是不可避免的。

更好的方式：

## 登录完成后手动 router.refresh()

然后避免 Server Action 自动刷新。

例如：

auth.ts:

不要：

```ts
cookieStore.set()
```

改成：

Route Handler:

```
/api/auth/login
```

里面：

```ts
cookies().set()
return Response.json()
```

客户端：

```ts
await fetch('/api/auth/login')

router.refresh()
```

这样：

登录动画：

```
开始
 |
 progress 0-100
 |
 router.refresh()
 |
 页面跳转
```

完全由客户端控制。

---

# 如果你想最小修改

我建议按这个顺序：

## 1. LoginScene 移到 login/layout

最重要。

---

## 2. BrightnessProvider 不包 LoginScene

改：

```tsx
<BrightnessProvider>
   <BgImage/>
   {children}
</BrightnessProvider>
```

---

## 3. LoginScene 加 isolation

```tsx
const LoginSceneInner = memo(function LoginSceneInner(){
...
})
```

改：

```tsx
const LoginScene = memo(LoginSceneInner)
```

现在你的 memo 包错地方了。

你现在：

```tsx
const LoginScene = memo(function LoginScene(){
 if(pathname !== '/login')
   return null

 return <LoginSceneInner/>
})
```

问题：

pathname变化导致整个组件重新判断。

应该：

```tsx
function LoginScene(){
 return <LoginSceneInner/>
}

export default memo(LoginScene)
```

---

## 4. 给 Sphere canvas 保留 DOM

Sphere 外层：

```tsx
<div
 className={className}
 style={{
   width:'30rem',
   height:'30rem',
   willChange:'transform'
 }}
>
```

---

# 另外一个隐藏 bug

你的：

```tsx
useEffect(()=>{
 return ()=>{
    setIsConnecting(false)
 }
},[])
```

这个会在：

```
login/page unmount
```

触发。

但是 RSC refresh：

不一定 unmount。

所以不要依赖它清状态。

---

## 我的判断

按照你描述的：

> "样式脱离然后复位"

概率排序：

| 原因                                                    |  概率 |
| ----------------------------------------------------- | --: |
| login/page RSC commit 导致 LoginScene/Sphere mount 状态变化 | 70% |
| BrightnessProvider context 更新导致 consumer rerender     | 20% |
| z-index / fixed 层叠                                    |  5% |
| setInterval 抢帧                                        |  5% |

你现在已经排除了 z-index。

下一步最应该做的是：

**把 LoginScene 放进 `login/layout.tsx`，不要放 RootLayout。**

这才是真正利用 Next.js segment cache 隔离 RSC refresh。你现在只是换了位置，但仍然处在 RootLayout 的 children reconciliation 路径上。
