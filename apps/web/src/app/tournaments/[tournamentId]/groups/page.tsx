'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from '@/components/app/app-shell';
import { BackHeader } from '@/components/app/back-header';
import { confirmAction } from '@/components/fc/confirmation-provider';
import { FcCrest, FcEmptyState, FcErrorState, FcLoadingScreen, FcNotice, FcPanel, FcStatusBadge } from '@/components/fc/fc-ui';
import { TournamentNavigation } from '@/components/tournaments/tournament-navigation';
import { useRouteLeague } from '@/lib/active-league';
import { ApiError } from '@/lib/api';
import { authenticatedRequest, getCurrentUser, type CurrentUser } from '@/lib/auth-client';
import { balanceGroupMembership, createGroupId, groupDraftKey, groupDraftProblem, type GroupChangePreview, type GroupDraft, type GroupEditInput, type GroupEditorEntry, type GroupEditorState } from '@/lib/group-editor';
import { useRecoverableLoad } from '@/lib/use-recoverable-load';

type RecordState = { scope: string; editor: GroupEditorState; draft: GroupDraft };
const toDraft = (editor: GroupEditorState): GroupDraft => ({ groups: editor.groups.map(group => ({ id: group.id, name: group.name, registrationIds: group.entries.map(entry => entry.id) })), unassignedIds: editor.unassigned.map(entry => entry.id) });
const actionClass = 'theme-secondary-button inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50';

export default function TournamentGroupsPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [record, setRecord] = useState<RecordState | null>(null);
  const [busy, setBusy] = useState<'preview' | 'apply' | null>(null);
  const [review, setReview] = useState<{ input: GroupEditInput; preview: GroupChangePreview } | null>(null);
  const [query, setQuery] = useState('');
  const [swapFirst, setSwapFirst] = useState('');
  const [swapSecond, setSwapSecond] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [remoteChanged, setRemoteChanged] = useState(false);
  const latest = useRef<RecordState | null>(null), dirtyRef = useRef(false), busyRef = useRef(false);
  const current = record?.scope === tournamentId ? record : null;
  const editor = current?.editor;
  const dirty = Boolean(current && groupDraftKey(current.draft) !== groupDraftKey(toDraft(current.editor)));
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  useRouteLeague(user?.id, editor?.tournament.leagueId);

  function accept(next: GroupEditorState) {
    const value = { scope: tournamentId, editor: next, draft: toDraft(next) };
    latest.current = value; dirtyRef.current = false;
    setRecord(value); setReview(null); setRemoteChanged(false);
  }
  const load = useRecoverableLoad(async signal => {
    const [identity, response] = await Promise.all([getCurrentUser({ signal }), authenticatedRequest<{ data: { editor: GroupEditorState } }>(`/tournaments/${tournamentId}/groups/editor`, { signal })]);
    if (signal.aborted) return;
    setUser(identity);
    if (latest.current?.scope === tournamentId && (dirtyRef.current || busyRef.current)) {
      if (latest.current.editor.revision !== response.data.editor.revision) setRemoteChanged(true);
      return;
    }
    accept(response.data.editor);
  }, tournamentId);

  const entries = useMemo(() => current ? [...current.editor.groups.flatMap(group => group.entries), ...current.editor.unassigned] : [], [current]);
  const entryMap = useMemo(() => new Map(entries.map(entry => [entry.id, entry])), [entries]);
  const membershipChanged = Boolean(current && groupDraftKey(current.draft, false) !== groupDraftKey(toDraft(current.editor), false));
  const problem = current ? groupDraftProblem(current.draft, entries.map(entry => entry.id), membershipChanged) : null;
  const counts = current?.draft.groups.map(group => group.registrationIds.length) ?? [];
  const complete = Boolean(current && current.draft.groups.length >= 2 && !current.draft.unassignedIds.length && Math.min(...counts) >= 2);
  const balanced = complete && Math.max(...counts) - Math.min(...counts) <= 1;
  const minimumTarget = counts.length ? Math.floor(entries.length / counts.length) : 0;
  const maximumTarget = counts.length ? Math.ceil(entries.length / counts.length) : 0;
  const target = minimumTarget === maximumTarget ? String(minimumTarget) : `${minimumTarget}–${maximumTarget}`;

  function edit(change: (draft: GroupDraft) => GroupDraft) {
    if (!current || busy || !editor?.canManage) return;
    dirtyRef.current = true;
    setReview(null); setError(''); setMessage('');
    setRecord(previous => {
      if (!previous || previous.scope !== tournamentId) return previous;
      const next = { ...previous, draft: change(previous.draft) }; latest.current = next; return next;
    });
  }
  function moveEntry(id: string, destination: string) {
    if (!editor?.canChangeMembership) return;
    edit(draft => ({ groups: draft.groups.map(group => ({ ...group, registrationIds: group.id === destination ? [...group.registrationIds.filter(value => value !== id), id] : group.registrationIds.filter(value => value !== id) })), unassignedIds: destination ? draft.unassignedIds.filter(value => value !== id) : [...draft.unassignedIds.filter(value => value !== id), id] }));
  }
  function addGroup() {
    if (!editor?.canChangeMembership || !current || current.draft.groups.length >= 16) return;
    const names = new Set(current.draft.groups.map(group => group.name.trim().toLocaleLowerCase()));
    const name = Array.from({ length: 16 }, (_, index) => `Group ${String.fromCharCode(65 + index)}`).find(value => !names.has(value.toLocaleLowerCase())) || 'New Group';
    edit(draft => ({ ...draft, groups: [...draft.groups, { id: createGroupId(), name, registrationIds: [] }] }));
  }
  function swapTeams() {
    if (!editor?.canChangeMembership || !swapFirst || !swapSecond || swapFirst === swapSecond) return;
    edit(draft => ({ ...draft, groups: draft.groups.map(group => ({ ...group,
      registrationIds: group.registrationIds.map(id => id === swapFirst ? swapSecond : id === swapSecond ? swapFirst : id) })) }));
    setSwapFirst(''); setSwapSecond('');
  }
  function removeGroup(id: string) {
    if (!editor?.canChangeMembership || !current || current.draft.groups.length <= 2) return;
    edit(draft => ({ groups: draft.groups.filter(group => group.id !== id), unassignedIds: [...draft.unassignedIds, ...(draft.groups.find(group => group.id === id)?.registrationIds ?? [])] }));
  }
  async function discard() {
    if (dirty && !(await confirmAction({ title: 'Discard group draft?', description: 'Your unsaved group names and team moves will be discarded. The saved groups and fixtures will stay as they are.', confirmLabel: 'Discard draft' }))) return;
    if (!current) return;
    accept(current.editor); setError(''); setMessage('');
    await load.reload();
  }
  async function previewChanges() {
    if (!current || busy || !editor?.canManage || !dirty || problem || remoteChanged) return;
    const input: GroupEditInput = { revision: current.editor.revision, groups: current.draft.groups.map(group => ({ ...group, name: group.name.trim() })) };
    setBusy('preview'); busyRef.current = true; setError(''); setMessage('');
    try {
      const response = await authenticatedRequest<{ data: { preview: GroupChangePreview } }>(`/tournaments/${tournamentId}/groups/reorganize/preview`, { method: 'POST', body: JSON.stringify(input) });
      setReview({ input, preview: response.data.preview });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not review these changes. Try again.');
      if (caught instanceof ApiError && ['GROUPS_CHANGED', 'GROUP_EDIT_STALE', 'GROUP_INPUTS_CHANGED', 'GROUP_PLAN_CHANGED'].includes(caught.code)) setRemoteChanged(true);
    } finally { setBusy(null); busyRef.current = false; }
  }
  async function applyChanges() {
    if (!review || busy) return;
    setBusy('apply'); busyRef.current = true; setError('');
    try {
      const response = await authenticatedRequest<{ data: { editor: GroupEditorState; message: string } }>(`/tournaments/${tournamentId}/groups/reorganize`, { method: 'POST', body: JSON.stringify({ ...review.input, planHash: review.preview.planHash }) });
      accept(response.data.editor); setMessage(response.data.message || 'Groups and affected fixtures updated successfully.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Changes could not be applied. Reload the latest groups before retrying.');
      if (caught instanceof ApiError && ['GROUPS_CHANGED', 'GROUP_EDIT_STALE', 'GROUP_INPUTS_CHANGED', 'GROUP_PLAN_CHANGED'].includes(caught.code)) { setReview(null); setRemoteChanged(true); }
    } finally { setBusy(null); busyRef.current = false; }
  }

  function rosterRow(entry: GroupEditorEntry, destination: string) {
    const searchable = [entry.name, ...entry.members.flatMap(member => [member.name, member.playerCode])].join(' ').toLocaleLowerCase();
    if (query.trim() && !searchable.includes(query.trim().toLocaleLowerCase())) return null;
    return <li key={entry.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5">
      <FcCrest name={entry.name} imageUrl={entry.logoUrl} size="sm" />
      <div className="min-w-0 flex-1"><p className="break-words text-sm font-bold">{entry.name}</p><p className="mt-1 break-words text-[11px] leading-4 text-slate-500">{entry.members.map(member => `${member.name}${member.playerCode ? ` · ${member.playerCode}` : ''}`).join(' / ') || 'No linked players recorded'}</p></div>
      {editor?.canManage ? <label className="w-full min-w-0 sm:w-auto"><span className="sr-only">Move {entry.name}</span><select value={destination} disabled={!editor.canChangeMembership || Boolean(busy)} onChange={event => moveEntry(entry.id, event.target.value)} className="theme-input min-h-11 w-full max-w-full rounded-lg border px-2 text-xs sm:max-w-40"><option value="">Unassigned</option>{current?.draft.groups.map(group => <option key={group.id} value={group.id}>{group.name || 'Unnamed group'}</option>)}</select></label> : null}
    </li>;
  }

  if (load.error && !current) return <AppShell currentUser={user ?? undefined}><FcErrorState message={load.error} onRetry={load.retry} /></AppShell>;
  if (!user || !current || !editor) return <AppShell currentUser={user ?? undefined}><FcLoadingScreen label="Loading tournament groups…" embedded /></AppShell>;
  return <AppShell currentUser={user} playerName={user.player?.identity?.inGameName}>
    <div className="space-y-5" data-refresh-lock={dirty || busy || review ? 'true' : undefined}>
      <BackHeader backHref={`/tournaments/${tournamentId}`} backLabel="Tournament Overview" eyebrow={`${editor.tournament.name} · ${editor.tournament.code}`} title="Group Manager" subtitle="Keep groups even and review fixture changes before applying them." action={<FcStatusBadge label={editor.tournament.status} tone={editor.tournament.status === 'ACTIVE' ? 'emerald' : 'amber'} />} />
      <TournamentNavigation tournamentId={tournamentId} />
      <FcNotice>{message}</FcNotice><FcNotice tone="error">{error || load.refreshError}</FcNotice>
      {editor.canManage ? <FcPanel className="p-4 sm:p-5"><h2 className="font-bold">Restart tournament setup</h2><p className="mt-2 text-sm leading-6 text-slate-500">Reset All Groups &amp; Fixtures clears an unplayed draw and keeps your approved teams. If results exist, Start Fresh Draw copies your teams into a new balanced tournament and keeps all original results and history safe.</p><Link href={`/tournaments/${tournamentId}/settings`} className={`${actionClass} mt-3`}>Open reset &amp; fresh draw options</Link></FcPanel> : null}
      <FcPanel className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">{dirty ? 'Draft group sizes' : 'Saved group sizes'}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{entries.length} approved teams · {counts.length} groups · Target {target} teams per group</p><p className="mt-1 text-xs leading-5 text-slate-500">If the total does not divide equally, groups can differ by one team.</p></div><FcStatusBadge label={balanced ? 'Balanced' : 'Needs balancing'} tone={balanced ? 'emerald' : 'amber'} /></div>
        <div className="mt-4 flex flex-wrap gap-2">{current.draft.groups.map(group => <span key={group.id} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${group.registrationIds.length >= minimumTarget && group.registrationIds.length <= maximumTarget && group.registrationIds.length >= 2 ? 'border-emerald-400/25' : 'border-amber-400/40'}`}>{group.name || 'Unnamed group'}: {group.registrationIds.length}</span>)}</div>
        {editor.tournament.hasFixtures ? <p className="mt-4 text-xs leading-6 text-slate-500">Fixtures already exist. You can still edit groups. Review shows exactly which fixtures will be kept, replaced or added; submitted results are protected.</p> : null}
      </FcPanel>
      {editor.membershipReason ? <div className="theme-panel rounded-xl border p-4 text-sm leading-6">{editor.membershipReason}{editor.canManage ? ' Group names can still be edited.' : ''}</div> : null}
      {remoteChanged ? <div className="theme-error-box rounded-xl border p-4 text-sm" role="alert">Group or match data changed while this draft was open. Discard the draft and reload the latest groups before reviewing.<button type="button" onClick={() => void discard()} disabled={Boolean(busy)} className={`${actionClass} mt-3`}>Discard and reload latest</button></div> : null}
      {editor.canManage ? <FcPanel className="p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">{dirty ? 'Unsaved group draft' : 'Edit groups'}</h2><p className="mt-1 text-xs leading-5 text-slate-500">Changes stay in this draft until you review and apply them.</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={Boolean(busy) || !editor.canChangeMembership || current.draft.groups.length < 2} onClick={() => edit(draft => ({ groups: balanceGroupMembership(draft.groups, draft.unassignedIds, editor.protectedEntryIds), unassignedIds: [] }))} className={actionClass}>Auto-balance groups</button><button type="button" disabled={Boolean(busy) || !editor.canChangeMembership || counts.length >= 16} onClick={addGroup} className={actionClass}>Add group</button></div></div>{problem && dirty ? <p role="status" className="mt-3 text-sm leading-6 text-amber-500">{problem}</p> : null}</FcPanel> : null}
      {editor.canManage && editor.canChangeMembership ? <FcPanel className="p-4 sm:p-5"><h2 className="font-bold">Swap two teams</h2><p className="mt-1 text-sm leading-6 text-slate-500">Exchange teams between groups while keeping the group sizes balanced.</p><div className="mt-3 grid items-end gap-3 sm:grid-cols-3"><label className="grid min-w-0 gap-2 text-sm">First team<select className="theme-input min-h-11 w-full rounded-lg border px-2" value={swapFirst} onChange={event => { setSwapFirst(event.target.value); setSwapSecond(''); }} disabled={Boolean(busy)}><option value="">Choose a team</option>{current.draft.groups.map(group => <optgroup key={group.id} label={group.name}>{group.registrationIds.map(id => <option key={id} value={id}>{entryMap.get(id)?.name}</option>)}</optgroup>)}</select></label><label className="grid min-w-0 gap-2 text-sm">Second team<select className="theme-input min-h-11 w-full rounded-lg border px-2" value={swapSecond} onChange={event => setSwapSecond(event.target.value)} disabled={Boolean(busy) || !swapFirst}><option value="">Choose another group&apos;s team</option>{current.draft.groups.filter(group => !group.registrationIds.includes(swapFirst)).map(group => <optgroup key={group.id} label={group.name}>{group.registrationIds.map(id => <option key={id} value={id}>{entryMap.get(id)?.name}</option>)}</optgroup>)}</select></label><button type="button" disabled={Boolean(busy) || !swapFirst || !swapSecond} onClick={swapTeams} className={actionClass}>Swap in draft</button></div></FcPanel> : null}
      <label className="grid gap-2 text-sm font-semibold">Find a team or player<input type="search" value={query} onChange={event => setQuery(event.target.value)} className="theme-input min-h-11 w-full rounded-xl border px-4 text-sm" placeholder="Team name, player name or ID" /></label>
      {current.draft.unassignedIds.length ? <FcPanel className="p-4 sm:p-5"><h2 className="font-bold">Unassigned teams · {current.draft.unassignedIds.length}</h2><ul className="mt-3 grid gap-2 md:grid-cols-2">{current.draft.unassignedIds.map(id => { const entry = entryMap.get(id); return entry ? rosterRow(entry, '') : null; })}</ul></FcPanel> : null}
      {current.draft.groups.length ? <section aria-label="Tournament groups" className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">{current.draft.groups.map((group, index) => <FcPanel key={group.id} className="p-4 sm:p-5"><div className="flex items-start justify-between gap-2"><div className="min-w-0 flex-1">{editor.canManage ? <label className="grid gap-1 text-xs text-slate-500">Group {index + 1} name<input maxLength={40} value={group.name} disabled={Boolean(busy)} onChange={event => edit(draft => ({ ...draft, groups: draft.groups.map(value => value.id === group.id ? { ...value, name: event.target.value } : value) }))} className="theme-input min-h-11 w-full rounded-lg border px-3 text-sm font-bold" /></label> : <h2 className="break-words font-bold">{group.name}</h2>}<p className="mt-2 text-xs text-slate-500">{group.registrationIds.length} teams · Target {target}</p></div>{editor.canManage && editor.canChangeMembership ? <button type="button" aria-label={`Remove ${group.name || `group ${index + 1}`} from draft`} disabled={Boolean(busy) || counts.length <= 2} onClick={() => removeGroup(group.id)} className="min-h-11 rounded-lg border border-red-400/20 px-2 text-xs font-semibold text-red-400 disabled:opacity-40">Remove</button> : null}</div><ul className="mt-4 grid gap-2">{group.registrationIds.map(id => { const entry = entryMap.get(id); return entry ? rosterRow(entry, group.id) : null; })}</ul>{!group.registrationIds.length ? <p className="mt-4 text-sm text-slate-500">Move teams into this group or use Auto-balance groups.</p> : null}</FcPanel>)}</section> : <FcEmptyState title="No groups configured" description={editor.canChangeMembership ? 'Add at least two groups, then use Auto-balance groups to place the approved teams.' : 'An admin can configure the tournament groups.'} />}
      {editor.canManage ? <section className="theme-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4" aria-label="Group draft actions"><p className="text-sm font-semibold">{dirty ? 'Review this draft before changing the saved groups.' : 'All group changes are saved.'}</p><div className="flex flex-wrap gap-2"><button type="button" disabled={Boolean(busy) || !dirty} onClick={() => void discard()} className={actionClass}>Discard draft</button><button type="button" disabled={Boolean(busy) || !dirty || Boolean(problem) || remoteChanged} onClick={() => void previewChanges()} className="theme-primary-button min-h-11 rounded-xl px-4 text-sm font-bold disabled:opacity-50">{busy === 'preview' ? 'Reviewing…' : 'Review changes'}</button></div></section> : null}
      {review ? <section className="theme-panel rounded-2xl border p-4 sm:p-5" aria-label="Review group changes"><h2 className="font-bold">Review group changes</h2><p className="mt-2 text-sm leading-6 text-slate-500">{review.preview.groups.map(group => `${group.name}: ${group.teams}`).join(' · ')}</p><dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{[[review.preview.impact.movedTeams, 'Teams moved'], [review.preview.impact.renamedGroups, 'Groups renamed'], [review.preview.impact.newGroups, 'Groups added'], [review.preview.impact.deletedGroups, 'Groups removed'], [review.preview.impact.fixturesKept, 'Fixtures kept'], [review.preview.impact.fixturesRemoved, 'Unplayed fixtures removed'], [review.preview.impact.fixturesCreated, 'New fixtures'], [review.preview.impact.fixturesReslotted, 'Fixture rounds updated'], [review.preview.impact.resultsPreserved, 'Results preserved']].map(([value, label]) => <div key={label} className="rounded-lg border border-white/10 p-3"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-lg font-bold">{value}</dd></div>)}</dl><p className="mt-4 text-sm leading-6 text-slate-500">Retained fixtures keep their match IDs, scores and dates. New fixtures are unscheduled and need scheduling. A move that would invalidate a submitted match result cannot be applied.</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => void applyChanges()} disabled={Boolean(busy)} className="theme-primary-button min-h-11 rounded-xl px-4 text-sm font-bold disabled:opacity-50">{busy === 'apply' ? 'Applying changes…' : 'Apply reviewed changes'}</button><button type="button" onClick={() => setReview(null)} disabled={Boolean(busy)} className={actionClass}>Back to draft</button></div></section> : null}
      <div className="flex flex-wrap gap-4 text-sm font-semibold"><Link href={`/tournaments/${tournamentId}/fixtures`} className="theme-text-link inline-flex min-h-11 items-center">Open fixtures →</Link><Link href={`/tournaments/${tournamentId}/standings`} className="theme-text-link inline-flex min-h-11 items-center">View standings →</Link></div>
    </div>
  </AppShell>;
}
