export type ModuleState = 'CURRENT' | 'STANDBY' | 'LOCKED' | 'ARCHIVED' | 'OFFLINE';

export interface IndexEntry {
  no: string;
  label: string;
  latin: string;
  href: string;
  path: string;
  state: ModuleState;
}

export const STATE_LABEL: Record<ModuleState, string> = {
  CURRENT: '当前',
  STANDBY: '待命',
  LOCKED: '锁定',
  ARCHIVED: '归档',
  OFFLINE: '离线',
};

// 01 是这一页。其余状态要能和右上角摘要对上，不能整列同一个词。
export const INDEX_ENTRIES: IndexEntry[] = [
  { no: '01', label: '封面', latin: 'COVER', href: '/home', path: '/home', state: 'CURRENT' },
  { no: '02', label: '动态', latin: 'NOTES', href: '/moments', path: '/moments', state: 'STANDBY' },
  { no: '03', label: '文章', latin: 'RECORD', href: '/articles', path: '/articles', state: 'STANDBY' },
  { no: '04', label: '图库', latin: 'PLATES', href: '/gallery', path: '/gallery', state: 'LOCKED' },
  { no: '05', label: '归档', latin: 'INDEX', href: '/archive', path: '/archive', state: 'ARCHIVED' },
  { no: '06', label: '通讯', latin: 'COMMS', href: '/chat', path: '/chat', state: 'OFFLINE' },
  { no: '07', label: '档案', latin: 'COLOPHON', href: '/about', path: '/about', state: 'STANDBY' },
];

export const GITHUB_USER = 'yororoa';

export function countState(state: ModuleState) {
  return INDEX_ENTRIES.filter((entry) => entry.state === state).length;
}
