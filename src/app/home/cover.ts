export interface IndexEntry {
  no: string;
  label: string;
  latin: string;
  href: string;
  note: string;
}

// 编号固定，对应刊物目录顺序；01 留给封面本身
export const INDEX_ENTRIES: IndexEntry[] = [
  { no: '02', label: '动态', latin: 'NOTES', href: '/moments', note: '近况' },
  { no: '03', label: '文章', latin: 'RECORD', href: '/articles', note: '目录与正文' },
  { no: '04', label: '图库', latin: 'PLATES', href: '/gallery', note: '图版' },
  { no: '05', label: '归档', latin: 'INDEX', href: '/archive', note: '按年总目' },
  { no: '06', label: '通讯', latin: 'COMMS', href: '/chat', note: '群聊 · 私聊' },
  { no: '07', label: '档案', latin: 'COLOPHON', href: '/about', note: '关于 · 友链 · 留言' },
];

export const EDITOR_NOTE = {
  kicker: '编者按',
  title: '本刊正在迁入 Ark',
  body: '旧站的动态、文章与图库会按目录顺序陆续开放。扉页已经可以连接。栏目上线前，目录里的入口会先落到 404，几秒后回到封面。',
  href: '/login',
  linkLabel: '回到扉页',
};

export const GITHUB_USER = 'yororoa';
