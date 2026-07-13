'use server';

import sha256 from 'crypto-js/sha256'
import hex from 'crypto-js/enc-hex'
import { z } from 'zod'
import { Api } from './api'

interface LoginRequest {
  username: string;
  password: string;
}

interface RegisterRequest {
  username: string;
  password: string;
  email: string;
  verificationCode: string;
}

type Auth = 'login' | 'register' | 'guest';
type AuthReq = {
  login: LoginRequest;
  register: RegisterRequest;
  guest: never;
}
type AuthRequest<T extends Auth> = AuthReq[T];

// 认证接口映射
const AuthUrlMap: Record<Auth, string> = {
  login: '/login',
  register: '/register',
  guest: '/guest/login',
}

// 参数校验
const LoginSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
});

const RegisterSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
  email: z.email({ error: '邮箱格式错误' }),
  verificationCode: z.string().length(6, '验证码长度错误，必须为6位数字'),
});

// 密码加密
function encryptPassword(password: string) {
  return sha256(password).toString(hex)
}

// 函数重载
export async function authAction<T extends 'login' | 'register'>(auth: T, request: AuthRequest<T>): Promise<ReturnType<typeof Api>>
export async function authAction<T extends 'guest'>(auth: 'guest'): Promise<ReturnType<typeof Api>>

// 认证操作主体
export async function authAction<T extends Auth>(auth: T, request?: AuthRequest<T>) {
  const api_url = '/api/v2' + AuthUrlMap[auth];

  if (auth === 'guest') {
    return await Api(api_url, 'POST');
  }

  if (!request) {
    throw new Error('请求参数不能为空');
  }

  // 校验参数
  if (auth === 'login') {
    LoginSchema.parse(request);
  } else if (auth === 'register') {
    RegisterSchema.parse(request);
  }
  let payload = { ...request };

  payload.password = encryptPassword(payload.password);

  try {
    return await Api(api_url, 'POST', payload);
  } catch (error) {
    throw new Error(error.message);
  }
}
