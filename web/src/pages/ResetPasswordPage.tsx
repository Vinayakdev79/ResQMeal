import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dashboardPathFor } from '../auth/RequireAuth';
import { useAuth } from '../auth/useAuth';
import { AuthLayout } from '../components/AuthLayout';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { Input } from '../components/ui/Input';

export default function ResetPasswordPage() {
  const { status, role, updatePassword } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimer.current !== null) {
        clearTimeout(redirectTimer.current);
        redirectTimer.current = null;
      }
    };
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    const next: { password?: string; confirm?: string } = {};
    if (password.length < 8) next.password = 'Password must be at least 8 characters';
    if (confirm !== password) next.confirm = 'Passwords do not match';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    const result = await updatePassword(password);
    setSubmitting(false);

    if (result.error) {
      setFormError(result.error);
      return;
    }

    setDone(true);
    redirectTimer.current = setTimeout(() => {
      redirectTimer.current = null;
      navigate(role ? dashboardPathFor(role) : '/login', { replace: true });
    }, 1500);
  };

  if (status === 'loading') {
    return (
      <AuthLayout>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-charcoal">Checking your link...</h1>
      </AuthLayout>
    );
  }

  if (status === 'signed_out') {
    return (
      <AuthLayout>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-charcoal">Reset link unavailable</h1>
        <p className="mt-4 text-sm text-muted">This reset link is invalid or has expired.</p>
        <p className="mt-6 text-center text-sm">
          <Link to="/forgot-password" className="font-semibold text-forest-700 hover:underline">
            Request a new reset link
          </Link>
        </p>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-charcoal">Password updated</h1>
        <p
          className="mt-4 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-800"
          role="status"
        >
          Redirecting you to your dashboard...
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-charcoal">Set a new password</h1>

      <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
        <FormField label="New password" htmlFor="password" error={errors.password}>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={errors.password !== undefined}
          />
        </FormField>

        <FormField label="Confirm new password" htmlFor="confirm" error={errors.confirm}>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            invalid={errors.confirm !== undefined}
          />
        </FormField>

        {formError && (
          <p role="alert" className="rounded-xl border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-800">
            {formError}
          </p>
        )}

        <Button type="submit" size="lg" fullWidth loading={submitting}>
          {submitting ? 'Updating...' : 'Update password'}
        </Button>
      </form>
    </AuthLayout>
  );
}
