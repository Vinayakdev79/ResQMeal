import { useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { createDonation, type NewDonationInput } from '../../lib/donorApi';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { Input, Select, Textarea } from '../../components/ui/Input';
import AppShell from '../../components/AppShell';

const CATEGORY_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'cooked_meals', label: 'Cooked meals' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'fruits_vegetables', label: 'Fruits and vegetables' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'packaged_food', label: 'Packaged food' },
  { value: 'beverages', label: 'Beverages' },
  { value: 'other', label: 'Other' },
];

const DIETARY_OPTIONS: readonly { value: 'vegetarian' | 'non_vegetarian'; label: string }[] = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'non_vegetarian', label: 'Non-vegetarian' },
];

const UNIT_OPTIONS: readonly string[] = ['kg', 'plates', 'packets', 'boxes', 'litres', 'pieces'];

const PRIMARY_LINK =
  'inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-forest-700 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-forest-800';
const SECONDARY_LINK =
  'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-forest-700 shadow-sm transition-colors hover:bg-forest-50';

interface FormValues {
  title: string;
  category: string;
  description: string;
  quantity: string;
  unit: string;
  estimatedPeople: string;
  preparedAt: string;
  expiresAt: string;
  pickupWindowStart: string;
  pickupWindowEnd: string;
  pickupAddress: string;
  city: string;
  state: string;
  pincode: string;
  latitude: string;
  longitude: string;
  dietary: '' | 'vegetarian' | 'non_vegetarian';
  specialInstructions: string;
  allocationMode: 'single' | 'multiple';
}

const EMPTY_FORM: FormValues = {
  title: '',
  category: 'cooked_meals',
  description: '',
  quantity: '',
  unit: 'kg',
  estimatedPeople: '',
  preparedAt: '',
  expiresAt: '',
  pickupWindowStart: '',
  pickupWindowEnd: '',
  pickupAddress: '',
  city: '',
  state: '',
  pincode: '',
  latitude: '',
  longitude: '',
  dietary: '',
  specialInstructions: '',
  allocationMode: 'single',
};

type TextFieldKey = Exclude<keyof FormValues, 'dietary' | 'allocationMode'>;
type FieldErrors = Partial<Record<keyof FormValues, string>>;

/** Parses a datetime-local value; null when blank or invalid. */
function parseDate(value: string): Date | null {
  if (value.trim() === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Converts a datetime-local value to ISO. Only call after validation has passed. */
function toIso(value: string): string {
  return new Date(value).toISOString();
}

/**
 * Parses an optional decimal coordinate.
 * Returns null when blank, the number when valid, and undefined when present but invalid or out of range.
 */
function parseCoordinate(raw: string, min: number, max: number): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

function validate(values: FormValues, now: Date): FieldErrors {
  const errors: FieldErrors = {};

  if (values.title.trim() === '') errors.title = 'Enter the food name.';
  if (values.description.trim() === '') errors.description = 'Describe the food.';
  if (values.dietary === '') errors.dietary = 'Select Vegetarian or Non-vegetarian.';

  const quantity = Number(values.quantity);
  if (values.quantity.trim() === '' || !Number.isFinite(quantity) || quantity <= 0) {
    errors.quantity = 'Enter a quantity greater than 0.';
  }

  const people = Number(values.estimatedPeople);
  if (!/^\d+$/.test(values.estimatedPeople.trim()) || people <= 0) {
    errors.estimatedPeople = 'Enter a whole number of people greater than 0.';
  }

  const prepared = parseDate(values.preparedAt);
  if (values.preparedAt.trim() !== '' && prepared === null) {
    errors.preparedAt = 'Enter a valid date and time.';
  } else if (prepared !== null && prepared.getTime() >= now.getTime()) {
    errors.preparedAt = 'Prepared time must be in the past.';
  }

  const expires = parseDate(values.expiresAt);
  if (expires === null) {
    errors.expiresAt = 'Enter a valid expiry date and time.';
  } else if (expires.getTime() <= now.getTime()) {
    errors.expiresAt = 'Expiry must be in the future.';
  }

  const start = parseDate(values.pickupWindowStart);
  const end = parseDate(values.pickupWindowEnd);
  if (start === null) {
    errors.pickupWindowStart = 'Enter a valid pickup start time.';
  }
  if (end === null) {
    errors.pickupWindowEnd = 'Enter a valid pickup end time.';
  } else if (start !== null && end.getTime() <= start.getTime()) {
    errors.pickupWindowEnd = 'Pickup end must be after pickup start.';
  } else if (expires !== null && end.getTime() > expires.getTime()) {
    errors.pickupWindowEnd = 'Pickup must end before the food expires.';
  }

  if (values.pickupAddress.trim() === '') errors.pickupAddress = 'Enter the pickup address.';
  if (values.city.trim() === '') errors.city = 'Enter the city.';
  if (values.state.trim() === '') errors.state = 'Enter the state.';
  if (!/^\d{6}$/.test(values.pincode.trim())) errors.pincode = 'Enter a 6-digit PIN code.';

  if (parseCoordinate(values.latitude, -90, 90) === undefined) {
    errors.latitude = 'Latitude must be a number between -90 and 90, or left blank.';
  }
  if (parseCoordinate(values.longitude, -180, 180) === undefined) {
    errors.longitude = 'Longitude must be a number between -180 and 180, or left blank.';
  }

  return errors;
}

function withoutError(prev: FieldErrors, key: keyof FormValues): FieldErrors {
  const next = { ...prev };
  delete next[key];
  return next;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message !== '' ? err.message : fallback;
}

function FormSection({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="space-y-5 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest-100 text-xs font-bold text-forest-800">
          {step}
        </span>
        <div>
          <h2 className="font-sans text-base font-semibold text-charcoal">{title}</h2>
          <p className="text-sm text-muted">{description}</p>
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

export default function PostFoodPage() {
  const { user } = useAuth();
  const userId = user?.id;

  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [posted, setPosted] = useState(false);
  const submittingRef = useRef(false);

  const errorList = Object.values(errors).filter((message): message is string => typeof message === 'string');

  function setField(key: TextFieldKey) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setValues((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => withoutError(prev, key));
    };
  }

  function setDietary(event: ChangeEvent<HTMLSelectElement>): void {
    const raw = event.target.value;
    const dietary: FormValues['dietary'] = raw === 'vegetarian' || raw === 'non_vegetarian' ? raw : '';
    setValues((prev) => ({ ...prev, dietary }));
    setErrors((prev) => withoutError(prev, 'dietary'));
  }

  function setAllocation(event: ChangeEvent<HTMLSelectElement>): void {
    const mode = event.target.value === 'multiple' ? 'multiple' : 'single';
    setValues((prev) => ({ ...prev, allocationMode: mode }));
  }

  function resetForm(): void {
    setValues(EMPTY_FORM);
    setErrors({});
    setFormError(null);
    setPosted(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submittingRef.current) return;
    setFormError(null);

    const fieldErrors = validate(values, new Date());
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    if (userId === undefined) {
      setFormError('You need to be signed in to post a donation.');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const input: NewDonationInput = {
        title: values.title.trim(),
        category: values.category,
        description: values.description.trim(),
        quantity: Number(values.quantity),
        unit: values.unit,
        estimated_people: Number(values.estimatedPeople),
        prepared_at: parseDate(values.preparedAt) === null ? null : toIso(values.preparedAt),
        expires_at: toIso(values.expiresAt),
        pickup_window_start: toIso(values.pickupWindowStart),
        pickup_window_end: toIso(values.pickupWindowEnd),
        pickup_address: values.pickupAddress.trim(),
        pickup_city: values.city.trim(),
        pickup_state: values.state.trim(),
        pickup_pin_code: values.pincode.trim(),
        latitude: parseCoordinate(values.latitude, -90, 90) ?? null,
        longitude: parseCoordinate(values.longitude, -180, 180) ?? null,
        image_url: null,
        is_vegetarian: values.dietary === 'vegetarian',
        special_instructions: values.specialInstructions.trim() === '' ? null : values.specialInstructions.trim(),
        allocation_mode: values.allocationMode,
      };

      await createDonation(userId, input);
      setPosted(true);
    } catch (err) {
      setFormError(errorMessage(err, 'The donation could not be posted. Please try again.'));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (posted) {
    return (
    <AppShell title="Post donation">
      <section
        role="status"
        className="mx-auto max-w-xl rounded-2xl border border-line bg-surface p-6 text-center shadow-sm"
      >
        <CheckCircle2 className="mx-auto h-10 w-10 text-forest-700" aria-hidden="true" />
        <h2 className="mt-3 text-lg font-semibold text-charcoal">Donation posted</h2>
        <p className="mt-1 text-sm text-muted">Your food is now listed so receivers can claim it.</p>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/donor" className={PRIMARY_LINK}>
            Go to dashboard
          </Link>
          <Link to="/donor/donations" className={SECONDARY_LINK}>
            View my donations
          </Link>
          <Link to="/donor/post" onClick={resetForm} className={SECONDARY_LINK}>
            Post another
          </Link>
        </div>
      </section>
    </AppShell>
    );
  }

  return (
    <AppShell title="Post donation">
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-charcoal">Post surplus food</h1>
        <p className="mt-1 text-sm text-muted">
          Share food that would otherwise go to waste. Fields marked <span className="text-danger-700">*</span> are
          required.
        </p>
      </header>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <FormSection step={1} title="What" description="Describe the food you are offering.">
          <FormField label="Food name" htmlFor="title" required error={errors.title} hint="A short, clear name." className="sm:col-span-2">
            <Input
              id="title"
              type="text"
              placeholder="e.g. Vegetable biryani"
              value={values.title}
              onChange={setField('title')}
              invalid={errors.title !== undefined}
            />
          </FormField>

          <FormField
            label="Description"
            htmlFor="description"
            required
            error={errors.description}
            hint="Ingredients, portion size or packaging details."
            className="sm:col-span-2"
          >
            <Textarea
              id="description"
              rows={3}
              placeholder="e.g. Freshly cooked, 4 trays of 5 portions, contains nuts"
              value={values.description}
              onChange={setField('description')}
              invalid={errors.description !== undefined}
            />
          </FormField>

          <FormField label="Category" htmlFor="category" error={errors.category}>
            <Select id="category" value={values.category} onChange={setField('category')} invalid={errors.category !== undefined}>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Dietary type" htmlFor="dietary" required error={errors.dietary}>
            <Select id="dietary" value={values.dietary} onChange={setDietary} invalid={errors.dietary !== undefined}>
              <option value="">Select dietary type</option>
              {DIETARY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Quantity" htmlFor="quantity" required error={errors.quantity} hint="Total amount on offer.">
            <Input
              id="quantity"
              type="number"
              min="0"
              step="any"
              placeholder="e.g. 5"
              value={values.quantity}
              onChange={setField('quantity')}
              invalid={errors.quantity !== undefined}
            />
          </FormField>

          <FormField label="Unit" htmlFor="unit" error={errors.unit}>
            <Select id="unit" value={values.unit} onChange={setField('unit')} invalid={errors.unit !== undefined}>
              {UNIT_OPTIONS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit.charAt(0).toUpperCase() + unit.slice(1)}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="People it can feed"
            htmlFor="estimatedPeople"
            required
            error={errors.estimatedPeople}
            hint="Approximate number of people this food can serve."
          >
            <Input
              id="estimatedPeople"
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 20"
              value={values.estimatedPeople}
              onChange={setField('estimatedPeople')}
              invalid={errors.estimatedPeople !== undefined}
            />
          </FormField>

          <FormField label="Sharing" htmlFor="allocationMode" hint="Whether one or several receivers can claim this listing.">
            <Select id="allocationMode" value={values.allocationMode} onChange={setAllocation}>
              <option value="single">One receiver claims the whole donation</option>
              <option value="multiple">Multiple receivers may claim</option>
            </Select>
          </FormField>
        </FormSection>

        <FormSection step={2} title="When" description="Set the freshness limit and the pickup window.">
          <FormField
            label="Safe to eat until"
            htmlFor="expiresAt"
            required
            error={errors.expiresAt}
            hint="Listings are hidden from receivers after this time."
          >
            <Input
              id="expiresAt"
              type="datetime-local"
              value={values.expiresAt}
              onChange={setField('expiresAt')}
              invalid={errors.expiresAt !== undefined}
            />
          </FormField>

          <FormField
            label="Food prepared at (optional)"
            htmlFor="preparedAt"
            error={errors.preparedAt}
            hint="Leave blank if you do not know."
          >
            <Input
              id="preparedAt"
              type="datetime-local"
              value={values.preparedAt}
              onChange={setField('preparedAt')}
              invalid={errors.preparedAt !== undefined}
            />
          </FormField>

          <FormField
            label="Pickup window start"
            htmlFor="pickupWindowStart"
            required
            error={errors.pickupWindowStart}
            hint="Earliest time a receiver can collect."
          >
            <Input
              id="pickupWindowStart"
              type="datetime-local"
              value={values.pickupWindowStart}
              onChange={setField('pickupWindowStart')}
              invalid={errors.pickupWindowStart !== undefined}
            />
          </FormField>

          <FormField
            label="Pickup window end"
            htmlFor="pickupWindowEnd"
            required
            error={errors.pickupWindowEnd}
            hint="Must be after the start and before expiry."
          >
            <Input
              id="pickupWindowEnd"
              type="datetime-local"
              value={values.pickupWindowEnd}
              onChange={setField('pickupWindowEnd')}
              invalid={errors.pickupWindowEnd !== undefined}
            />
          </FormField>
        </FormSection>

        <FormSection step={3} title="Where" description="Where receivers should collect the food.">
          <FormField label="Pickup address" htmlFor="pickupAddress" required error={errors.pickupAddress} className="sm:col-span-2">
            <Textarea
              id="pickupAddress"
              rows={2}
              placeholder="House or building, street, area"
              value={values.pickupAddress}
              onChange={setField('pickupAddress')}
              invalid={errors.pickupAddress !== undefined}
            />
          </FormField>

          <FormField label="City" htmlFor="city" required error={errors.city}>
            <Input
              id="city"
              type="text"
              placeholder="e.g. Bengaluru"
              value={values.city}
              onChange={setField('city')}
              invalid={errors.city !== undefined}
            />
          </FormField>

          <FormField label="State" htmlFor="state" required error={errors.state}>
            <Input
              id="state"
              type="text"
              placeholder="e.g. Karnataka"
              value={values.state}
              onChange={setField('state')}
              invalid={errors.state !== undefined}
            />
          </FormField>

          <FormField label="PIN code" htmlFor="pincode" required error={errors.pincode} hint="6 digits.">
            <Input
              id="pincode"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="e.g. 560001"
              value={values.pincode}
              onChange={setField('pincode')}
              invalid={errors.pincode !== undefined}
            />
          </FormField>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Latitude (optional)" htmlFor="latitude" error={errors.latitude} hint="Helps receivers find nearby food.">
              <Input
                id="latitude"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 12.9716"
                value={values.latitude}
                onChange={setField('latitude')}
                invalid={errors.latitude !== undefined}
              />
            </FormField>
            <FormField label="Longitude (optional)" htmlFor="longitude" error={errors.longitude}>
              <Input
                id="longitude"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 77.5946"
                value={values.longitude}
                onChange={setField('longitude')}
                invalid={errors.longitude !== undefined}
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection step={4} title="Notes" description="Anything else receivers should know.">
          <FormField
            label="Notes for receivers (optional)"
            htmlFor="specialInstructions"
            hint="Handling, storage or access instructions."
            className="sm:col-span-2"
          >
            <Textarea
              id="specialInstructions"
              rows={2}
              placeholder="e.g. Keep refrigerated. Ring the bell at the gate."
              value={values.specialInstructions}
              onChange={setField('specialInstructions')}
            />
          </FormField>
        </FormSection>

        {errorList.length > 0 && (
          <div role="alert" className="flex gap-3 rounded-xl border border-danger-500 bg-danger-100 p-4 text-sm text-danger-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">Please fix the following before posting:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {errorList.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {formError !== null && (
          <p role="alert" className="flex gap-3 rounded-xl border border-danger-500 bg-danger-100 p-4 text-sm text-danger-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{formError}</span>
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted">Your listing appears on the dashboard as soon as it is posted.</p>
          <Button type="submit" size="lg" loading={submitting} disabled={submitting} className="w-full sm:w-auto">
            {submitting ? 'Posting…' : 'Post Food'}
          </Button>
        </div>
      </form>
    </div>
    </AppShell>
  );
}
