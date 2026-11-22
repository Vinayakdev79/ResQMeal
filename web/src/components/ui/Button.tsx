import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. Default: 'primary'. */
  variant?: ButtonVariant;
  /** Height/padding preset. Default: 'md'. */
  size?: ButtonSize;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
  /** Leading icon (any element, e.g. a lucide-react icon). Replaced by the spinner while loading. */
  icon?: ReactNode;
  /** Stretches to the full width of its container. */
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-forest-700 text-white shadow-sm hover:bg-forest-800 active:bg-forest-900 disabled:bg-forest-300',
  secondary: 'border border-line bg-surface text-forest-700 shadow-sm hover:border-forest-200 hover:bg-forest-50 active:bg-forest-100 disabled:text-muted',
  ghost: 'bg-transparent text-forest-700 hover:bg-forest-50 active:bg-forest-100 disabled:text-muted',
  danger: 'bg-danger-700 text-white shadow-sm hover:bg-danger-800 active:bg-danger-800 disabled:bg-danger-100 disabled:text-danger-700',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 px-3 text-xs',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-12 gap-2 px-6 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, icon, fullWidth = false, disabled, className, children, type = 'button', ...rest },
  ref,
) {
  const isDisabled = disabled === true || loading;
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        'btn-press inline-flex items-center justify-center rounded-xl font-sans font-semibold transition-colors duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500',
        'disabled:cursor-not-allowed disabled:shadow-none',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
});

