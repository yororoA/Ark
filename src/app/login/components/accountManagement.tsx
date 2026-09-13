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
import type { ConnectParams } from '../types';



export default function AccountManagement(props: { onClose: () => void, onConnect: (params: ConnectParams) => void, details: AuthDetail[] }) {
  const { sendCode } = useAuth();
  const { onClose, onConnect, details } = props;

  const [selectedUid, setSelectedUid] = useState<string | undefined>(details[0]?.uid);
  const selectedDetail = details.find((d) => d.uid === selectedUid) ?? details[0];
  const [detailToDelete, setDetailToDelete] = useState<AuthDetail | undefined>(undefined);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [boundaryEl, setBoundaryEl] = useState<HTMLDivElement | null>(null);

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
    onClose();
    await onConnect({ action: 'register', username: usernameRef.current.value, password: passwordRef.current.value, email: emailRef.current.value, code: codeRef.current.value });
  }
  // 登录
  const handleLogin = async () => {
    if (!usernameRef.current?.value) {
      throw new Error('请输入用户名');
    }
    if (!passwordRef.current?.value) {
      throw new Error('请输入密码');
    }
    onClose();
    await onConnect({ action: 'login', username: usernameRef.current.value, password: passwordRef.current.value });
  }

  return (
    <Portal className={styles['dialog-overlay']}>
      {detailToDelete && (
        <DeleteLoginRecord
          onCancel={() => setDetailToDelete(undefined)}
          detail={detailToDelete}
        />
      )}
      <div className={styles.accountManagement} role="dialog" aria-modal="true" aria-label="账号管理" inert={Boolean(detailToDelete)} style={{ visibility: detailToDelete ? 'hidden' : 'visible' }} ref={setBoundaryEl}>
        <div className={cn(styles.accountManagementTitle, 'relative')}>
          {otherVisable && <button type="button" className={styles['icon-button']} aria-label="返回账号列表" title="返回账号列表" onClick={() => setOtherVisable(false)}><ChevronLeft size={22} strokeWidth={1.3} /></button>}
          <h1>账号管理</h1>
          {details.length > 0 && <button type="button" className={styles['icon-button']} aria-label="关闭账号管理" title="关闭账号管理" onClick={onClose}><X size={22} strokeWidth={1.3} /></button>}
        </div>
        {!otherVisable ?
          <>
            <div className={styles['account-body']}>
              {details.length > 0 ?
                <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
                  <DropdownMenuTrigger className="block w-full relative group" aria-label="选择账号">
                    <div className={cn(styles.account)}>
                      <span className={cn(styles.avatar, 'row-span-2')}>{selectedDetail?.username?.charAt(0).toUpperCase() || 'G'}</span>
                      <span className={cn(styles.desc, styles['account-name'])}>{selectedDetail?.username || 'Guest'}</span>
                      <span className={cn(styles.desc, styles['account-meta'])}>
                        {`${selectedDetail?.continent_code && selectedDetail?.country_code ? `${selectedDetail?.continent_code}/${selectedDetail?.country_code}` : selectedDetail?.continent_code || selectedDetail?.country_code || 'Unknown'}`}
                        <span className="inline-block w-[5px] h-[5px] rounded-full bg-gray-400 mx-[.2rem]" />
                        {selectedDetail?.lastLoginAt ? new Date(selectedDetail.lastLoginAt).toLocaleString() : '未知'}
                        <span className="inline-block w-[5px] h-[5px] rounded-full bg-gray-400 mx-[.2rem]" />
                        {selectedDetail?.isAdmin ? '管理员' : selectedDetail?.isGuest ? '访客' : '用户'}
                      </span>
                    </div>
                    <ChevronRight size={24} strokeWidth={1.3} className={cn(styles['account-arrow'], 'transition-transform duration-200 group-data-[state=open]:rotate-90')} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent ref={wrapperRef} collisionBoundary={boundaryEl} className={styles.accountManagementContent}>
                    {
                      details.map((detail, index) => {
                        const location = detail.continent_code && detail.country_code
                          ? `${detail.continent_code}/${detail.country_code}`
                          : detail.continent_code || detail.country_code || 'Unknown';

                        return (
                          <DropdownMenuItem className={cn(styles.account)} key={detail.uid} onSelect={() => setSelectedUid(detail.uid)}>
                            <span className={cn(styles.avatar, 'row-span-2')}>{detail.username?.charAt(0).toUpperCase() || 'G'}</span>
                            <span className={cn(styles.desc, styles['account-name'])}>
                              {detail.username || 'Guest'}
                              {index === 0 &&
                                <span className={styles['recent-label']}>最近登录</span>}
                            </span>
                            <span className={cn(styles.desc, styles['account-meta'])}>
                              {`${location}`}
                              <span className="inline-block w-[3px] h-[3px] rounded-full bg-gray-400 mx-[.15rem]" />
                              {detail.lastLoginAt ? new Date(detail.lastLoginAt).toLocaleString() : '未知'}
                              <span className="inline-block w-[3px] h-[3px] rounded-full bg-gray-400 mx-[.15rem]" />
                              {detail.isAdmin ? '管理员' : detail.isGuest ? '访客' : '用户'}
                            </span>
                            <button type="button" aria-label={`删除 ${detail.username || 'Guest'} 的登录记录`} title="删除登录记录" className={cn(styles['delete-button'], styles['icon-button'])}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDetailToDelete(detail);
                                setDropdownOpen(false);
                              }}>
                              <Trash2 size={18} strokeWidth={1.3} />
                            </button>
                          </DropdownMenuItem>
                        )
                      })
                    }
                  </DropdownMenuContent>
                </DropdownMenu>
                : <span className={styles['empty-accounts']}>暂无登录记录</span>
              }
            </div>
            <div className={cn(styles.accountManagementFooter)}>
              {details.length > 0 && <Button size="small" onClick={() => { onClose(); onConnect({ action: 'switch', uid: selectedDetail?.uid }) }} className={cn(styles.loginBtn, 'mr-auto')}>登录</Button>}
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
    </Portal>
  );
}
