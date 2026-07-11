'use server'

import { IPinfoLiteWrapper } from 'node-ipinfo'
import type { IPinfoLite, IPBogon } from 'node-ipinfo/dist/src/common'
import { headers } from 'next/headers'

export async function getLocation(): Promise<IPinfoLite | IPBogon | null> {
  const token = process.env.IPINFO_API_KEY
  if (!token) {
    console.warn('缺少 IPINFO_API_KEY 环境变量')
    return null
  }

  const client = new IPinfoLiteWrapper(token)

  // 1. 获取所有请求头 (Next.js 15+ 中 headers() 返回 Promise，你的 await 用法是完全正确的)
  const headersList = await headers()
  
  // 2. 尝试从多个常见代理头中获取真实 IP
  const forwarded = headersList.get('x-forwarded-for')
  const realIp = headersList.get('x-real-ip')
  
  // 提取真实 IP，如果没有获取到，则兜底为 8.8.8.8 (Google DNS，用于防报错)
  const ip = forwarded?.split(',')[0]?.trim() || realIp?.trim() || '8.8.8.8'

  try {
    return await client.lookupIp(ip)
  } catch (error) {
    console.error(`IP定位失败 (IP: ${ip}):`, error)
    return null
  }
}