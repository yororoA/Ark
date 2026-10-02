export interface IndexEntry {
  no: string;
  label: string;
  latin: string;
  href: string;
  path: string;
  state: '当前' | '未挂载';
}

// 01 是封面本身。02–07 尚未挂载，点开会落到 404。
export const INDEX_ENTRIES: IndexEntry[] = [
  { no: '01', label: '封面', latin: 'COVER', href: '/home', path: '/home', state: '当前' },
  { no: '02', label: '动态', latin: 'NOTES', href: '/moments', path: '/moments', state: '未挂载' },
  { no: '03', label: '文章', latin: 'RECORD', href: '/articles', path: '/articles', state: '未挂载' },
  { no: '04', label: '图库', latin: 'PLATES', href: '/gallery', path: '/gallery', state: '未挂载' },
  { no: '05', label: '归档', latin: 'INDEX', href: '/archive', path: '/archive', state: '未挂载' },
  { no: '06', label: '通讯', latin: 'COMMS', href: '/chat', path: '/chat', state: '未挂载' },
  { no: '07', label: '档案', latin: 'COLOPHON', href: '/about', path: '/about', state: '未挂载' },
];

export const GITHUB_USER = 'yororoa';
