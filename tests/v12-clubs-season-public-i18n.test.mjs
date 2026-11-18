import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { translate, menuTranslationKey } from '../apps/web/src/lib/locale.ts';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const src=(p)=>fs.readFileSync(path.join(root,p),'utf8');

test('English and Tamil dictionaries cover every shared navigation and core action',()=>{
  for(const key of ['home','leagues','tournaments','fixtures','awards','more','clubs','seasonRecaps','spectator','liveFixtures','verifiedResults']){
    assert.equal(typeof translate('en',key),'string');
    assert.equal(typeof translate('ta',key),'string');
    assert.notEqual(translate('en',key),translate('ta',key),key);
  }
  assert.equal(menuTranslationKey('/clubs'),'clubs');
  assert.equal(menuTranslationKey('/career/season-recaps'),'seasonRecaps');
  assert.equal(menuTranslationKey('/tournaments'),'tournaments');
});
test('V12 introduces persistent club identity with additive DB migration and opt-in rosters',()=>{
  const schema=src('apps/api/prisma/schema.prisma');
  const migration=src('apps/api/prisma/migrations/20261118180000_persistent_arena_clubs/migration.sql');
  const service=src('apps/api/src/clubs/clubs.service.ts');
  assert.match(schema,/model ArenaClub \{/);
  assert.match(schema,/model ArenaClubMember \{/);
  assert.match(schema,/model ArenaClubEntry \{/);
  assert.match(migration,/CREATE TABLE "arena_clubs"/);
  assert.match(migration,/CREATE TABLE "arena_club_members"/);
  assert.match(migration,/CREATE TABLE "arena_club_entries"/);
  assert.doesNotMatch(migration,/DROP TABLE|TRUNCATE|DELETE FROM/i);
  assert.match(service,/inviteHash/);
  assert.match(service,/registration\.members\.every|roster !== registration\.members\.length/);
  assert.match(service,/previousVerifiedMatches/);
  assert.match(service,/confirmedResult/);
  assert.match(service,/status !== 'CONFIRMED'/);
  assert.match(service,/ARENA_CLUB_ENTRY_LINKED/);
  assert.match(src('apps/api/src/clubs/clubs.controller.ts'),/UseGuards\(JwtAuthGuard\)/);
});
test('Season Recap uses official saved period and confirmed results, never guessed rank or individual goal count',()=>{
  const service=src('apps/api/src/player-career/player-career.service.ts');
  assert.match(service,/getMySeasonRecaps/);
  assert.match(service,/ballonSeason\.findMany/);
  assert.match(service,/new Date\(match\.confirmedAt\)/);
  assert.match(service,/eligibleTournaments\.has/);
  assert.match(service,/eligibleLeagues\.has/);
  assert.match(service,/ballonFinalRanking\.findMany/);
  assert.match(service,/TEAM_SIDE_GOALS/);
  assert.match(src('apps/web/src/app/career/season-recaps/page.tsx'),/ShareCard/);
});
test('Spectator data reuses visibility-filtered API and never publishes unverified scores',()=>{
  const publicService=src('apps/api/src/public/public.service.ts');
  const matchPage=src('apps/web/src/app/watch/[code]/page.tsx');
  assert.match(publicService,/visibility:\s*'PUBLIC'/);
  assert.match(matchPage,/apiRequest/);
  assert.match(matchPage,/\/public\/tournaments\//);
  assert.match(matchPage,/result/);
  assert.match(matchPage,/scores are not published until approval/);
  assert.doesNotMatch(matchPage,/authenticatedRequest|getCurrentUser/);
  assert.match(src('apps/web/src/app/public/tournaments/[code]/page.tsx'),/\/watch\//);
});
