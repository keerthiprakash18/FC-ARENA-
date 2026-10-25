'use client';

/* eslint-disable react-hooks/exhaustive-deps -- The loader is intentionally keyed by the resource path. */

import { confirmAction } from '@/components/fc/confirmation-provider';
import {
  FcEmptyState,
  FcErrorState,
  FcLoadingScreen,
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';
import { authenticatedRequest } from '@/lib/auth-client';
import { useEffect, useMemo, useState } from 'react';

export type AdminScopeType = 'LEAGUE' | 'TOURNAMENT';

type Permission = {
  value: string;
  label: string;
  description: string;
};

type Admin = {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  profileImageUrl: string | null;
  role: 'OWNER' | 'ADMIN';
  permissions: string[];
  status: 'ACTIVE' | 'INACTIVE';
  assignedAt: string;
};

type Candidate = {
  id: string;
  username: string;
  fullName: string;
  profileImageUrl: string | null;
  playerCode: string | null;
  assigned: boolean;
};

const leaguePermissions: Permission[] = [
  { value: 'MANAGE_SETTINGS', label: 'League settings', description: 'Update league configuration and branding.' },
  { value: 'MANAGE_MEMBERS', label: 'Members', description: 'Review join requests and manage membership.' },
  { value: 'MANAGE_FIXTURES', label: 'Fixtures', description: 'Coordinate league fixture operations.' },
  { value: 'MANAGE_STANDINGS', label: 'Standings', description: 'Maintain standings and league results.' },
  { value: 'MANAGE_TOURNAMENTS', label: 'Tournaments', description: 'Operate league tournaments where explicitly allowed.' },
  { value: 'VIEW_REPORTS', label: 'Reports', description: 'View league reports and audit information.' },
];

const tournamentPermissions: Permission[] = [
  { value: 'MANAGE_FIXTURES', label: 'Fixtures', description: 'Generate and schedule tournament fixtures.' },
  { value: 'MANAGE_RESULTS', label: 'Match results', description: 'Manage result workflows.' },
  { value: 'VERIFY_SCORES', label: 'Score verification', description: 'Verify or reject submitted scores.' },
  { value: 'MANAGE_PARTICIPANTS', label: 'Participants', description: 'Approve and manage entries and teams.' },
  { value: 'MANAGE_SETTINGS', label: 'Tournament settings', description: 'Change tournament operations and settings.' },
  { value: 'VIEW_REPORTS', label: 'Reports', description: 'View tournament reports and audit information.' },
];

export function AdminManagementPanel({
  scopeType,
  scopeId,
  scopeName,
}: {
  scopeType: AdminScopeType;
  scopeId: string;
  scopeName: string;
}) {
  const permissions = scopeType === 'LEAGUE' ? leaguePermissions : tournamentPermissions;
  const basePath = scopeType === 'LEAGUE' ? `/leagues/${scopeId}` : `/tournaments/${scopeId}`;
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [maxAdmins, setMaxAdmins] = useState<number | null>(null);
  const [limitInput, setLimitInput] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [candidateSearch, setCandidateSearch] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(permissions.map((item) => item.value));
  const [editingAdminId, setEditingAdminId] = useState<string | null>(null);
  const [draftPermissions, setDraftPermissions] = useState<string[]>([]);
  const [replacementUserIds, setReplacementUserIds] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const availableCandidates = useMemo(() => candidates.filter((candidate) => !candidate.assigned), [candidates]);
  const adminCount = admins.filter((admin) => admin.role === 'ADMIN').length;

  async function load(candidateQuery = '') {
    const candidatePath = candidateQuery.trim() ? `${basePath}/admin-candidates?search=${encodeURIComponent(candidateQuery.trim())}` : `${basePath}/admin-candidates`;
    const [adminsResponse, candidatesResponse] = await Promise.all([
      authenticatedRequest<{ data: { admins: Admin[]; maxAdmins: number | null } }>(`${basePath}/admins`),
      authenticatedRequest<{ data: { users: Candidate[] } }>(candidatePath),
    ]);
    setAdmins(adminsResponse.data.admins);
    setMaxAdmins(adminsResponse.data.maxAdmins);
    setLimitInput(adminsResponse.data.maxAdmins === null ? '' : String(adminsResponse.data.maxAdmins));
    setCandidates(candidatesResponse.data.users);
  }

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Admin management could not be loaded.');
      } finally {
        setLoading(false);
      }
    })();
  }, [basePath]);

  function togglePermission(value: string, setter: (values: string[]) => void, current: string[]) {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  async function addAdmin() {
    if (!selectedUserId || busy) return;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const body = scopeType === 'LEAGUE'
        ? { userId: selectedUserId, leaguePermissions: selectedPermissions }
        : { userId: selectedUserId, tournamentPermissions: selectedPermissions };
      const response = await authenticatedRequest<{ data: { message: string } }>(`${basePath}/admins`, { method: 'POST', body: JSON.stringify(body) });
      setMessage(response.data.message);
      setSelectedUserId('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin could not be added.');
    } finally {
      setBusy(false);
    }
  }

  async function saveLimit() {
    if (busy) return;
    const parsed = limitInput.trim() === '' ? null : Number(limitInput);
    if (parsed !== null && (!Number.isInteger(parsed) || parsed < 0)) {
      setError('Enter a whole number of additional admins, or leave the field blank for unlimited.');
      return;
    }
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const response = await authenticatedRequest<{ data: { message: string; maxAdmins: number | null } }>(`${basePath}/admin-settings`, { method: 'PATCH', body: JSON.stringify({ maxAdmins: parsed }) });
      setMaxAdmins(response.data.maxAdmins);
      setLimitInput(response.data.maxAdmins === null ? '' : String(response.data.maxAdmins));
      setMessage(response.data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin limit could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  async function removeAdmin(admin: Admin) {
    if (busy || admin.role === 'OWNER') return;
    if (!(await confirmAction({ title: 'Remove admin?', description: `Remove ${admin.username} from ${scopeName}? Their access ends immediately.`, confirmLabel: 'Remove admin', destructive: true }))) return;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const response = await authenticatedRequest<{ data: { message: string } }>(`${basePath}/admins/${admin.id}`, { method: 'DELETE' });
      setMessage(response.data.message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin could not be removed.');
    } finally {
      setBusy(false);
    }
  }

  async function replaceAdmin(admin: Admin) {
    const replacementUserId = replacementUserIds[admin.id];
    if (busy || admin.role === 'OWNER' || !replacementUserId) return;
    const replacement = candidates.find((candidate) => candidate.id === replacementUserId);
    if (!(await confirmAction({ title: 'Replace admin?', description: `Replace ${admin.username} with ${replacement?.username ?? 'the selected user'}? ${admin.username} loses access immediately and permissions transfer unchanged.`, confirmLabel: 'Replace admin', destructive: true }))) return;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const response = await authenticatedRequest<{ data: { message: string } }>(`${basePath}/admins/${admin.id}/replace`, { method: 'POST', body: JSON.stringify({ replacementUserId }) });
      setMessage(response.data.message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin could not be replaced.');
    } finally {
      setBusy(false);
    }
  }

  async function savePermissions(admin: Admin) {
    if (busy || admin.role === 'OWNER') return;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const body = scopeType === 'LEAGUE' ? { leaguePermissions: draftPermissions } : { tournamentPermissions: draftPermissions };
      const response = await authenticatedRequest<{ data: { message: string } }>(`${basePath}/admins/${admin.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setMessage(response.data.message);
      setEditingAdminId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin permissions could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <FcLoadingScreen label="Loading Admin Management..." />;

  return (
    <div className="space-y-6">
      <FcPanel className="p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">Administration policy</p>
            <h2 className="mt-2 text-xl font-black">Configurable admin capacity</h2>
            <p className="theme-secondary-text mt-2 max-w-2xl text-sm leading-6">Set the maximum number of additional admins for this {scopeType === 'LEAGUE' ? 'league' : 'tournament'}. Leave blank for no limit. The owner is always protected and is not counted against this setting.</p>
          </div>
          <FcStatusBadge label={maxAdmins === null ? 'Unlimited' : `${adminCount}/${maxAdmins} admins`} tone="gold" />
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="grid flex-1 gap-2">
            <span className="theme-muted text-xs font-bold uppercase tracking-[0.12em]">Additional admin limit</span>
            <input type="number" min="0" value={limitInput} onChange={(event) => setLimitInput(event.target.value)} placeholder="Unlimited" className="theme-input min-h-12 rounded-xl border px-3 text-sm" />
          </label>
          <button type="button" disabled={busy} onClick={() => void saveLimit()} className="theme-primary-button min-h-12 rounded-xl px-5 text-sm font-black disabled:opacity-40">Save limit</button>
        </div>
      </FcPanel>

      {message ? <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4 text-sm text-emerald-300">{message}</div> : null}
      {error ? <FcErrorState message={error} /> : null}

      <FcPanel className="p-5 sm:p-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">Add Admin</p>
          <h2 className="mt-2 text-xl font-black">Assign an existing FC ARENA user</h2>
          <p className="theme-secondary-text mt-2 text-sm leading-6">Admins are selected from active registered users. Permissions are scoped to this {scopeType === 'LEAGUE' ? 'league' : 'tournament'} only.</p>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div className="space-y-3">
            <label className="grid gap-2">
              <span className="theme-muted text-xs font-bold uppercase tracking-[0.12em]">Find a registered user</span>
              <div className="flex gap-2">
                <input value={candidateSearch} onChange={(event) => setCandidateSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void load(candidateSearch); } }} placeholder="Username, name or FC ARENA ID" className="theme-input min-h-12 min-w-0 flex-1 rounded-xl border px-3 text-sm" />
                <button type="button" disabled={busy} onClick={() => void load(candidateSearch)} className="min-h-12 rounded-xl border border-sky-400/20 px-4 text-xs font-black text-sky-300 disabled:opacity-40">Search</button>
              </div>
            </label>
            <label className="grid gap-2">
              <span className="theme-muted text-xs font-bold uppercase tracking-[0.12em]">User</span>
              <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} className="theme-input min-h-12 rounded-xl border px-3 text-sm">
                <option value="">Select a user</option>
                {availableCandidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.username} — {candidate.fullName}</option>)}
              </select>
            </label>
            <button type="button" disabled={busy || !selectedUserId} onClick={() => void addAdmin()} className="theme-primary-button min-h-12 w-full rounded-xl px-5 text-sm font-black disabled:opacity-40">{busy ? 'Saving...' : 'Add Admin'}</button>
          </div>
          <div>
            <p className="theme-muted text-xs font-bold uppercase tracking-[0.12em]">Initial permissions</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {permissions.map((permission) => <label key={permission.value} className="flex cursor-pointer gap-3 rounded-xl border border-white/10 p-3"><input type="checkbox" checked={selectedPermissions.includes(permission.value)} onChange={() => togglePermission(permission.value, setSelectedPermissions, selectedPermissions)} className="mt-1 accent-amber-300" /><span><span className="block text-sm font-black">{permission.label}</span><span className="theme-muted mt-1 block text-xs leading-5">{permission.description}</span></span></label>)}
            </div>
          </div>
        </div>
      </FcPanel>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">Assigned admins</p><h2 className="mt-1 text-xl font-black">{scopeName} administration</h2></div><FcStatusBadge label={`${admins.length} total`} tone="cyan" /></div>
        {admins.length === 0 ? <FcEmptyState title="No admins assigned" description="The owner is protected automatically. Add an admin when another trusted user needs operational access." /> : <div className="grid gap-4 lg:grid-cols-2">{admins.map((admin) => {
          const isEditing = editingAdminId === admin.id;
          const editablePermissions = isEditing ? draftPermissions : admin.permissions;
          return <FcPanel key={admin.id} className="p-5 sm:p-6"><div className="flex items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-amber-300/20 bg-amber-300/10 text-lg font-black text-amber-200">{admin.profileImageUrl ? <img src={admin.profileImageUrl} alt="" className="h-full w-full object-cover" /> : admin.username.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-lg font-black">{admin.username}</h3><FcStatusBadge label={admin.role} tone={admin.role === 'OWNER' ? 'gold' : 'cyan'} /><FcStatusBadge label={admin.status} tone={admin.status === 'ACTIVE' ? 'emerald' : 'red'} /></div><p className="theme-secondary-text mt-1 text-sm">{admin.fullName}</p><p className="theme-muted mt-2 text-xs">Assigned {new Date(admin.assignedAt).toLocaleString()}</p></div></div><div className="mt-5 flex flex-wrap gap-2">{admin.permissions.map((permission) => <FcStatusBadge key={permission} label={permission} tone="slate" />)}</div>{admin.role === 'OWNER' ? <p className="theme-muted mt-4 text-xs leading-5">Owner access is protected. Ownership is never transferred by replacement or removal.</p> : <><div className="mt-5 flex flex-col gap-3 sm:flex-row"><select value={replacementUserIds[admin.id] ?? ''} onChange={(event) => setReplacementUserIds((current) => ({ ...current, [admin.id]: event.target.value }))} className="theme-input min-h-11 flex-1 rounded-xl border px-3 text-sm"><option value="">Select replacement user</option>{availableCandidates.filter((candidate) => candidate.id !== admin.userId).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.username} — {candidate.fullName}</option>)}</select><button type="button" disabled={busy || !replacementUserIds[admin.id]} onClick={() => void replaceAdmin(admin)} className="min-h-11 rounded-xl border border-amber-300/20 px-4 text-sm font-black text-amber-200 disabled:opacity-40">Replace Admin</button></div><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => { setEditingAdminId(isEditing ? null : admin.id); setDraftPermissions(admin.permissions); }} className="min-h-10 rounded-xl border border-sky-400/20 px-4 text-xs font-black text-sky-300 disabled:opacity-40">{isEditing ? 'Cancel Edit' : 'Edit Permissions'}</button><button type="button" disabled={busy} onClick={() => void removeAdmin(admin)} className="min-h-10 rounded-xl border border-red-400/20 px-4 text-xs font-black text-red-300 disabled:opacity-40">Remove Admin</button></div>{isEditing ? <div className="mt-4 grid gap-2 border-t border-white/10 pt-4 sm:grid-cols-2">{permissions.map((permission) => <label key={permission.value} className="flex cursor-pointer gap-3 rounded-xl border border-white/10 p-3"><input type="checkbox" checked={editablePermissions.includes(permission.value)} onChange={() => togglePermission(permission.value, setDraftPermissions, draftPermissions)} className="mt-1 accent-amber-300" /><span className="text-sm font-black">{permission.label}</span></label>)}<button type="button" disabled={busy} onClick={() => void savePermissions(admin)} className="theme-primary-button min-h-11 rounded-xl px-4 text-sm font-black sm:col-span-2 disabled:opacity-40">Save Permissions</button></div> : null}</>}</FcPanel>;
        })}</div>}
      </section>
    </div>
  );
}
