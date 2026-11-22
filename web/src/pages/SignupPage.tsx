import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dashboardPathFor } from '../auth/RequireAuth';
import { useAuth } from '../auth/useAuth';
import { AuthLayout } from '../components/AuthLayout';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { Input, Select } from '../components/ui/Input';

type Role = 'donor' | 'receiver';

const DONOR_TYPES = [
  'restaurant',
  'hotel',
  'caterer',
  'household',
  'grocery_store',
  'bakery',
  'event_organiser',
  'other',
] as const;

const RECEIVER_TYPES = [
  'ngo',
  'shelter',
  'charity',
  'community_kitchen',
  'orphanage',
  'old_age_home',
  'other',
] as const;

interface FormState {
  full_name: string;
  email: string;
  password: string;
  confirm: string;
  phone: string;
  org_type: string;
  organization_name: string;
  address_line: string;
  city: string;
  state: string;
  pin_code: string;
  location_label: string;
  latitude: string;
  longitude: string;
  people_served: string;
}

type FieldName = keyof FormState;
type Errors = Partial<Record<FieldName, string>>;

const EMPTY_FORM: FormState = {
  full_name: '',
  email: '',
  password: '',
  confirm: '',
  phone: '',
  org_type: DONOR_TYPES[0],
  organization_name: '',
  address_line: '',
  city: '',
  state: '',
  pin_code: '',
  location_label: '',
  latitude: '',
  longitude: '',
  people_served: '',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatLabel(value: string): string {
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function validate(role: Role, f: FormState): Errors {
  const e: Errors = {};
  const required: FieldName[] = [
    'full_name',
    'email',
    'password',
    'confirm',
    'phone',
    'organization_name',
    'address_line',
    'city',
    'state',
    'pin_code',
    'location_label',
  ];
  for (const key of required) {
    if (f[key].trim() === '') e[key] = 'This field is required';
  }

  if (!e.email && !EMAIL_RE.test(f.email.trim())) {
    e.email = 'Enter a valid email address';
  }
  if (!e.password && f.password.length < 8) {
    e.password = 'Password must be at least 8 characters';
  }
  if (!e.confirm && f.confirm !== f.password) {
    e.confirm = 'Passwords do not match';
  }
  if (!e.phone && !/^\d{7,15}$/.test(f.phone.replace(/[\s-]/g, ''))) {
    e.phone = 'Enter 7 to 15 digits';
  }
  if (!e.pin_code && !/^\d{6}$/.test(f.pin_code.trim())) {
    e.pin_code = 'PIN code must be exactly 6 digits';
  }
  if (role === 'receiver' && !e.people_served) {
    const n = Number(f.people_served.trim());
    if (!/^\d+$/.test(f.people_served.trim()) || !Number.isInteger(n) || n <= 0) {
      e.people_served = 'Enter a positive whole number';
    }
  }

  if (f.latitude.trim() !== '') {
    const lat = Number(f.latitude.trim());
    if (Number.isNaN(lat) || lat < -90 || lat > 90) e.latitude = 'Latitude must be between -90 and 90';
  }
  if (f.longitude.trim() !== '') {
    const lng = Number(f.longitude.trim());
    if (Number.isNaN(lng) || lng < -180 || lng > 180) e.longitude = 'Longitude must be between -180 and 180';
  }

  return e;
}

/** Labelled text input wired to the ui kit FormField + Input. */
function TextField({
  id,
  label,
  value,
  onChange,
  error,
  type = 'text',
  autoComplete,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email';
}) {
  return (
    <FormField label={label} htmlFor={id} error={error}>
      <Input
        id={id}
        name={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        invalid={error !== undefined}
      />
    </FormField>
  );
}

/** Labelled select wired to the ui kit FormField + Select. */
function SelectField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}) {
  return (
    <FormField label={label} htmlFor={id}>
      <Select id={id} name={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {formatLabel(opt)}
          </option>
        ))}
      </Select>
    </FormField>
  );
}

export default function SignupPage() {
  const { signUp, role: authRole } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState<Role>('donor');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const update = (key: FieldName) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const chooseRole = (next: Role) => {
    setRole(next);
    setErrors({});
    setForm((prev) => ({
      ...prev,
      org_type: next === 'donor' ? DONOR_TYPES[0] : RECEIVER_TYPES[0],
    }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    const found = validate(role, form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const isReceiver = role === 'receiver';
    const metadata: Record<string, string | number | null> = {
      role,
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      organization_name: form.organization_name.trim(),
      org_type: form.org_type,
      address_line: form.address_line.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      pin_code: form.pin_code.trim(),
      location_label: form.location_label.trim(),
      latitude: blankToNull(form.latitude),
      longitude: blankToNull(form.longitude),
      people_served: isReceiver ? form.people_served.trim() : null,
    };

    setSubmitting(true);
    const result = await signUp({
      email: form.email.trim(),
      password: form.password,
      metadata,
    });
    setSubmitting(false);

    if (result.error) {
      setFormError(result.error);
      return;
    }
    if (result.needsEmailConfirmation) {
      setConfirmationSent(true);
      return;
    }
    // authRole is still null in this closure right after signup, so fall back to the chosen role.
    const target = authRole ?? role;
    navigate(dashboardPathFor(target), { replace: true });
  };

  if (confirmationSent) {
    return (
      <AuthLayout>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-charcoal">
          Check your email to confirm your account
        </h1>
        <p className="mt-3 text-sm text-muted">Once confirmed, you can log in with your email and password.</p>
        <Link
          to="/login"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-xl bg-forest-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-forest-800"
        >
          Go to login
        </Link>
      </AuthLayout>
    );
  }

  const toggleBase =
    'flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500/30';
  const toggleOn = 'border-forest-700 bg-forest-700 text-white shadow-sm';
  const toggleOff = 'border-line bg-surface text-charcoal hover:border-forest-200 hover:bg-forest-50';

  return (
    <AuthLayout wide>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-charcoal">Create an account</h1>

      <div className="mt-5 flex gap-2" role="group" aria-label="Account type">
        <button
          type="button"
          aria-pressed={role === 'donor'}
          onClick={() => chooseRole('donor')}
          className={`${toggleBase} ${role === 'donor' ? toggleOn : toggleOff}`}
        >
          Donor
        </button>
        <button
          type="button"
          aria-pressed={role === 'receiver'}
          onClick={() => chooseRole('receiver')}
          className={`${toggleBase} ${role === 'receiver' ? toggleOn : toggleOff}`}
        >
          Receiver
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Your details</h2>
        <TextField id="full_name" label="Full name" value={form.full_name} onChange={update('full_name')} error={errors.full_name} autoComplete="name" />
        <TextField id="email" label="Email" type="email" value={form.email} onChange={update('email')} error={errors.email} autoComplete="email" inputMode="email" />
        <TextField id="password" label="Password" type="password" value={form.password} onChange={update('password')} error={errors.password} autoComplete="new-password" />
        <TextField id="confirm" label="Confirm password" type="password" value={form.confirm} onChange={update('confirm')} error={errors.confirm} autoComplete="new-password" />
        <TextField id="phone" label="Phone" type="tel" value={form.phone} onChange={update('phone')} error={errors.phone} autoComplete="tel" inputMode="tel" />

        <h2 className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted">
          {role === 'donor' ? 'Donor details' : 'Organization details'}
        </h2>

        {role === 'donor' ? (
          <SelectField id="org_type" label="Donor type" value={form.org_type} onChange={update('org_type')} options={DONOR_TYPES} />
        ) : (
          <SelectField id="org_type" label="Receiver type" value={form.org_type} onChange={update('org_type')} options={RECEIVER_TYPES} />
        )}

        <TextField id="organization_name" label={role === 'donor' ? 'Organization / business name' : 'Organization name'} value={form.organization_name} onChange={update('organization_name')} error={errors.organization_name} />
        <TextField id="address_line" label="Address" value={form.address_line} onChange={update('address_line')} error={errors.address_line} autoComplete="street-address" />
        <TextField id="city" label="City" value={form.city} onChange={update('city')} error={errors.city} autoComplete="address-level2" />
        <TextField id="state" label="State" value={form.state} onChange={update('state')} error={errors.state} autoComplete="address-level1" />
        <TextField id="pin_code" label="PIN code" value={form.pin_code} onChange={update('pin_code')} error={errors.pin_code} inputMode="numeric" autoComplete="postal-code" />
        <TextField
          id="location_label"
          label={role === 'donor' ? 'Pickup location' : 'Location'}
          value={form.location_label}
          onChange={update('location_label')}
          error={errors.location_label}
        />

        {role === 'receiver' && (
          <TextField id="people_served" label="Approximate number of people served" value={form.people_served} onChange={update('people_served')} error={errors.people_served} inputMode="numeric" />
        )}

        <TextField id="latitude" label="Latitude (optional)" value={form.latitude} onChange={update('latitude')} error={errors.latitude} inputMode="decimal" />
        <TextField id="longitude" label="Longitude (optional)" value={form.longitude} onChange={update('longitude')} error={errors.longitude} inputMode="decimal" />

        {formError && (
          <p role="alert" className="rounded-xl border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-800">
            {formError}
          </p>
        )}

        <Button type="submit" size="lg" fullWidth loading={submitting} className="mt-2">
          {submitting ? 'Creating account...' : 'Create account'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        <Link to="/login" className="font-semibold text-forest-700 hover:underline">
          Already have an account? Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
