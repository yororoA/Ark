import { useCallback, useEffect, useState } from "react"
import Portal from "@/components/Portal"
import { cn } from "@/lib/utils"
import Lenis from "lenis"
import styles from "./components.module.scss"

export default function Declaration(props: { onClose: () => void }) {
  const { onClose } = props
  const [wrapperEl, setWrapperEl] = useState<HTMLDivElement | null>(null)
  const wrapperRef = useCallback((node: HTMLDivElement | null) => {
    setWrapperEl(node)
  }, [])

  useEffect(() => {
    if (!wrapperEl) return
    const lenis = new Lenis({
      wrapper: wrapperEl,
      content: wrapperEl.firstElementChild as HTMLElement,
      autoRaf: true,
    })
    return () => lenis.destroy()
  }, [wrapperEl])

  return (
    <Portal className="flex justify-center items-center">
      <div className={cn(styles.declaration)}>
        <div ref={wrapperRef} className={cn(styles.declarationContentWrapper, "flex-1 overflow-hidden")}>
          <h1 className="text-[.8rem] w-full text-center">{'免责声明'}</h1>
          <pre>{'【声明】\n'
            + '1、本网站HTML/CSS/JS交互代码 ©2026 YororoIce，保留所有权利。\n'
            + '2、网站部分UI视觉、图标、界面版式临摹自《明日方舟》，该游戏全部界面美术、图形作品著作权归属【鹰角网络】。本网站与原作开发厂商无任何合作、授权关联，并非官方衍生项目。\n'
            + '3、本项目仅为个人前端学习、技术演示，不涉及包括但不限于盈利、推广、分发等任何商业用途。\n'
            + '4、本网站使用到的所有资源均源于网络公开资源或者个人创作，同时部分付费资源本人皆已付费获取。针对网站访客通过任何方式获取到的本网站所有资源并产生的任何问题，本站均不承担任何法律责任。\n'
            + '5、若涉及资源版权方认为本网站存在侵权，可通过联系邮箱 "moranluo@163.com" 告知，本站将第一时间删除相关内容。'}
          </pre>
          <pre>{'【使用资源】\n'
            + '[1] mefu. 宇泽玲纱[插画]. pixiv, 作品ID: 134552521.\n'
            + '[2] 绘之音. 404页面背景[插画]. bilibili.\n'
            + '    ① https://gf.bilibili.com/item/detail/1106286118?noTitleBar=1&from=mall-up_itemDetail&msource=comments_4637682&track_id=__BGMT__\n'
            + '    ② https://www.bilibili.com/video/BV1Cn4y1o7r6/?spm_id_from=333.1387.list.card_archive.click&vd_source=1e099b31d05e4344ac2cbf94a5077b23\n'
          }
          </pre>
        </div>
        <span onClick={onClose} className={cn(styles.declarationBtn)}>{'我知道了'}</span>
      </div>
    </Portal>
  )
}
