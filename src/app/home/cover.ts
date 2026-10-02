export type ModuleState = 'CURRENT' | 'STANDBY' | 'LOCKED' | 'ARCHIVED' | 'OFFLINE';

export interface IndexEntry {
  no: string;
  label: string;
  latin: string;
  href: string;
  path: string;
  kind: string;
  access: string;
  updated: string;
  state: ModuleState;
  x: number;
  y: number;
}

export const STATE_LABEL: Record<ModuleState, string> = {
  CURRENT: '当前',
  STANDBY: '待命',
  LOCKED: '锁定',
  ARCHIVED: '归档',
  OFFLINE: '离线',
};

// 坐标落在下方 GRID 上。摘要数字按 state 计数，和这些行是同一份数据。
export const INDEX_ENTRIES: IndexEntry[] = [
  { no: '01', label: '封面', latin: 'COVER', href: '/home', path: '/home', kind: '页面', access: '公开', updated: '本日', state: 'CURRENT', x: 2, y: 1 },
  { no: '02', label: '动态', latin: 'NOTES', href: '/moments', path: '/moments', kind: '记录', access: '公开', updated: '无更新', state: 'STANDBY', x: 5, y: 3 },
  { no: '03', label: '文章', latin: 'RECORD', href: '/articles', path: '/articles', kind: '记录', access: '公开', updated: '无更新', state: 'STANDBY', x: 8, y: 2 },
  { no: '04', label: '图库', latin: 'PLATES', href: '/gallery', path: '/gallery', kind: '图版', access: '锁定', updated: '无更新', state: 'LOCKED', x: 10, y: 4 },
  { no: '05', label: '归档', latin: 'INDEX', href: '/archive', path: '/archive', kind: '总目', access: '公开', updated: '无更新', state: 'ARCHIVED', x: 3, y: 4 },
  { no: '06', label: '通讯', latin: 'COMMS', href: '/chat', path: '/chat', kind: '通讯', access: '关闭', updated: '无更新', state: 'OFFLINE', x: 7, y: 1 },
  { no: '07', label: '档案', latin: 'COLOPHON', href: '/about', path: '/about', kind: '刊末', access: '公开', updated: '无更新', state: 'STANDBY', x: 4, y: 2 },
];

export const GITHUB_USER = 'yororoa';

export const GRID_X = 12;
export const GRID_Y = 6;

export function countState(state: ModuleState) {
  return INDEX_ENTRIES.filter((entry) => entry.state === state).length;
}

export function formatCoverDate(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}
