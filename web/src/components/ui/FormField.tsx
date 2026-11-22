import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Label } from './Label';
import { cn } from './cn';

export interface FormFieldProps {
  /** Visible label text. */
  label: string;
  /** id of the control inside `children`. Hint and error ids are derived as `${htmlFor}-hint` / `${htmlFor}-error`. */
  htmlFor: string;
  /** Helper text shown under the control when there is no error. */
  hint?: string;
  /** Error message shown under the control (announced via role="alert"). */
  error?: string;
  /** Shows a required asterisk next to the label. */
  required?: boolean;
  className?: string;
  /** The control (Input, Select, Textarea, ...). */
  children: ReactNode;
}

export function FormField({ label, htmlFor, hint, error, required = false, className, children }: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="ml-0.5 text-danger-700" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {children}
      {error !== undefined && error !== '' ? (
        <p id={`${htmlFor}-error`} role="alert" className="flex items-center gap-1 text-xs font-medium text-danger-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : (
        hint !== undefined && <p id={`${htmlFor}-hint`} className="text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

