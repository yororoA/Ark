import { BackendError, upstream } from './blog-session'

export class ApiError extends BackendError {
  constructor(message: string, status: number, public hint?: string) {
    super(message, status)
  }
}

/**
 * 服务端 fetch 工具 — 仅在 Route Handler / Server Action 等服务端上下文使用。
 *
 * 后端 API 响应中的 Set-Cookie 会被 server-to-server fetch 静默丢弃，
 * 因此调用方若需要把 token 下发到浏览器，必须自行通过 cookies().set() 写入。
 */
export async function Api<T>(url: string, method: string, body?: T) {
  const response = await upstream(url, {
    method,
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    let message = `请求失败: ${response.status} ${response.statusText}`;
    let hint: string | undefined;
    try {
      const errorBody = await response.json();
      if (errorBody.message) {
        message = errorBody.message;
      }
      if (typeof errorBody.hint === 'string') hint = errorBody.hint;
    } catch {
      // 非 JSON 响应，使用默认消息
    }
    throw new ApiError(message, response.status, hint);
  }

  return response.json();
}
