import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

/** Shared control styling for Input, Select and Textarea. */
export const CONTROL_BASE =
  'block w-full rounded-xl border bg-surface px-3 py-2 font-sans text-sm text-charcoal shadow-sm placeholder:text-muted ' +
  'transition-colors duration-150 focus:outline-none focus-visible:ring-2 ' +
  'disabled:cursor-not-allowed disabled:bg-mist disabled:text-muted';

export const CONTROL_STATE = {
  normal: 'border-line focus:border-forest-500 focus-visible:ring-forest-500/30',
  invalid: 'border-danger-500 focus:border-danger-500 focus-visible:ring-danger-500/30',
} as const;

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Shows the danger border/ring and sets aria-invalid. */
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ invalid = false, className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(CONTROL_BASE, invalid ? CONTROL_STATE.invalid : CONTROL_STATE.normal, 'h-10', className)}
      {...rest}
    />
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Shows the danger border/ring and sets aria-invalid. */
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ invalid = false, className, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(CONTROL_BASE, invalid ? CONTROL_STATE.invalid : CONTROL_STATE.normal, 'h-10 pr-8', className)}
      {...rest}
    >
      {children}
    </select>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Shows the danger border/ring and sets aria-invalid. */
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid = false, className, rows = 4, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(CONTROL_BASE, invalid ? CONTROL_STATE.invalid : CONTROL_STATE.normal, 'min-h-[88px] resize-y', className)}
      {...rest}
    />
  );
});

