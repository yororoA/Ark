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
  });

  if (!response.ok) {
    let message = `请求失败: ${response.status} ${response.statusText}`;
    try {
      const errorBody = await response.json();
      if (errorBody.message) {
        message = errorBody.message;
      }
    } catch {
      // 非 JSON 响应，使用默认消息
    }
    throw new Error(message);
  }

  return response.json();
}