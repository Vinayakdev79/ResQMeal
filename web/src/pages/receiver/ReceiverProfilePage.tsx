import { useState, type FormEvent } from 'react';
import AppShell from '../../components/AppShell';
import { Button, Card, FormField, Input, Select, Skeleton } from '../../components/ui';
import { useAuth } from '../../auth/useAuth';
import type { Profile } from '../../auth/profile';
import { updateOwnProfile, type DonorProfilePatch } from '../../lib/donorApi';

const ORG_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'ngo', label: 'NGO' },
  { value: 'shelter', label: 'Shelter' },
  { value: 'orphanage', label: 'Orphanage' },
  { value: 'old_age_home', label: 'Old age home' },
  { value: 'community_kitchen', label: 'Community kitchen' },
  { value: 'food_bank', label: 'Food bank' },
  { value: 'individual', label: 'Individual' },
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
  if (!form.org_type) errors.org_type = 'Select an organization type.';
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

function ProfileSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading profile" className="space-y-6">
      <Card className="space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-5 w-64" />
      </Card>
      <Card className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ))}
      </Card>
    </div>
  );
}

export default function ReceiverProfilePage() {
  const { user, profile, status } = useAuth();

  if (status === 'loading') {
    return (
      <AppShell title="Profile">
        <div className="mx-auto max-w-4xl space-y-6">
          <PageHeader />
          <ProfileSkeleton />
        </div>
      </AppShell>
    );
  }

  if (status === 'profile_missing' || !profile) {
    return (
      <AppShell title="Profile">
        <div className="mx-auto max-w-4xl space-y-6">
          <PageHeader />
          <p role="alert" className="rounded-xl bg-danger-100 px-4 py-3 text-sm font-medium text-danger-700">
            We could not load your profile. Please refresh the page or sign in again.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Profile">
      <ProfileForm userId={user?.id ?? null} email={user?.email ?? null} profile={profile} />
    </AppShell>
  );
}

function PageHeader() {
  return (
    <header className="space-y-1">
      <h1 className="font-sans text-2xl font-bold text-charcoal">Your profile</h1>
      <p className="text-sm text-muted">
        Keep your organization details and pickup address up to date so donors can reach you.
      </p>
    </header>
  );
}

interface ProfileFormProps {
  userId: string | null;
  email: string | null;
  profile: Profile;
}

function ProfileForm({ userId, email, profile }: ProfileFormProps) {
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
    if (saving) return;
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!userId) {
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
      await updateOwnProfile(userId, toPatch(form));
      setSuccessMessage('Profile saved.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader />

      <Card className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Email</p>
        <p className="text-sm font-medium text-charcoal" aria-label="Email address">
          {email ?? '—'}
        </p>
        <p className="text-xs text-muted">Email cannot be changed here.</p>
      </Card>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <Card className="grid gap-4 md:grid-cols-2">
          <h2 className="text-base font-semibold text-charcoal md:col-span-2">Organization details</h2>

          <FormField htmlFor="full_name" label="Full name" error={errors.full_name} required>
            <Input
              id="full_name"
              type="text"
              invalid={!!errors.full_name}
              value={form.full_name}
              onChange={(e) => setField('full_name')(e.target.value)}
              autoComplete="name"
            />
          </FormField>

          <FormField htmlFor="phone" label="Phone" error={errors.phone}>
            <Input
              id="phone"
              type="tel"
              invalid={!!errors.phone}
              value={form.phone}
              onChange={(e) => setField('phone')(e.target.value)}
              autoComplete="tel"
            />
          </FormField>

          <FormField htmlFor="organization_name" label="Organization name" error={errors.organization_name}>
            <Input
              id="organization_name"
              type="text"
              invalid={!!errors.organization_name}
              value={form.organization_name}
              onChange={(e) => setField('organization_name')(e.target.value)}
              autoComplete="organization"
            />
          </FormField>

          <FormField htmlFor="org_type" label="Organization type" error={errors.org_type} required>
            <Select
              id="org_type"
              invalid={!!errors.org_type}
              value={form.org_type}
              onChange={(e) => setField('org_type')(e.target.value)}
            >
              <option value="">Select an organization type</option>
              {ORG_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
        </Card>

        <Card className="grid gap-4 md:grid-cols-2">
          <h2 className="text-base font-semibold text-charcoal md:col-span-2">Delivery address</h2>

          <FormField htmlFor="address_line" label="Address" error={errors.address_line} required className="md:col-span-2">
            <Input
              id="address_line"
              type="text"
              invalid={!!errors.address_line}
              value={form.address_line}
              onChange={(e) => setField('address_line')(e.target.value)}
              autoComplete="street-address"
            />
          </FormField>

          <FormField htmlFor="city" label="City" error={errors.city} required>
            <Input
              id="city"
              type="text"
              invalid={!!errors.city}
              value={form.city}
              onChange={(e) => setField('city')(e.target.value)}
              autoComplete="address-level2"
            />
          </FormField>

          <FormField htmlFor="state" label="State" error={errors.state} required>
            <Input
              id="state"
              type="text"
              invalid={!!errors.state}
              value={form.state}
              onChange={(e) => setField('state')(e.target.value)}
              autoComplete="address-level1"
            />
          </FormField>

          <FormField htmlFor="pin_code" label="PIN code" error={errors.pin_code} required>
            <Input
              id="pin_code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              invalid={!!errors.pin_code}
              value={form.pin_code}
              onChange={(e) => setField('pin_code')(e.target.value)}
              autoComplete="postal-code"
            />
          </FormField>

          <FormField htmlFor="location_label" label="Location label" error={errors.location_label} hint="Optional, e.g. Back gate receiving door">
            <Input
              id="location_label"
              type="text"
              invalid={!!errors.location_label}
              value={form.location_label}
              onChange={(e) => setField('location_label')(e.target.value)}
            />
          </FormField>

          <FormField htmlFor="latitude" label="Latitude" error={errors.latitude} hint="Optional, e.g. 12.9716">
            <Input
              id="latitude"
              type="text"
              inputMode="decimal"
              invalid={!!errors.latitude}
              value={form.latitude}
              onChange={(e) => setField('latitude')(e.target.value)}
            />
          </FormField>

          <FormField htmlFor="longitude" label="Longitude" error={errors.longitude} hint="Optional, e.g. 77.5946">
            <Input
              id="longitude"
              type="text"
              inputMode="decimal"
              invalid={!!errors.longitude}
              value={form.longitude}
              onChange={(e) => setField('longitude')(e.target.value)}
            />
          </FormField>
        </Card>

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
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
