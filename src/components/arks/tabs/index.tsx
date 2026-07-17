import styles from './tabs.module.scss';
import { cn } from '@/lib/utils';

export type TabItem = {
  value: string;
  label: string;
};

export type TabsProps = {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
};

export default function Tabs({ items, value, onValueChange, className }: TabsProps) {
  return (
    <div className={cn(styles.tabs, className)}>
      {items.map((item) => (
        <button
          key={item.value}
          className={cn(styles.tab, value === item.value && styles.active)}
          onClick={() => onValueChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
