import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { AuthLayout } from '../components/AuthLayout';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { Input } from '../components/ui/Input';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setEmailError('Enter a valid email address');
      return;
    }
    setEmailError(null);

    setSubmitting(true);
    const result = await resetPassword(trimmed);
    setSubmitting(false);

    if (result.error) {
      setFormError(result.error);
      return;
    }
    setSent(true);
  };

  return (
    <AuthLayout>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-charcoal">Reset your password</h1>

      {sent ? (
        <p
          className="mt-6 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-800"
          role="status"
        >
          If an account exists for that email, a reset link has been sent.
        </p>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
          <FormField label="Email" htmlFor="email" error={emailError ?? undefined}>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              invalid={emailError !== null}
            />
          </FormField>

          {formError && (
            <p role="alert" className="rounded-xl border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-800">
              {formError}
            </p>
          )}

          <Button type="submit" size="lg" fullWidth loading={submitting}>
            {submitting ? 'Sending...' : 'Send reset link'}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        <Link to="/login" className="font-semibold text-forest-700 hover:underline">
          Back to login
        </Link>
      </p>
    </AuthLayout>
  );
}
