'use client';
import { useState } from 'react';
import { FcPanel } from '@/components/fc/fc-ui';
import { prepareTournamentReportDownload } from '@/lib/tournament-report';

export function TeamListExport({ tournamentId, approvedCount }: { tournamentId: string; approvedCount: number }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [download, setDownload] = useState<Awaited<ReturnType<typeof prepareTournamentReportDownload>> | null>(null);
  async function prepare(format: 'pdf' | 'png') {
    if (busy) return;
    setBusy(format); setError(''); setDownload(null);
    try { setDownload(await prepareTournamentReportDownload(tournamentId, format, 'teams')); }
    catch (error) { setError(error instanceof Error ? error.message : 'The team list could not be prepared. Try again.'); }
    finally { setBusy(''); }
  }
  return <div data-refresh-lock={busy ? 'true' : undefined}><FcPanel className="p-4 md:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-black">Export team list</h2><p className="mt-1 text-xs leading-5 text-slate-500">All approved teams, groups and linked players. Available before the tournament ends.</p></div>
      <div className="flex flex-wrap gap-2">{(['pdf', 'png'] as const).map(format => <button key={format} type="button" disabled={Boolean(busy) || !approvedCount} onClick={() => void prepare(format)} className="min-h-11 rounded-xl border border-white/10 px-4 text-sm font-bold disabled:opacity-50">{busy === format ? 'Preparing…' : `Export ${format.toUpperCase()}`}</button>)}</div>
    </div>
    {!approvedCount ? <p className="mt-2 text-xs text-slate-500">Approve or add teams to enable export.</p> : null}
    {busy ? <p className="mt-3 text-sm" role="status">Preparing the complete approved roster…</p> : null}
    {error ? <p className="mt-3 text-sm text-red-400" role="alert">{error}</p> : null}
    {download ? <div className="mt-3" role="status"><a className="inline-flex min-h-11 items-center rounded-xl bg-sky-300 px-4 text-sm font-bold text-slate-950" href={download.url} download={download.filename} rel="noreferrer">Download {download.filename.endsWith('.pdf') ? 'PDF' : 'PNG'} ↓</a><p className="mt-2 text-xs text-slate-500">Snapshot ready. Download within 5 minutes. Export again after changing teams or approvals.</p></div> : null}
  </FcPanel></div>;
}
