import { InputHTMLAttributes, forwardRef } from 'react';
import styles from './input.module.scss';
import { cn } from '@/lib/utils';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & { label: string; id: string };

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, id, className, children, ...rest },
  ref,
) {
  return (
    <div className={cn(styles.inputContainer)}>
      <label htmlFor={id}>{label}</label>
      <div className={cn(styles.inputWrapper)}>
        <input ref={ref} id={id} className={cn(styles.input, className)} {...rest} />
        {children}
      </div>
    </div>
  );
});

export default Input;
