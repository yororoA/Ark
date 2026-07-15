import { InputHTMLAttributes } from 'react';
import styles from './input.module.scss';
import { cn } from '@/lib/utils';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export default function Input({ className, ...rest }: InputProps) {
  return (
    <input className={cn(styles.input, className)} {...rest} />
  );
}
