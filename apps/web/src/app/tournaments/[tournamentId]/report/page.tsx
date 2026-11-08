'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { AppShell } from '@/components/app/app-shell';
import { BackHeader } from '@/components/app/back-header';
import { FcEmptyState, FcErrorState, FcLoadingScreen, FcNotice } from '@/components/fc/fc-ui';
import { TournamentNavigation } from '@/components/tournaments/tournament-navigation';
import { TournamentReportView } from '@/components/tournaments/tournament-report-view';
import { authenticatedRequest, getCurrentUser, type CurrentUser } from '@/lib/auth-client';
import { useRouteLeague } from '@/lib/active-league';
import { useRecoverableLoad } from '@/lib/use-recoverable-load';
import { prepareTournamentReportDownload, type TournamentReport } from '@/lib/tournament-report';

interface Meta { id: string; name: string; status: string; leagueId: string }
export default function TournamentReportPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [record, setRecord] = useState<{ scope: string; tournament: Meta; report: TournamentReport | null } | null>(null);
  const [exporting, setExporting] = useState<'pdf' | 'png' | null>(null);
  const [error, setError] = useState('');
  const [download, setDownload] = useState<{ url: string; filename: string } | null>(null);
  const current = record?.scope === tournamentId ? record : null;
  useRouteLeague(user?.id, current?.tournament.leagueId);
  const load = useRecoverableLoad(async signal => {
    const [identity, response] = await Promise.all([getCurrentUser({ signal }), authenticatedRequest<{ data: { tournament: Meta } }>(`/tournaments/${tournamentId}`, { signal })]);
    const tournament = response.data.tournament;
    const result = tournament.status === 'COMPLETED' ? await authenticatedRequest<{ data: { report: TournamentReport } }>(`/tournaments/${tournamentId}/report`, { signal }) : null;
    if (!signal.aborted) { setUser(identity); setRecord({ scope: tournamentId, tournament, report: result?.data.report ?? null }); }
  }, tournamentId);

  async function exportReport(format: 'pdf' | 'png') {
    if (exporting) return;
    setExporting(format); setError(''); setDownload(null);
    try {
      const file = await prepareTournamentReportDownload(tournamentId, format);
      // Explicit HTTPS download also works with the installed Android wrapper.
      setDownload(file);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The report could not be exported. Please retry.'); }
    finally { setExporting(null); }
  }
  if (load.error) return <AppShell currentUser={user ?? undefined}><FcErrorState message={load.error} onRetry={load.retry} /></AppShell>;
  if (!user || !current) return <AppShell currentUser={user ?? undefined}><FcLoadingScreen label="Preparing tournament report…" embedded /></AppShell>;
  return <AppShell currentUser={user} playerName={user.player?.identity?.inGameName}>
    <div className="space-y-5" data-refresh-lock={exporting ? 'true' : undefined}>
      <BackHeader backHref={`/tournaments/${tournamentId}`} backLabel="Tournament Overview" eyebrow="Competition archive" title="Tournament Report" subtitle="The complete story of your competition, ready to keep and share." />
      <TournamentNavigation tournamentId={tournamentId} />
      {current.report ? <>
        <section className="theme-panel flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4 sm:p-5" aria-label="Export tournament report">
          <div><h2 className="theme-text text-sm font-bold">Keep the full report</h2><p className="theme-muted mt-1 text-xs leading-6">PDF includes the complete report. PNG is a shareable cover.</p></div>
          <div className="flex flex-wrap gap-2"><button type="button" disabled={Boolean(exporting)} onClick={() => void exportReport('pdf')} className="theme-primary-button min-h-11 rounded-xl px-4 text-sm font-bold disabled:opacity-50">{exporting === 'pdf' ? 'Preparing PDF…' : 'Export full PDF'}</button><button type="button" disabled={Boolean(exporting)} onClick={() => void exportReport('png')} className="theme-secondary-button min-h-11 rounded-xl border px-4 text-sm font-bold disabled:opacity-50">{exporting === 'png' ? 'Preparing image…' : 'Export cover PNG'}</button></div>
        </section>
        <FcNotice tone="error">{error}</FcNotice>
        {load.refreshError ? <FcNotice tone="error">Report could not refresh. Your loaded report is kept.</FcNotice> : null}
        {download ? <section className="theme-panel flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4" aria-label="Report download ready"><p className="theme-text text-sm font-semibold">Your report is ready.</p><a href={download.url} download={download.filename} rel="noopener noreferrer" className="theme-primary-button inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-bold">Download {download.filename.endsWith('.pdf') ? 'PDF' : 'PNG'}</a><p className="theme-muted w-full text-xs">This download link expires shortly. You can export again whenever you need it.</p></section> : null}
        <TournamentReportView report={current.report} />
      </> : <FcEmptyState title="Full report unlocks on completion" description="Complete the tournament and verify its required results to create the final competition report." actionLabel="Open Tournament" actionHref={`/tournaments/${tournamentId}`} />}
      <Link href={`/tournaments/${tournamentId}/summary`} className="theme-text-link inline-flex min-h-11 items-center text-sm font-semibold">View tournament summary →</Link>
    </div>
  </AppShell>;
}
