'use server'

export async function Api<T>(url: string, method: string, body?: T) {
  const backendUrl = process.env.BACKEND_URL
  if (!backendUrl) {
    console.warn('缺少 BACKEND_URL 环境变量')
    return null
  }

  const response = await fetch(backendUrl + url, {
    method,
    body: JSON.stringify(body),
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  })
  return response.json();
}