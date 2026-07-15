import Portal from "@/components/Portal";
import { cn } from "@/lib/utils";
import styles from "./components.module.scss";
import Lenis from "lenis";
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { AuthDetail, useAuthStore } from "@/store/auth";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent, DropdownMenuItem
} from "@/components/ui/dropdown-menu";
import { X, ChevronRight } from 'lucide-react'
import Button from "@/components/arks/button";


export default function AccountManagement(props: { onClose: () => void }) {
  const { onClose } = props;
  const rawDetails = useAuthStore((state) => {
    return state.details
  });
  // 按最后登录时间排序，最新在最前面
  const details = useMemo(() => [...rawDetails].sort((a, b) =>
    b.lastLoginAt?.localeCompare(a.lastLoginAt || '') || 0
  ), [rawDetails]);

  const [selectedDetail, setSelectedDetail] = useState<AuthDetail | undefined>(details[0]);
  const boundaryRef = useRef<HTMLDivElement>(null);

  // 平滑滚动
  const [wrapperEl, setWrapperEl] = useState<HTMLDivElement | null>(null)
  const wrapperRef = useCallback((node: HTMLDivElement | null) => {
    setWrapperEl(node)
  }, []);

  useEffect(() => {
    if (!wrapperEl) return
    const lenis = new Lenis({
      wrapper: wrapperEl,
      content: wrapperEl.firstElementChild as HTMLElement,
      autoRaf: true,
    })
    return () => lenis.destroy()
  }, [wrapperEl]);

  // 表单
  const [otherVisable, setOtherVisable] = useState(false);

  return (
    <Portal className="flex justify-center items-center">
      <div className={cn(styles.accountManagement)} ref={boundaryRef}>
        <div className={cn(styles.accountManagementTitle)}>
          <h1>{'账号管理'}</h1>
          <X size={24} strokeWidth={1.3} className={cn(styles.accountManagementCloseBtn)} onClick={onClose} />
        </div>
        {!otherVisable ?
          <>
            <div className="flex-1">
              {details.length > 0 ?
                <DropdownMenu>
                  <DropdownMenuTrigger className="block w-full relative group">
                    <div className={cn(styles.account)}>
                      <span className={cn(styles.avatar, styles.big, 'row-span-2')}>{selectedDetail?.username?.charAt(0).toUpperCase() || 'G'}</span>
                      <span className={cn(styles.desc, 'text-[.8rem] font-[500]')}>{selectedDetail?.username || 'Guest'}</span>
                      <span className={cn(styles.desc, "text-gray-400 text-[.5rem] font-[400]")}>
                        {`${selectedDetail?.continent_code && selectedDetail?.country_code ? `${selectedDetail?.continent_code}/${selectedDetail?.country_code}` : selectedDetail?.continent_code || selectedDetail?.country_code || 'Unknown'}`}
                        <span className="inline-block w-[5px] h-[5px] rounded-full bg-gray-400 mx-[.2rem]" />
                        {new Date(selectedDetail?.lastLoginAt || '').toLocaleString()}
                        <span className="inline-block w-[5px] h-[5px] rounded-full bg-gray-400 mx-[.2rem]" />
                        {selectedDetail?.isAdmin ? '管理员' : selectedDetail?.isGuest ? '访客' : '用户'}
                      </span>
                    </div>
                    <ChevronRight size={30} strokeWidth={1.3} className='absolute right-[2rem] top-1/2 -translate-y-1/2 transition-transform duration-200 group-data-[state=open]:rotate-90' />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent ref={wrapperRef} collisionBoundary={boundaryRef.current} className={cn(styles.accountManagementContent, 'w-[var(--radix-dropdown-menu-trigger-width)] h-screen')}>
                    {
                      details.map((detail, index) => {
                        const location = detail.continent_code && detail.country_code
                          ? `${detail.continent_code}/${detail.country_code}`
                          : detail.continent_code || detail.country_code || 'Unknown';

                        return (
                          <DropdownMenuItem className={cn(styles.account)} key={detail.uid} onClick={() => setSelectedDetail(detail)}>
                            <span className={cn(styles.avatar, styles.small, 'row-span-2')}>{detail.username?.charAt(0).toUpperCase() || 'G'}</span>
                            <span className={cn(styles.desc, 'text-[.6rem] font-[500]')}>
                              {detail.username || 'Guest'}
                              {index === 0 &&
                                <span className={cn(styles.desc, "text-gray-400 text-[.4rem] before:w-[.2rem] before:h-[.2rem] before:bg-[#228B22]/70 before:mx-[.2rem] font-[400]")}>{'最近登录'}</span>}
                            </span>
                            <span className={cn(styles.desc, "text-gray-400 text-[.375rem] font-[400]")}>
                              {`${location}`}
                              <span className="inline-block w-[3px] h-[3px] rounded-full bg-gray-400 mx-[.15rem]" />
                              {new Date(detail.lastLoginAt || '').toLocaleString()}
                              <span className="inline-block w-[3px] h-[3px] rounded-full bg-gray-400 mx-[.15rem]" />
                              {detail.isAdmin ? '管理员' : detail.isGuest ? '访客' : '用户'}
                            </span>
                          </DropdownMenuItem>
                        )
                      })
                    }
                  </DropdownMenuContent>
                </DropdownMenu>
                : <span className='w-full h-full flex items-center justify-center text-[.6rem]'>{'无法获取到历史登录记录，请点击『其他账号登录』'}</span>
              }
            </div>
            <div className={cn(styles.accountManagementFooter)}>
              <Button size="small" className={cn(styles.loginBtn)}>登录</Button>
              <Button size="small" className={cn(styles.loginBtn, 'opacity-50')} onClick={() => setOtherVisable(true)}>其他账号登录</Button>
            </div>
          </>
          :
          <>
          </>}
      </div>
    </Portal >
  );
}