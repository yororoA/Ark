import Portal from "@/components/Portal";
import Link from '@/components/appearance/p3r-link';
import { cn } from "@/lib/utils";
import styles from "./components.module.scss";
import { useState, useRef } from 'react';
import { AuthDetail } from "@/store/auth";
import { useAuth } from "@/hooks/useAuth";
import { X, ChevronLeft, Trash2 } from 'lucide-react'
import Button from "@/components/arks/button";
import Input from "@/components/arks/input";
import Tabs from "@/components/arks/tabs";
import DeleteLoginRecord from "./deleteLoginRecord";
import type { ConnectParams } from '../types';
import ThemePicker from '@/components/appearance/theme-picker';



export default function AccountManagement(props: { onClose: () => void, onConnect: (params: ConnectParams) => void, details: AuthDetail[], preferredMode?: 'register' | 'login' }) {
  const { sendCode } = useAuth();
  const { onClose, onConnect, details } = props;

  const [selectedUid, setSelectedUid] = useState<string | undefined>(details[0]?.uid);
  const selectedDetail = details.find((d) => d.uid === selectedUid) ?? details[0];
  const [detailToDelete, setDetailToDelete] = useState<AuthDetail | undefined>(undefined);

  // 表单
  const [otherVisable, setOtherVisable] = useState(details.length === 0 || props.preferredMode === 'register');
  const [activeTab, setActiveTab] = useState<'register' | 'login'>(props.preferredMode || 'login');
  const [formError, setFormError] = useState('');
  const [formBusy, setFormBusy] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const showOtherAccountForm = otherVisable || details.length === 0;

  async function run(action: () => Promise<void>) {
    if (formBusy) return;
    setFormBusy(true); setFormError('');
    try { await action(); } catch (error) { setFormError(error instanceof Error ? error.message : '请求失败，请重试'); }
    finally { setFormBusy(false); }
  }
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  // 发送验证码
  const handleSendCode = async () => {
    if (!emailRef.current?.value) {
      throw new Error('请输入邮箱');
    }
    await sendCode(emailRef.current.value);
    setCodeSent(true);
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
      <div className={styles.accountManagement} role="dialog" aria-modal="true" aria-label="账号管理" inert={Boolean(detailToDelete)} style={{ visibility: detailToDelete ? 'hidden' : 'visible' }}>
        <div className={cn(styles.accountManagementTitle, 'relative')}>
          {otherVisable && details.length > 0 && <button type="button" className={styles['icon-button']} aria-label="返回账号列表" title="返回账号列表" onClick={() => setOtherVisable(false)}><ChevronLeft size={22} strokeWidth={1.3} /></button>}
          <h1>账号管理</h1>
          <ThemePicker />
          {details.length > 0 && <button type="button" className={styles['icon-button']} aria-label="关闭账号管理" title="关闭账号管理" onClick={onClose}><X size={22} strokeWidth={1.3} /></button>}
        </div>
        {!showOtherAccountForm ?
          <>
            <div className={styles['account-body']}>
              {details.length > 0 ?
                <div className={styles['account-list']} role="list" aria-label="已保存账号">
                  {details.map((detail, index) => {
                    const location = detail.continent_code && detail.country_code
                      ? `${detail.continent_code}/${detail.country_code}`
                      : detail.continent_code || detail.country_code || 'Unknown';
                    const isSelected = detail.uid === selectedDetail?.uid;

                    return (
                      <div className={styles['account-record']} data-selected={isSelected ? '' : undefined} role="listitem" key={detail.uid}>
                        <button type="button" className={cn(styles.account)} aria-pressed={isSelected} onClick={() => setSelectedUid(detail.uid)}>
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
                        </button>
                        <button type="button" aria-label={`删除 ${detail.username || 'Guest'} 的登录记录`} title="删除登录记录" className={cn(styles['delete-button'], styles['icon-button'])} onClick={() => setDetailToDelete(detail)}>
                          <Trash2 size={18} strokeWidth={1.3} />
                        </button>
                      </div>
                    )
                  })}
                </div>
                : <span className={styles['empty-accounts']}>暂无登录记录</span>
              }
            </div>
            <div className={cn(styles.accountManagementFooter)}>
              {details.length > 0 && <Button size="small" onClick={() => { onClose(); onConnect({ action: 'switch', uid: selectedDetail?.uid }) }} className={cn(styles.loginBtn, 'mr-auto')}>登录</Button>}
              <Button size="small" className={styles.loginBtn} onClick={() => setOtherVisable(true)}>其他账号登录</Button>
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
                      <Button className={styles['code-button']} size="small" disabled={formBusy} onClick={() => run(handleSendCode)}>{codeSent ? '重新发送' : '获取验证码'}</Button>
                    </Input>
                  </>
                )}
              </div>
              {formError && <p role="alert">{formError}</p>}
              {codeSent && activeTab === 'register' && <p role="status">验证码已发送，请查看邮箱。</p>}
              <Button size="small" disabled={formBusy} className={cn(styles.loginBtn)} onClick={() => run(activeTab === 'register' ? handleRegister : handleLogin)}>{formBusy ? '正在连接…' : activeTab === 'register' ? '注册' : '登录'}</Button>
            </div>
          </>}
        <div className={styles.accountManagementFooter}>
          <Link href="/home">浏览首页 ↗</Link>
          <Link href="/terms">社区约定 ↗</Link>
          <Button size="small" disabled={formBusy} onClick={() => { onClose(); onConnect({ action: 'guest' }); }}>游客接入</Button>
        </div>
      </div>
    </Portal>
  );
}
