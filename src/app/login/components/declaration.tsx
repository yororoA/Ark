import { useCallback, useEffect, useState } from "react"
import Portal from "@/components/Portal"
import { QINGJIAN_COPY } from "@/lib/qingjian-copy"
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
    <Portal className={styles['dialog-overlay']}>
      <div className={styles.declaration} role="dialog" aria-modal="true" aria-label="免责声明">
        <div ref={wrapperRef} className={styles.declarationContentWrapper}>
          <h1>免责声明</h1>
          <pre>{'【声明】\n'
            + '1、本网站HTML/CSS/JS交互代码 ©2026 YororoIce，保留所有权利。\n'
            + '2、网站部分UI视觉、图标、界面版式临摹自《明日方舟》，该游戏全部界面美术、图形作品著作权归属【鹰角网络】。本网站与原作开发厂商无任何合作、授权关联，并非官方衍生项目。\n'
            + '3、本项目仅为个人前端学习、技术演示，不涉及包括但不限于盈利、推广、分发等任何商业用途。\n'
            + '4、本网站使用到的所有资源均源于网络公开资源或者个人创作，同时部分付费资源本人皆已付费获取。针对网站访客通过任何方式获取到的本网站所有资源并产生的任何问题，本站均不承担任何法律责任。\n'
            + '5、若涉及资源版权方认为本网站存在侵权，可通过联系邮箱 "moranluo@163.com" 告知，本站将第一时间删除相关内容。'}
          </pre>
          <pre>{'【使用资源】\n'
          }
          </pre>
          <pre>{'【设计参考】\n'
            + '1、【鹰角网络】-《明日方舟》\n'
            + '2、2086丷《有空再做了【明日方舟】》(https://www.bilibili.com/video/BV1Qj411x745/)\n'
            + `3、明石缪《他人事の音がする / 声不关己》翻唱视频（影片：kkmfd；插画：ミツ蜂）(https://www.bilibili.com/video/BV1qtMc6HEis/)。本站“${QINGJIAN_COPY.zh.name}”主题的页面视觉与登录过渡动画参考该视频，并以代码复刻其中的伞阵、落纸与揭幕等视觉表现。相关图形与动画由本站重新绘制和实现，未直接使用原视频画面、插画或音频素材；原作品及相关素材的著作权归各自权利人所有。\n`
            + '4、【ATLUS / SEGA】-《Persona 3 Reload / 女神异闻录3 Reload》。本站“P3R”主题参考其界面结构、配色与动态表现，由本站独立编写代码、绘制几何场景；未使用游戏角色立绘、视频画面、音频或商标素材。原作名称及界面美术等权利归各自权利人所有，本站与 ATLUS / SEGA 无合作或授权关系。\n'
            + '参考视频：绿川リュウジ《女神异闻录3Re 界面UI&动效一览》：\n'
            + '流体风格菜单：https://www.bilibili.com/video/BV1vD421K72T/\n'
            + '主界面：https://www.bilibili.com/video/BV1rm411C7Uy/\n'
            + '手机与邮件：https://www.bilibili.com/video/BV11T421X7Cz/\n'
            + '通用对话气泡与选项：https://www.bilibili.com/video/BV1LJ4m1J7B1/\n'
            + '日期切换：https://www.bilibili.com/video/BV1zf421U7vo/\n'
            + '武器店：https://www.bilibili.com/video/BV1CE42157wQ/\n'
            + '入水与圆形转场参考：草莓红豆汤《P3R 全UI展示》https://www.bilibili.com/video/BV1XK42117LJ/。本站以原创棱角石替代角色，使用代码重新绘制水痕、泡沫、气泡与圆形铺色。\n'
            + '入水形态与水下配色参考：Cuthorns《p3re菜单动画无字纯享版》https://www.bilibili.com/video/BV15V4y117GZ/。本站独立实现水体、泡沫与水面碎光，未使用原视频画面或角色素材。\n'
          }
          </pre>
        </div>
        <button type="button" onClick={onClose} className={styles.declarationBtn}>我知道了</button>
      </div>
    </Portal>
  )
}
