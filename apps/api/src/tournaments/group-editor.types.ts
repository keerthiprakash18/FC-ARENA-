export interface GroupEditorEntry { id: string; name: string; logoUrl: string | null; members: { id: string; name: string; playerCode: string | null }[] }
export interface GroupEditorState {
  revision: string;
  tournament: { id: string; name: string; code: string; leagueId: string; status: string; groupMode: string; legType: string; maxEntries: number; hasFixtures: boolean };
  canManage: boolean;
  canChangeMembership: boolean;
  membershipReason: string | null;
  protectedEntryIds: string[];
  groups: { id: string; name: string; position: number; entries: GroupEditorEntry[] }[];
  unassigned: GroupEditorEntry[];
}
export interface GroupEditInput { revision: string; groups: { id: string; name: string; registrationIds: string[] }[] }
export interface GroupChangePreview {
  revision: string; planHash: string; membershipChanged: boolean;
  groups: { id: string; name: string; teams: number }[];
  impact: { movedTeams: number; newGroups: number; deletedGroups: number; renamedGroups: number; fixturesKept: number; fixturesRemoved: number; fixturesCreated: number; fixturesReslotted: number; resultsPreserved: number };
}
