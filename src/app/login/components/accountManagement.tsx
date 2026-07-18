import Portal from "@/components/Portal";
import { cn } from "@/lib/utils";
import styles from "./components.module.scss";
import Lenis from "lenis";
import { useState, useCallback, useEffect, useRef } from 'react';
import { AuthDetail } from "@/store/auth";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent, DropdownMenuItem
} from "@/components/ui/dropdown-menu";
import { X, ChevronRight, ChevronLeft, Trash2 } from 'lucide-react'
import Button from "@/components/arks/button";
import Input from "@/components/arks/input";
import Tabs from "@/components/arks/tabs";
import DeleteLoginRecord from "./deleteLoginRecord";



export default function AccountManagement(props: { onClose: () => void, onConnect: () => void, details: AuthDetail[] }) {
  const { sendCode, register, login } = useAuth();
  const { onClose, onConnect, details } = props;

  const [selectedDetail, setSelectedDetail] = useState<AuthDetail | undefined>(details[0]);
  const [showDeleteDialog, setShowDelete] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const detailToDeleteRef = useRef<AuthDetail | undefined>(undefined);
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
  // todo: error toast
  const [otherVisable, setOtherVisable] = useState(false);
  const [activeTab, setActiveTab] = useState<'register' | 'login'>('register');
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  // 发送验证码
  const handleSendCode = async () => {
    if (!emailRef.current?.value) {
      throw new Error('请输入邮箱');
    }
    try {
      await sendCode(emailRef.current.value);
    } catch (err) {
      console.log(err);
      throw err;
    }
  }
  // 注册
  const handleRegister = async () => {
    if (!usernameRef.current?.value) {
      throw new Error('请输入用户名');
    }
    if (!passwordRef.current?.value) {
      throw new Error('请输入密码');
    }
    if (!emailRef.current?.value) {
      throw new Error('请输入邮箱');
    }
    if (!codeRef.current?.value) {
      throw new Error('请输入验证码');
    }
    try {
      await register(usernameRef.current.value, passwordRef.current.value, emailRef.current.value, codeRef.current.value);
      onClose();
      onConnect();
    } catch (err) {
      console.log(err);
      throw err;
    }
  }
  // 登录
  const handleLogin = async () => {
    if (!usernameRef.current?.value) {
      throw new Error('请输入用户名');
    }
    if (!passwordRef.current?.value) {
      throw new Error('请输入密码');
    }
    try {
      await login(usernameRef.current.value, passwordRef.current.value);
      onClose();
      onConnect();
    } catch (err) {
      console.log(err);
      throw err;
    }
  }

  return (
    <Portal className="flex justify-center items-center">
      {showDeleteDialog && <DeleteLoginRecord onCancel={() => { setShowDelete(false); detailToDeleteRef.current = undefined }} detail={detailToDeleteRef.current} />}
      <div className={cn(styles.accountManagement)} style={{ opacity: `${showDeleteDialog ? 0 : 1}` }} ref={boundaryRef}>
        <div className={cn(styles.accountManagementTitle, 'relative')}>
          {otherVisable && <ChevronLeft size={24} strokeWidth={1.3} onClick={() => setOtherVisable(false)} className="iconBtn absolute" />}
          <h1 className="ml-[1.5rem]">{'账号管理'}</h1>
          {details.length > 0 && <X size={24} strokeWidth={1.3} className="iconBtn" onClick={onClose} />}
        </div>
        {!otherVisable ?
          <>
            <div className="flex-1">
              {details.length > 0 ?
                <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
                  <DropdownMenuTrigger className="block w-full relative group">
                    <div className={cn(styles.account)}>
                      <span className={cn(styles.avatar, styles.big, 'row-span-2')}>{selectedDetail?.username?.charAt(0).toUpperCase() || 'G'}</span>
                      <span className={cn(styles.desc, 'text-[.8rem] font-[500]')}>{selectedDetail?.username || 'Guest'}</span>
                      <span className={cn(styles.desc, "text-gray-400 text-[.5rem] font-[400]")}>
                        {`${selectedDetail?.continent_code && selectedDetail?.country_code ? `${selectedDetail?.continent_code}/${selectedDetail?.country_code}` : selectedDetail?.continent_code || selectedDetail?.country_code || 'Unknown'}`}
                        <span className="inline-block w-[5px] h-[5px] rounded-full bg-gray-400 mx-[.2rem]" />
                        {selectedDetail?.lastLoginAt ? new Date(selectedDetail.lastLoginAt).toLocaleString() : '未知'}
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
                          <DropdownMenuItem className={cn(styles.account)} key={detail.uid} onSelect={() => setSelectedDetail(detail)}>
                            <span className={cn(styles.avatar, styles.small, 'row-span-2')}>{detail.username?.charAt(0).toUpperCase() || 'G'}</span>
                            <span className={cn(styles.desc, 'text-[.6rem] font-[500]')}>
                              {detail.username || 'Guest'}
                              {index === 0 &&
                                <span className={cn(styles.desc, "text-gray-400 text-[.4rem] before:w-[.2rem] before:h-[.2rem] before:bg-[#228B22]/70 before:mx-[.2rem] font-[400]")}>{'最近登录'}</span>}
                            </span>
                            <span className={cn(styles.desc, "text-gray-400 text-[.375rem] font-[400]")}>
                              {`${location}`}
                              <span className="inline-block w-[3px] h-[3px] rounded-full bg-gray-400 mx-[.15rem]" />
                              {detail.lastLoginAt ? new Date(detail.lastLoginAt).toLocaleString() : '未知'}
                              <span className="inline-block w-[3px] h-[3px] rounded-full bg-gray-400 mx-[.15rem]" />
                              {detail.isAdmin ? '管理员' : detail.isGuest ? '访客' : '用户'}
                            </span>
                            <span className="absolute right-0 mr-[.9rem] pointer-events-auto group"
                              onClick={(e) => {
                                e.preventDefault();
                                setShowDelete(true);
                                setDropdownOpen(false);
                                detailToDeleteRef.current = detail;
                              }}>
                              <Trash2 strokeWidth={1.3} className="group-hover:stroke-red-500" />
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
              {selectedDetail && <Button size="small" onClick={onConnect} className={cn(styles.loginBtn, 'mr-auto')}>登录</Button>}
              <Button size="small" className={cn(styles.loginBtn, 'opacity-50 ml-auto')} onClick={() => setOtherVisable(true)}>其他账号登录</Button>
            </div>
          </>
          :
          <>
            <div className={cn(styles.form)}>
              <Tabs
                items={[
                  { value: 'register', label: '注册' },
                  { value: 'login', label: '登录' },
                ]}
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as 'register' | 'login')}
              />
              <div className={cn(styles.inputGroup)}>
                <Input label="用户名" id="username" required placeholder="请输入用户名" ref={usernameRef} />
                <Input label="密码" id="password" encrypt={true} required placeholder="请输入密码" ref={passwordRef} />
                {activeTab === 'register' && (
                  <>
                    <Input label="邮箱" id="email" required placeholder="请输入邮箱" ref={emailRef} />
                    <Input label="验证码" id="code" required placeholder="请输入验证码" ref={codeRef}>
                      <Button size="small" onClick={handleSendCode}>获取验证码</Button>
                    </Input>
                  </>
                )}
              </div>
              <Button size="small" className={cn(styles.loginBtn)} onClick={activeTab === 'register' ? handleRegister : handleLogin}>{activeTab === 'register' ? '注册' : '登录'}</Button>
            </div>
          </>}
      </div>
    </Portal >
  );
}