import { ButtonHTMLAttributes } from 'react';
import styles from './button.module.scss';
import { cn } from '@/lib/utils';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: 'small' | 'large'
}

export default function Button({ size = 'small', className, children, ...rest }: ButtonProps) {
  return (
    <button className={cn(styles.button, styles[size || 'small'], className)} {...rest}>
      {children}
    </button>
  );
}
