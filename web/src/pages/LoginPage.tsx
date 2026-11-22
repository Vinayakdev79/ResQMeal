import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import type { AuthRole } from '../auth/profile';
import { dashboardPathFor } from '../auth/RequireAuth';
import { useAuth } from '../auth/useAuth';
import { AuthLayout } from '../components/AuthLayout';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { Input } from '../components/ui/Input';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Where a signed-in user should land: the `from` path when this role may view it
 * (its own dashboard, or /impact and /reports), otherwise the role's dashboard.
 */
function postLoginPath(role: AuthRole, from: string | undefined): string {
  const home = dashboardPathFor(role);
  if (from !== undefined && (from === home || from.startsWith(`${home}/`) || from === '/impact' || from === '/reports')) {
    return from;
  }
  return home;
}

export default function LoginPage() {
  const { status, role, signIn } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: unknown } | null)?.from;
  const fromPath = typeof from === 'string' ? from : undefined;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'authenticated' && role !== null) {
    return <Navigate to={postLoginPath(role, fromPath)} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password === '') {
      setError('Enter your password.');
      return;
    }
    setError(null);
    setSubmitting(true);
    const result = await signIn(trimmedEmail, password);
    setSubmitting(false);
    if (result.error !== null) {
      setError(result.error);
    }
  }

  return (
    <AuthLayout>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-charcoal">Sign in</h1>
      <p className="mt-2 text-sm text-muted">Use your ResQMeal email and password.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
        <FormField label="Email" htmlFor="login-email">
          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FormField>
        <FormField label="Password" htmlFor="login-password">
          <Input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>
        {error !== null && (
          <p role="alert" className="rounded-xl border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-800">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" fullWidth loading={submitting} className="mt-2">
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <div className="mt-6 flex flex-col gap-2 text-center text-sm">
        <Link to="/forgot-password" className="font-semibold text-forest-700 hover:underline">
          Forgot password?
        </Link>
        <p className="text-muted">
          New to ResQMeal?{' '}
          <Link to="/signup" className="font-semibold text-forest-700 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
