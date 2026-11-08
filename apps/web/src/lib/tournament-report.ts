import { authenticatedRequest } from './auth-client';
export type { TournamentReport, ReportEntry, ReportMatch, ReportPlayer, ReportStanding } from '../../../api/src/tournaments/tournament-report.types';

export async function prepareTournamentReportDownload(tournamentId: string, format: 'pdf' | 'png', kind: 'full' | 'teams' = 'full') {
  const { data } = await authenticatedRequest<{ data: { path: string; filename: string; expiresAt: string } }>(`/tournaments/${encodeURIComponent(tournamentId)}/report/exports`, {
    method: 'POST', body: JSON.stringify({ format, kind }),
  });
  if (!/^\/tournament-report-exports\/[0-9a-f-]{36}\?grant=[\w.-]+$/.test(data.path) ||
    !Number.isFinite(Date.parse(data.expiresAt)) || !/^[a-zA-Z0-9][a-zA-Z0-9._-]+\.(pdf|png)$/.test(data.filename)) throw new Error('The report download could not be prepared. Please try again.');
  const production = window.location.hostname === 'fcarena.in' || window.location.hostname.endsWith('.fcarena.in');
  const origin = production ? 'https://api.fcarena.in' : window.location.origin;
  return { ...data, url: new URL('/api' + data.path, origin).toString() };
}

export function reportDate(value: string | null | undefined, withTime = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Not recorded';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', ...(withTime ? { timeStyle: 'short' as const } : {}), timeZone: 'UTC' }).format(new Date(value)) + (withTime ? ' UTC' : '');
}

export function reportLabel(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
}
