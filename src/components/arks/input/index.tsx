import { InputHTMLAttributes, forwardRef, useState } from 'react';
import styles from './input.module.scss';
import { cn } from '@/lib/utils';
import { Eye, EyeOff } from 'lucide-react';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  id: string;
  encrypt?: boolean;
};

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, id, className, children, encrypt, ...rest },
  ref,
) {
  const [show, setShow] = useState(false);

  return (
    <div className={cn(styles.inputContainer)}>
      <label htmlFor={id}>{label}</label>
      <div className={cn(styles.inputWrapper)}>
        <input
          ref={ref}
          id={id}
          type={encrypt ? (show ? 'text' : 'password') : rest.type}
          className={cn(styles.input, encrypt && styles.inputEncrypt, className)}
          {...rest}
        />
        {encrypt && (
          <button
            type="button"
            className={cn(styles.toggleBtn)}
            onClick={() => setShow(!show)}
          >
            {show ? <EyeOff size={24} strokeWidth={1.5} /> : <Eye size={24} strokeWidth={1.5} />}
          </button>
        )}
        {children}
      </div>
    </div>
  );
});

export default Input;
