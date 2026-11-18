import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const src=(p)=>fs.readFileSync(path.join(root,p),'utf8');

test('English-only FC ARENA has no Tamil language option',()=>{
  const pages=[
    'apps/web/src/components/app/app-shell.tsx',
    'apps/web/src/components/app/app-header.tsx',
    'apps/web/src/components/app/bottom-navigation.tsx',
    'apps/web/src/app/more/page.tsx',
    'apps/web/src/app/clubs/page.tsx',
    'apps/web/src/app/clubs/[slug]/page.tsx',
    'apps/web/src/app/career/season-recaps/page.tsx',
    'apps/web/src/app/watch/[code]/page.tsx',
  ];
  for(const page of pages){
    assert.doesNotMatch(src(page),/LanguageSwitcher|useArenaLocale|menuTranslationKey|[\u0B80-\u0BFF]/u);
  }
  assert.doesNotMatch(src('apps/web/src/app/layout.tsx'),/fc-arena-locale-v1/);
  assert.equal(fs.existsSync(path.join(root,'apps/web/src/lib/locale.ts')),false);
  assert.equal(fs.existsSync(path.join(root,'apps/web/src/components/app/language-switcher.tsx')),false);
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


test('V12 CSS is structurally consolidated into one ordered product bundle without dropping legacy declarations',()=>{
  const sheets=[
    'modernization.css','ux-polish.css','interactions.css','release-consistency.css',
    'premium-redesign.css','player-community.css','daily-rewards.css','competition-clarity.css',
    'native-android.css','vnext-interaction-system.css','vnext-visual-polish.css',
    'arena-design.css','arena-premium-foundations.css',
  ];
  const css=src('apps/web/src/app/arena-consolidated.css');
  let cursor=0;
  for(const sheet of sheets){
    const block='/* ---- BEGIN SOURCE '+sheet+' ---- */\\n'.replace('\\n','\n')
      +src('apps/web/src/app/'+sheet)+'\n/* ---- END SOURCE '+sheet+' ---- */';
    const i=css.indexOf(block,cursor);
    assert.ok(i>=cursor,'missing/moved original CSS content: '+sheet);
    cursor=i+block.length;
  }
  const layout=src('apps/web/src/app/layout.tsx');
  const imports=layout.split('\n').map(line=>line.trim())
    .filter(line=>line.startsWith("import './") && line.endsWith(".css';"))
    .map(line=>line.slice("import './".length,-"';".length));
  assert.deepEqual(imports,['globals.css','design-tokens.css','arena-consolidated.css']);
});

test('New Clubs, Season Recap and Spectator pages show English copy',()=>{
  assert.match(src('apps/web/src/app/clubs/page.tsx'),/Create Club/);
  assert.match(src('apps/web/src/app/career/season-recaps/page.tsx'),/Official season/);
  assert.match(src('apps/web/src/app/watch/[code]/page.tsx'),/Verified Results/);
});
