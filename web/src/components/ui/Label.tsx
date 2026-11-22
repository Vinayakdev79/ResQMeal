import { forwardRef, type LabelHTMLAttributes } from 'react';
import { cn } from './cn';

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(function Label(
  { className, ...rest },
  ref,
) {
  return <label ref={ref} className={cn('block font-sans text-sm font-medium text-muted', className)} {...rest} />;
});

