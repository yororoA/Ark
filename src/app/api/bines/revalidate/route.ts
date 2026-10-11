import { createHmac, timingSafeEqual } from 'node:crypto'
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const reply = (status: number, message: string) => NextResponse.json(
    { success: status === 200, message }, { status, headers: { 'Cache-Control': 'no-store' } },
  )
  const secret = process.env.ARK_REVALIDATE_SECRET
  if (!secret || Buffer.byteLength(secret) < 32) return reply(503, 'Webhook unavailable')
  const timestamp = request.headers.get('x-ark-timestamp') || ''
  const signature = request.headers.get('x-ark-signature') || ''
  const validTime = /^\d{10,11}$/.test(timestamp) && Math.abs(Date.now() / 1000 - Number(timestamp)) <= 300
  if (!validTime || !/^[a-f0-9]{64}$/i.test(signature)) return reply(401, 'Invalid signature')
  const raw = await request.text()
  if (Buffer.byteLength(raw) > 1024) return reply(413, 'Payload too large')
  const expected = createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest()
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return reply(401, 'Invalid signature')
  try {
    const body = JSON.parse(raw)
    if (body?.kind !== 'moments' || typeof body.event_id !== 'string' || !body.event_id || body.event_id.length > 128) {
      return reply(400, 'Invalid event')
    }
  } catch { return reply(400, 'Invalid JSON') }
  // This shared tag covers list, detail, homepage, archive and sitemap fetches.
  // Duplicate signed events are harmless. Webhooks require immediate expiry.
  revalidateTag('public-blog-content', { expire: 0 })
  return reply(200, 'Revalidated')
}
