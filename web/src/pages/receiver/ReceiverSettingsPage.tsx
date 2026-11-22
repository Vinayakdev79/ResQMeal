import { useState, type FormEvent } from 'react';
import AppShell from '../../components/AppShell';
import { Button, Card, FormField, Input } from '../../components/ui';
import { useAuth } from '../../auth/useAuth';
import { supabase } from '../../lib/supabase';

const MIN_PASSWORD_LENGTH = 8;

interface PasswordFormState {
  newPassword: string;
  confirmPassword: string;
}

type PasswordErrors = Partial<Record<keyof PasswordFormState, string>>;

function validatePassword(form: PasswordFormState): PasswordErrors {
  const errors: PasswordErrors = {};
  if (form.newPassword.length < MIN_PASSWORD_LENGTH) {
    errors.newPassword = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (form.confirmPassword !== form.newPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }
  return errors;
}

export default function ReceiverSettingsPage() {
  const { user } = useAuth();

  const [form, setForm] = useState<PasswordFormState>({ newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const setField = (field: keyof PasswordFormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setSuccessMessage(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSuccessMessage(null);
    setErrorMessage(null);

    const validationErrors = validatePassword(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setErrorMessage('Please fix the highlighted fields.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: form.newPassword });
      if (error) {
        setErrorMessage(error.message || 'Could not update password.');
      } else {
        setSuccessMessage('Password updated.');
        setForm({ newPassword: '', confirmPassword: '' });
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not update password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="Settings">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-1">
          <h1 className="font-sans text-2xl font-bold text-charcoal">Account settings</h1>
          <p className="text-sm text-muted">Review your sign-in email and update your password.</p>
        </header>

        <Card className="space-y-1">
          <h2 className="text-base font-semibold text-charcoal">Account</h2>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Signed-in email</p>
          <p className="text-sm font-medium text-charcoal" aria-label="Email address">
            {user?.email ?? '—'}
          </p>
          <p className="text-xs text-muted">Your email is used to sign in and cannot be changed here.</p>
        </Card>

        <Card>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-charcoal">Password</h2>
              <p className="text-sm text-muted">Use at least {MIN_PASSWORD_LENGTH} characters.</p>
            </div>

            <FormField htmlFor="new-password" label="New password" error={errors.newPassword} required>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                invalid={!!errors.newPassword}
                value={form.newPassword}
                onChange={(e) => setField('newPassword')(e.target.value)}
              />
            </FormField>

            <FormField htmlFor="confirm-password" label="Confirm new password" error={errors.confirmPassword} required>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                invalid={!!errors.confirmPassword}
                value={form.confirmPassword}
                onChange={(e) => setField('confirmPassword')(e.target.value)}
              />
            </FormField>

            {errorMessage ? (
              <p role="alert" className="rounded-xl bg-danger-100 px-4 py-3 text-sm font-medium text-danger-700">
                {errorMessage}
              </p>
            ) : null}
            {successMessage ? (
              <p role="status" className="rounded-xl bg-forest-50 px-4 py-3 text-sm font-medium text-forest-700">
                {successMessage}
              </p>
            ) : null}

            <div>
              <Button type="submit" loading={saving} disabled={saving}>
                {saving ? 'Updating…' : 'Update password'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
