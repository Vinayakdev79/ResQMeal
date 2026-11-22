import { useState, type FormEvent, type ReactNode } from 'react';
import AppShell from '../../components/AppShell';
import { useAuth } from '../../auth/useAuth';
import type { Profile } from '../../auth/profile';
import { updateOwnProfile, type DonorProfilePatch } from '../../lib/donorApi';

const ORG_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'caterer', label: 'Caterer' },
  { value: 'household', label: 'Household' },
  { value: 'grocery_store', label: 'Grocery store' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'event_organiser', label: 'Event organiser' },
  { value: 'other', label: 'Other' },
];

const PHONE_PATTERN = /^\+?[0-9\s-]{7,15}$/;
const PIN_PATTERN = /^[0-9]{6}$/;

interface FormState {
  full_name: string;
  phone: string;
  organization_name: string;
  org_type: string;
  address_line: string;
  city: string;
  state: string;
  pin_code: string;
  location_label: string;
  latitude: string;
  longitude: string;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

function toFormState(profile: Profile | null): FormState {
  return {
    full_name: profile?.full_name ?? '',
    phone: profile?.phone ?? '',
    organization_name: profile?.organization_name ?? '',
    org_type: profile?.org_type ?? '',
    address_line: profile?.address_line ?? '',
    city: profile?.city ?? '',
    state: profile?.state ?? '',
    pin_code: profile?.pin_code ?? '',
    location_label: profile?.location_label ?? '',
    latitude: profile?.latitude != null ? String(profile.latitude) : '',
    longitude: profile?.longitude != null ? String(profile.longitude) : '',
  };
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.full_name.trim()) errors.full_name = 'Full name is required.';
  if (form.phone.trim() && !PHONE_PATTERN.test(form.phone.trim())) {
    errors.phone = 'Enter a valid phone number (7 to 15 digits).';
  }
  if (!form.org_type) errors.org_type = 'Select a donor type.';
  if (!form.address_line.trim()) errors.address_line = 'Address is required.';
  if (!form.city.trim()) errors.city = 'City is required.';
  if (!form.state.trim()) errors.state = 'State is required.';
  if (!PIN_PATTERN.test(form.pin_code.trim())) errors.pin_code = 'PIN code must be exactly 6 digits.';

  if (form.latitude.trim()) {
    const lat = Number(form.latitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      errors.latitude = 'Latitude must be a number between -90 and 90.';
    }
  }
  if (form.longitude.trim()) {
    const lng = Number(form.longitude);
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      errors.longitude = 'Longitude must be a number between -180 and 180.';
    }
  }
  return errors;
}

function toPatch(form: FormState): DonorProfilePatch {
  const optionalText = (value: string): string | null => (value.trim() ? value.trim() : null);
  const optionalNumber = (value: string): number | null => (value.trim() ? Number(value) : null);
  return {
    full_name: form.full_name.trim(),
    phone: optionalText(form.phone),
    organization_name: optionalText(form.organization_name),
    org_type: form.org_type,
    address_line: form.address_line.trim(),
    city: form.city.trim(),
    state: form.state.trim(),
    pin_code: form.pin_code.trim(),
    location_label: optionalText(form.location_label),
    latitude: optionalNumber(form.latitude),
    longitude: optionalNumber(form.longitude),
  };
}

interface FieldProps {
  id: keyof FormState;
  label: string;
  error?: string;
  children: ReactNode;
}

function Field({ id, label, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-charcoal">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const INPUT_CLASS =
  'rounded-lg border border-forest-100 bg-white px-3 py-2 text-sm text-charcoal focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-100';

export default function DonorProfilePage() {
  const { user, profile } = useAuth();
  const [form, setForm] = useState<FormState>(() => toFormState(profile));
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const setField = (field: keyof FormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setSuccessMessage(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!user) {
      setErrorMessage('You need to be signed in to update your profile.');
      return;
    }

    const validationErrors = validate(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setErrorMessage('Please fix the highlighted fields.');
      return;
    }

    setSaving(true);
    try {
      await updateOwnProfile(user.id, toPatch(form));
      setSuccessMessage('Profile saved.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="Profile settings">
      <div className="flex max-w-3xl flex-col gap-6">
        <section className="rounded-xl border border-forest-100 bg-white p-4">
          <p className="text-sm font-medium text-charcoal/70">Email</p>
          <p className="mt-1 text-sm text-charcoal" aria-label="Email address">
            {user?.email ?? '—'}
          </p>
          <p className="mt-1 text-xs text-charcoal/60">Email cannot be changed here.</p>
        </section>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6 rounded-xl border border-forest-100 bg-white p-4 md:p-6">
          <fieldset className="grid gap-4 md:grid-cols-2">
            <legend className="mb-2 text-base font-semibold text-charcoal">Donor details</legend>

            <Field id="full_name" label="Full name" error={errors.full_name}>
              <input
                id="full_name"
                type="text"
                className={INPUT_CLASS}
                value={form.full_name}
                onChange={(e) => setField('full_name')(e.target.value)}
                autoComplete="name"
              />
            </Field>

            <Field id="phone" label="Phone" error={errors.phone}>
              <input
                id="phone"
                type="tel"
                className={INPUT_CLASS}
                value={form.phone}
                onChange={(e) => setField('phone')(e.target.value)}
                autoComplete="tel"
              />
            </Field>

            <Field id="organization_name" label="Organization or business name" error={errors.organization_name}>
              <input
                id="organization_name"
                type="text"
                className={INPUT_CLASS}
                value={form.organization_name}
                onChange={(e) => setField('organization_name')(e.target.value)}
                autoComplete="organization"
              />
            </Field>

            <Field id="org_type" label="Donor type" error={errors.org_type}>
              <select
                id="org_type"
                className={INPUT_CLASS}
                value={form.org_type}
                onChange={(e) => setField('org_type')(e.target.value)}
              >
                <option value="">Select a donor type</option>
                {ORG_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </fieldset>

          <fieldset className="grid gap-4 md:grid-cols-2">
            <legend className="mb-2 text-base font-semibold text-charcoal">Pickup address</legend>

            <div className="md:col-span-2">
              <Field id="address_line" label="Address" error={errors.address_line}>
                <input
                  id="address_line"
                  type="text"
                  className={INPUT_CLASS}
                  value={form.address_line}
                  onChange={(e) => setField('address_line')(e.target.value)}
                  autoComplete="street-address"
                />
              </Field>
            </div>

            <Field id="city" label="City" error={errors.city}>
              <input
                id="city"
                type="text"
                className={INPUT_CLASS}
                value={form.city}
                onChange={(e) => setField('city')(e.target.value)}
                autoComplete="address-level2"
              />
            </Field>

            <Field id="state" label="State" error={errors.state}>
              <input
                id="state"
                type="text"
                className={INPUT_CLASS}
                value={form.state}
                onChange={(e) => setField('state')(e.target.value)}
                autoComplete="address-level1"
              />
            </Field>

            <Field id="pin_code" label="PIN code" error={errors.pin_code}>
              <input
                id="pin_code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                className={INPUT_CLASS}
                value={form.pin_code}
                onChange={(e) => setField('pin_code')(e.target.value)}
                autoComplete="postal-code"
              />
            </Field>

            <Field id="location_label" label="Pickup location label" error={errors.location_label}>
              <input
                id="location_label"
                type="text"
                className={INPUT_CLASS}
                value={form.location_label}
                onChange={(e) => setField('location_label')(e.target.value)}
                placeholder="e.g. Main kitchen loading dock"
              />
            </Field>

            <Field id="latitude" label="Latitude (optional)" error={errors.latitude}>
              <input
                id="latitude"
                type="text"
                inputMode="decimal"
                className={INPUT_CLASS}
                value={form.latitude}
                onChange={(e) => setField('latitude')(e.target.value)}
                placeholder="e.g. 12.9716"
              />
            </Field>

            <Field id="longitude" label="Longitude (optional)" error={errors.longitude}>
              <input
                id="longitude"
                type="text"
                inputMode="decimal"
                className={INPUT_CLASS}
                value={form.longitude}
                onChange={(e) => setField('longitude')(e.target.value)}
                placeholder="e.g. 77.5946"
              />
            </Field>
          </fieldset>

          {errorMessage ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}
          {successMessage ? (
            <p role="status" className="rounded-lg bg-forest-50 px-3 py-2 text-sm text-forest-700">
              {successMessage}
            </p>
          ) : null}

          <div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-forest-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-forest-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
