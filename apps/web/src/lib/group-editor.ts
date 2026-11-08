export type { GroupEditorState, GroupEditorEntry, GroupEditInput, GroupChangePreview } from '../../../api/src/tournaments/group-editor.types';
export { balanceGroupMembership } from '../../../api/src/tournaments/balanced-group-draw';

export interface DraftGroup { id: string; name: string; registrationIds: string[] }
export interface GroupDraft { groups: DraftGroup[]; unassignedIds: string[] }

export function createGroupId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function groupDraftKey(draft: GroupDraft, includeNames = true): string {
  return JSON.stringify({ groups: draft.groups.map(group => ({ id: group.id, ...(includeNames ? { name: group.name.trim() } : {}), entries: [...group.registrationIds].sort() })), unassigned: [...draft.unassignedIds].sort() });
}

export function groupDraftProblem(draft: GroupDraft, entryIds: string[], checkMembership: boolean): string | null {
  if (draft.groups.length < 2 || draft.groups.length > 16) return 'Choose between 2 and 16 groups.';
  const names = draft.groups.map(group => group.name.normalize('NFKC').trim().toLocaleLowerCase());
  if (names.some(name => !name || name.length > 40)) return 'Every group needs a name between 1 and 40 characters.';
  if (new Set(names).size !== names.length) return 'Use a different name for every group.';
  if (!checkMembership) return null;
  if (draft.unassignedIds.length) return `Assign all ${draft.unassignedIds.length} remaining team(s) before reviewing.`;
  const assigned = draft.groups.flatMap(group => group.registrationIds), expected = new Set(entryIds);
  if (assigned.length !== expected.size || new Set(assigned).size !== expected.size || assigned.some(id => !expected.has(id))) return 'Every approved team must appear in exactly one group. Reload the latest group data.';
  const counts = draft.groups.map(group => group.registrationIds.length);
  if (Math.min(...counts) < 2) return 'Each group must have at least two approved teams. Use fewer groups or add more teams.';
  if (Math.max(...counts) - Math.min(...counts) > 1) return 'Group sizes are uneven. Use Auto-balance groups or move teams until the difference is at most one.';
  return null;
}
