/**
 * handleConnect 的参数类型。
 *
 * 用联合类型 + action 字段做区分，替代原来的位置参数。
 * 原来的签名是 (s, username, uid, password, email, code) —— uid 夹在
 * username 和 password 之间，导致 accountManagement 的调用方全部错位
 * （password 被赋给 uid，password 变 undefined → 空字符串）。
 *
 * 联合类型让每个 action 的参数集合在类型层面就明确，杜绝错位。
 */
export type ConnectParams =
  | { action: 'switch'; uid?: string }
  | { action: 'login'; username: string; password: string }
  | { action: 'register'; username: string; password: string; email: string; code: string };
