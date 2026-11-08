import { normalizeTeamName } from './entry-name';

export interface TeamChoiceEntry { id: string; entryName: string | null; status: string }

export function chosenTeamNames(entries: readonly TeamChoiceEntry[], excludeEntryId?: string) {
  return new Set(entries.filter(entry => entry.id !== excludeEntryId && ['PENDING', 'APPROVED'].includes(entry.status))
    .map(entry => normalizeTeamName(entry.entryName ?? '')).filter(Boolean));
}
