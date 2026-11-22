import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import AppShell from '../../components/AppShell';
import { useAppState } from '../../lib/AppStateContext';
import * as actions from '../../lib/actions';
import * as impact from '../../lib/impact';

const inrFormat = new Intl.NumberFormat('en-IN');

function formatInr(value: number): string {
  return `INR ${inrFormat.format(Math.round(value))}`;
}

function formatKg(value: number): string {
  return `${value.toFixed(1)} kg`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const CHART_COLOURS = ['#1d4ed8', '#0f766e', '#b45309'];

export default function SponsorDashboardPage() {
  const { state, setState, currentUser } = useAppState();
  const sponsorId = currentUser?.id ?? '';
  const sponsorName = currentUser?.name ?? 'Sponsor';

  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const programme = useMemo(
    () => state.sponsorPrograms.find((p) => p.sponsorId === sponsorId),
    [state.sponsorPrograms, sponsorId],
  );

  const disbursedInr = useMemo(
    () =>
      state.funding
        .filter((f) => f.sponsorId === sponsorId)
        .reduce((sum, f) => sum + f.amountInr, 0),
    [state.funding, sponsorId],
  );

  const allocatedInr = programme ? programme.fundingAllocationInr : 0;
  const remainingInr = allocatedInr - disbursedInr;

  const verified = useMemo(() => {
    const collectedKg = impact.collectedKg(state.claims);
    const distributedKg = impact.distributedKg(state.claims);
    const activeDonorIds = new Set(
      state.donations.filter((d) => d.status === 'completed').map((d) => d.donorId),
    );
    const activeReceiverIds = new Set(
      state.claims.filter((c) => c.collectedKg > 0).map((c) => c.receiverId),
    );
    return {
      collectedKg,
      distributedKg,
      mealsSaved: impact.mealsSaved(distributedKg),
      emissionsKg: impact.estimatedEmissionsAvoidedKg(distributedKg),
      activeDonors: activeDonorIds.size,
      activeReceivers: activeReceiverIds.size,
    };
  }, [state.donations, state.claims]);

  const contributors = useMemo(() => {
    const donorRows = state.users
      .filter((u) => u.role === 'donor')
      .map((u) => {
        const own = state.donations.filter((d) => d.donorId === u.id);
        const allAnonymous = own.length > 0 && own.every((d) => d.anonymousDonor);
        const kg = impact.collectedKg(state.claims.filter((c) => own.some((d) => d.id === c.donationId)));
        return {
          id: u.id,
          label: allAnonymous ? 'Anonymous donor' : u.name,
          kg,
        };
      })
      .filter((row) => row.kg > 0);

    const receiverRows = state.users
      .filter((u) => u.role === 'receiver')
      .map((u) => {
        const kg = impact.collectedKg(state.claims.filter((c) => c.receiverId === u.id));
        return {
          id: u.id,
          label: u.anonymousPublic ? 'Anonymous receiver' : u.name,
          kg,
        };
      })
      .filter((row) => row.kg > 0);

    return { donorRows, receiverRows };
  }, [state.users, state.donations, state.claims]);

  const chartData = [
    { name: 'Allocated', value: allocatedInr },
    { name: 'Disbursed', value: disbursedInr },
    { name: 'Remaining', value: remainingInr },
  ];

  function buildReportRows(): string[][] {
    return [
      ['Metric', 'Value'],
      ['Sponsor', sponsorName],
      ['Allocated (INR)', String(Math.round(allocatedInr))],
      ['Disbursed (INR)', String(Math.round(disbursedInr))],
      ['Remaining (INR)', String(Math.round(remainingInr))],
      ['Collected (kg)', verified.collectedKg.toFixed(1)],
      ['Distributed (kg)', verified.distributedKg.toFixed(1)],
      ['Meals saved', String(verified.mealsSaved)],
      ['Estimated emissions avoided (kg CO2e) - Estimate, not a measured reduction', verified.emissionsKg.toFixed(1)],
      ['Active donors', String(verified.activeDonors)],
      ['Active receivers', String(verified.activeReceivers)],
    ];
  }

  function handleDownloadCsv() {
    const csv = buildReportRows()
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'resqmeal-sponsor-report.csv';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function handleSaveAsPdf() {
    const win = window.open('', '_blank');
    if (!win) {
      setFormError('Pop-up blocked. Allow pop-ups to save the report as PDF.');
      return;
    }
    const rows = buildReportRows()
      .slice(1)
      .map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`)
      .join('');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>ResQMeal sponsor impact report</title>
<style>body{font-family:Arial,sans-serif;color:#111827;padding:24px}table{border-collapse:collapse;width:100%}td{border:1px solid #d1d5db;padding:8px;text-align:left}</style>
</head><body><h1>ResQMeal sponsor impact report</h1><p>Synthetic demo data</p>
<table>${rows}</table>
<p>Environmental figures are estimates, not measured reductions.</p>
</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  function handleFundingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const amount = Number(amountText);
    try {
      setState((s) => actions.addFunding(s, sponsorId, amount, note, new Date()));
      setAmountText('');
      setNote('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not record funding entry.');
    }
  }

  return (
    <AppShell title="Sponsor dashboard">
      <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-6">
        <section className="space-y-2">
          <p className="text-sm text-ink/80">
            Sponsors pay ResQMeal for agreed programme services and impact reporting. Food donations are free; no payments exist between donors and receivers.
          </p>
          <p className="text-sm text-ink/70">Environmental figures are estimates, not measured reductions.</p>
        </section>

        {!programme ? (
          <section className="rounded-lg border border-dashed border-primary-300 bg-offwhite p-8 text-center">
            <h2 className="text-lg font-semibold text-ink">No sponsor programme yet</h2>
            <p className="mt-2 text-sm text-ink/70">
              There is no programme linked to this sponsor account. Once one is assigned, its funding and impact figures appear here.
            </p>
          </section>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-offwhite p-4 shadow-sm">
                <p className="text-sm text-ink/70">Allocated</p>
                <p className="text-2xl font-semibold text-primary-700">{formatInr(allocatedInr)}</p>
              </div>
              <div className="rounded-lg bg-offwhite p-4 shadow-sm">
                <p className="text-sm text-ink/70">Disbursed</p>
                <p className="text-2xl font-semibold text-primary-700">{formatInr(disbursedInr)}</p>
              </div>
              <div className="rounded-lg bg-offwhite p-4 shadow-sm">
                <p className="text-sm text-ink/70">Remaining</p>
                <p className="text-2xl font-semibold text-primary-700">{formatInr(remainingInr)}</p>
              </div>
            </section>

            <section className="rounded-lg bg-offwhite p-4 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-ink">Funding overview</h2>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(v) => inrFormat.format(Number(v))} />
                    <Tooltip formatter={(v) => formatInr(Number(v))} />
                    <Bar dataKey="value">
                      {chartData.map((entry, index) => (
                        <Cell key={entry.name} fill={CHART_COLOURS[index % CHART_COLOURS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </>
        )}

        <section className="rounded-lg bg-offwhite p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-ink">Verified impact</h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-sm text-ink/70">Collected</dt>
              <dd className="text-xl font-semibold text-ink">{formatKg(verified.collectedKg)}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink/70">Distributed</dt>
              <dd className="text-xl font-semibold text-ink">{formatKg(verified.distributedKg)}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink/70">Meals saved</dt>
              <dd className="text-xl font-semibold text-ink">{inrFormat.format(verified.mealsSaved)}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink/70">Estimated emissions avoided (Estimate, not a measured reduction)</dt>
              <dd className="text-xl font-semibold text-ink">{formatKg(verified.emissionsKg)} CO2e</dd>
            </div>
            <div>
              <dt className="text-sm text-ink/70">Active donors</dt>
              <dd className="text-xl font-semibold text-ink">{verified.activeDonors}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink/70">Active receivers</dt>
              <dd className="text-xl font-semibold text-ink">{verified.activeReceivers}</dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-offwhite hover:bg-primary-800"
            >
              Download monthly impact report (CSV)
            </button>
            <button
              type="button"
              onClick={handleSaveAsPdf}
              className="rounded-md border border-primary-700 px-4 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50"
            >
              Save as PDF
            </button>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg bg-offwhite p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-ink">Donor contributors</h2>
            {contributors.donorRows.length === 0 ? (
              <p className="text-sm text-ink/70">No verified donor contributions yet.</p>
            ) : (
              <ul className="divide-y divide-primary-100">
                {contributors.donorRows.map((row) => (
                  <li key={row.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-ink">{row.label}</span>
                    <span className="font-medium text-ink">{formatKg(row.kg)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-lg bg-offwhite p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-ink">Receiver contributors</h2>
            {contributors.receiverRows.length === 0 ? (
              <p className="text-sm text-ink/70">No verified receiver collections yet.</p>
            ) : (
              <ul className="divide-y divide-primary-100">
                {contributors.receiverRows.map((row) => (
                  <li key={row.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-ink">{row.label}</span>
                    <span className="font-medium text-ink">{formatKg(row.kg)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="rounded-lg bg-offwhite p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-ink">Record a funding entry</h2>
          <form onSubmit={handleFundingSubmit} className="grid gap-4 sm:grid-cols-3 sm:items-end">
            <label className="flex flex-col gap-1 text-sm text-ink">
              Amount (INR)
              <input
                type="number"
                min="0"
                step="1"
                required
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                className="rounded-md border border-primary-200 bg-white px-3 py-2 text-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink">
              Note
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="rounded-md border border-primary-200 bg-white px-3 py-2 text-ink"
              />
            </label>
            <button
              type="submit"
              className="rounded-md bg-primary-700 px-4 py-2 text-sm font-medium text-offwhite hover:bg-primary-800"
            >
              Record entry
            </button>
            {formError ? (
              <p role="alert" className="text-sm text-red-700 sm:col-span-3">
                {formError}
              </p>
            ) : null}
          </form>
        </section>
      </div>
    </AppShell>
  );
}
