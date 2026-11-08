import sharp from 'sharp';
import type { ReportEntry, ReportMatch, ReportStatistics, TournamentReport, TournamentTeamList } from './tournament-report.types.js';

const WIDTH = 1240, HEIGHT = 1754, MARGIN = 80, BODY_WIDTH = WIDTH - 2 * MARGIN;
const PAGE_LIMIT = 200, BYTE_LIMIT = 48 * 1024 * 1024;
const FONT = 'Noto Sans, Noto Sans Tamil, Noto Sans CJK JP, DejaVu Sans, sans-serif';
const C = { ink: '#132d46', muted: '#536677', gold: '#af842e', paper: '#f6f5f0', line: '#dbe2e8', white: '#ffffff', navy: '#10273c' };

export type TournamentReportFormat = 'pdf' | 'png';
export interface RenderedTournamentReport { bytes: Buffer; contentType: 'application/pdf' | 'image/png'; pages: number }
export class TournamentReportRenderLimitError extends Error {
  constructor() { super('This export exceeds the supported file size. Use PDF for a long team list, or contact FC Arena support for a large tournament archive.'); }
}

function xml(value: unknown) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
}
function words(value: unknown) { return String(value ?? '').replaceAll('_', ' ').trim(); }
function date(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Not recorded';
  return new Date(value).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}
function graphemes(value: string) { return [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(value)].map(part => part.segment); }
function units(value: string) {
  return graphemes(value).reduce((sum, g) => sum + (/^\s$/u.test(g) ? 0.36 : /^[MW@%]$/u.test(g) ? 1 : /^[A-Z]$/u.test(g) ? 0.78 : /^[a-z0-9.,:;!|()\-/]$/u.test(g) ? 0.65 : 1.05), 0);
}
/** Conservative visual wrapping keeps every character; long tokens break by grapheme. */
export function wrapReportText(value: unknown, width: number, size = 22): string[] {
  const result: string[] = [];
  for (const paragraph of String(value ?? '').replace(/\r/g, '').split('\n')) {
    let line = '';
    for (const token of paragraph.trim().split(/\s+/u).filter(Boolean)) {
      const proposed = line ? line + ' ' + token : token;
      if (units(proposed) * size <= width) { line = proposed; continue; }
      if (line) { result.push(line); line = ''; }
      for (const g of graphemes(token)) {
        if (line && units(line + g) * size > width) { result.push(line); line = ''; }
        line += g;
      }
    }
    result.push(line);
  }
  return result.length ? result : [''];
}
function text(x: number, y: number, value: string, size = 22, fill = C.ink, weight = 400, anchor = 'start') {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${xml(value)}</text>`;
}
function rect(x: number, y: number, width: number, height: number, fill: string, radius = 0) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}"/>`;
}
function entryName(entry: ReportEntry | null | undefined) { return entry?.name ?? 'Not awarded'; }

interface Column { title: string; width: number }
class Book {
  pages: Array<{ parts: string[]; dark: boolean }> = [];
  y = 0;
  page!: { parts: string[]; dark: boolean };
  constructor(private report: Pick<TournamentTeamList, 'generatedAt' | 'tournament'>) {}
  next(title: string, dark = false) {
    if (this.pages.length >= PAGE_LIMIT) throw new TournamentReportRenderLimitError();
    this.page = { dark, parts: [] }; this.pages.push(this.page);
    this.page.parts.push(rect(0, 0, WIDTH, HEIGHT, dark ? C.navy : C.paper));
    this.page.parts.push(rect(MARGIN, 54, 12, 40, C.gold, 6));
    this.page.parts.push(text(MARGIN + 30, 82, 'FC ARENA / TOURNAMENT REPORT', 23, dark ? '#e9dbb7' : C.gold, 700));
    const titles = wrapReportText(title, BODY_WIDTH, 35);
    titles.forEach((line, index) => this.page.parts.push(text(MARGIN, 145 + index * 46, line, 35, dark ? C.white : C.ink, 750)));
    this.y = 190 + (titles.length - 1) * 46;
  }
  ensure(height: number, title = 'Tournament report (continued)') { if (this.y + height > HEIGHT - 115) this.next(title, this.page.dark); }
  paragraph(value: string, size = 22, fill = this.page.dark ? '#d7e1ea' : C.muted, gap = 20, weight = 400) {
    for (const line of wrapReportText(value, BODY_WIDTH, size)) {
      this.ensure(size * 1.4 + gap);
      this.page.parts.push(text(MARGIN, this.y + size, line, size, fill, weight)); this.y += size * 1.4;
    }
    this.y += gap;
  }
  heading(value: string) { this.ensure(75); this.y += 12; this.paragraph(value, 28, this.page.dark ? '#e4c774' : C.ink, 12, 700); }
  table(title: string, columns: Column[], rows: string[][], caption?: string) {
    this.next(title);
    if (caption) this.paragraph(caption, 20);
    const header = () => {
      const height = Math.max(...columns.map(c => wrapReportText(c.title, c.width - 22, 19).length)) * 26 + 18;
      let x = MARGIN;
      this.page.parts.push(rect(MARGIN, this.y, BODY_WIDTH, height, C.navy, 8));
      for (const col of columns) {
        wrapReportText(col.title, col.width - 22, 19).forEach((line, i) => this.page.parts.push(text(x + 11, this.y + 27 + i * 26, line, 19, C.white, 700)));
        x += col.width;
      }
      this.y += height + 4;
    };
    header();
    if (!rows.length) { this.paragraph('No records were published for this section.', 22); return; }
    for (const [rowIndex, values] of rows.entries()) {
      const cells = columns.map((col, i) => wrapReportText(values[i] ?? '', col.width - 22, 22));
      const lineCount = Math.max(...cells.map(c => c.length));
      const headerHeight = Math.max(...columns.map(c => wrapReportText(c.title, c.width - 22, 19).length)) * 26 + 22;
      const freshTop = 190 + (wrapReportText(title + ' (continued)', BODY_WIDTH, 35).length - 1) * 46 + headerHeight;
      const rowHeight = lineCount * 31 + 22;
      // Keep a normal team/fixture row together. Only exceptionally tall rosters
      // split across pages, with repeated headers and an explicit continuation.
      if (rowHeight <= HEIGHT - 115 - freshTop && this.y + rowHeight > HEIGHT - 115) { this.next(title + ' (continued)'); header(); }
      let offset = 0;
      while (offset < lineCount) {
        if (HEIGHT - 115 - this.y < 80) { this.next(title + ' (continued)'); header(); }
        const available = Math.max(1, Math.floor((HEIGHT - 115 - this.y - 22) / 31));
        const count = Math.min(lineCount - offset, available), height = count * 31 + 22;
        this.page.parts.push(rect(MARGIN, this.y, BODY_WIDTH, height, rowIndex % 2 ? '#edf1f3' : C.white, 6));
        let x = MARGIN;
        cells.forEach((lines, i) => {
          let visible = lines.slice(offset, offset + count);
          if (offset && i === 0 && !visible.length) visible = wrapReportText((values[0] ?? '') + ' (continued)', columns[0].width - 22, 22).slice(0, count);
          visible.forEach((line, n) => this.page.parts.push(text(x + 11, this.y + 31 + n * 31, line, 22, i === 0 ? C.ink : C.muted, i === 0 ? 650 : 400)));
          x += columns[i].width;
        });
        this.y += height + 4; offset += count;
        if (offset < lineCount) { this.next(title + ' (continued)'); header(); }
      }
    }
  }
  finish() {
    return this.pages.map((page, i) => {
      const footer = `${this.report.tournament.code}  |  ${date(this.report.generatedAt)}`;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${page.parts.join('')}<path d="M${MARGIN} ${HEIGHT - 82}H${WIDTH - MARGIN}" stroke="${page.dark ? '#436073' : C.line}"/>${text(MARGIN, HEIGHT - 46, footer, 17, page.dark ? '#b5c6d3' : C.muted)}${text(WIDTH - MARGIN, HEIGHT - 46, `${i + 1} / ${this.pages.length}`, 18, page.dark ? C.white : C.ink, 600, 'end')}</svg>`;
    });
  }
}

function statistics(row: ReportStatistics) {
  return [row.played, row.wins, row.draws, row.losses, row.goalsFor, row.goalsAgainst, row.goalDifference, row.points, row.form || '-'].map(String);
}
const STAT_COLUMNS: Column[] = [{ title: 'P', width: 65 }, { title: 'W', width: 65 }, { title: 'D', width: 65 }, { title: 'L', width: 65 }, { title: 'GF', width: 70 }, { title: 'GA', width: 70 }, { title: 'GD', width: 70 }, { title: 'Pts', width: 70 }, { title: 'Form', width: 160 }];
function score(match: ReportMatch) {
  if (!match.score) return match.status === 'BYE' ? 'BYE' : 'Not verified';
  const lines = [`${match.score.home} - ${match.score.away}`];
  if (match.score.homePenalties !== null && match.score.awayPenalties !== null) lines.push(`Pens ${match.score.homePenalties} - ${match.score.awayPenalties}`);
  if (match.aggregate) lines.push(`Agg ${match.aggregate.home} - ${match.aggregate.away}`);
  return lines.join('\n');
}

/** Pure pagination model is exported for content/coverage verification. */
export function tournamentReportPages(report: TournamentReport): string[] {
  const b = new Book(report);
  b.next('THE FINAL REPORT', true);
  b.paragraph(report.tournament.name, 48, C.white, 20, 750);
  b.paragraph(`${report.tournament.league.name}\n${report.tournament.code}`, 25, '#d9c38c');
  b.paragraph(`${words(report.tournament.competitionFormat)}  |  ${words(report.tournament.mode)}  |  ${words(report.tournament.legType)}`, 22);
  b.paragraph(`Started: ${date(report.tournament.startAt)}\nCompleted: ${date(report.tournament.completedAt)}`, 21);
  b.heading('CHAMPIONS'); b.paragraph(entryName(report.placements.champion), 42, C.white, 15, 750);
  if (report.placements.champion?.members.length) b.paragraph(report.placements.champion.members.map(p => p.name).join(' · '), 22);
  b.heading('Runner-up'); b.paragraph(entryName(report.placements.runnerUp), 27, '#e6edf3');
  b.heading('Third place'); b.paragraph(report.placements.thirdPlace.map(entryName).join(' · ') || 'Not awarded', 25, '#e6edf3');
  b.heading('Tournament in numbers');
  b.paragraph(`${report.overview.teams} teams  ·  ${report.overview.players} players  ·  ${report.overview.groups} groups\n${report.overview.verifiedMatches} verified matches  ·  ${report.overview.totalGoals} goals\n${report.overview.averageGoalsPerMatch.toFixed(2)} goals per verified match\n${report.overview.fixtures} fixtures  ·  ${report.overview.cancelledFixtures} cancelled  ·  ${report.overview.byes} byes`, 24);
  b.paragraph(`Placements: ${report.placements.source === 'PUBLISHED' ? 'Published completion summary' : report.placements.source === 'DERIVED' ? 'Derived from completed official competition records' : 'Not available'}\nPublished: ${date(report.placements.publishedAt)}`, 20);
  if (report.tournament.description) { b.heading('About the tournament'); b.paragraph(report.tournament.description, 22); }
  const notes = `This report uses confirmed result scorelines. Unverified scores are never presented as official results.\nUnconfirmed scorelines omitted: ${report.integrity.omittedUnconfirmedScores} · Duplicate records removed: ${report.integrity.duplicateFixturesRemoved}\n${report.integrity.warnings.join('\n')}`;
  b.table('Awards & report notes', [{ title: 'Award', width: 300 }, { title: 'Recipient', width: 300 }, { title: 'Details', width: 480 }], report.awards.map(a => [a.title || words(a.type), `${a.player.name}\n${a.player.playerCode ?? ''}`, `${a.description ?? 'Published tournament award'}\n${date(a.awardedAt)}`]), notes);
  for (const table of report.standings) b.table(table.name, [{ title: '#', width: 50 }, { title: 'Team', width: 330 }, ...STAT_COLUMNS], table.rows.map(row => [String(row.position), row.entry.name, ...statistics(row)]), `${words(table.kind)} · Published competition table`);
  b.table('Team performance', [{ title: 'Team', width: 380 }, ...STAT_COLUMNS], report.teamPerformance.map(row => [row.entry.name, ...statistics(row)]), 'Verified match score statistics. These statistics do not replace the official group/league table or knockout placements.');
  b.table('Every fixture & result', [{ title: 'Fixture / stage', width: 195 }, { title: 'Home', width: 245 }, { title: 'Official score', width: 155 }, { title: 'Away', width: 245 }, { title: 'Status / date', width: 240 }], report.matches.map(match => [`${match.fixtureCode}\n${match.roundName}\n${match.groupName ?? words(match.phase)}${match.matchday === null ? '' : ` · Day ${match.matchday}`}`, match.home?.name ?? 'Unassigned / bye', score(match), match.away?.name ?? 'Unassigned / bye', `${words(match.status)}\n${date(match.scheduledAt)}${match.score?.confirmedAt ? `\nConfirmed ${date(match.score.confirmedAt)}` : ''}`]));
  b.table('Player match performance', [{ title: 'Player / ID', width: 390 }, { title: 'P', width: 75 }, { title: 'W', width: 75 }, { title: 'D', width: 75 }, { title: 'L', width: 75 }, { title: 'Team GF', width: 100 }, { title: 'Team GA', width: 100 }, { title: 'Win %', width: 100 }, { title: 'Form', width: 90 }], report.players.map(row => [`${row.player.name}\n${row.player.playerCode ?? ''}`, ...[row.matches, row.wins, row.draws, row.losses, row.goalsFor, row.goalsAgainst, row.winRate.toFixed(1), row.form || '-'].map(String)]), 'GF/GA are team scorelines while the player participated. Individual goal-scorer or assist events are not inferred.');
  b.table('Complete team rosters', [{ title: 'Team / group', width: 330 }, { title: 'Registered players', width: 750 }], report.teams.map(entry => [`${entry.name}${entry.groupName ? `\n${entry.groupName}` : ''}`, entry.members.map(member => `${member.name}${member.playerCode ? ` (${member.playerCode})` : ''}`).join('\n') || 'No player membership recorded']));
  return b.finish();
}

function coverText(x: number, y: number, value: string, width: number, maxHeight: number, preferred: number, color: string, weight = 700) {
  let size = preferred, lines = wrapReportText(value, width, size);
  while (size > 18 && lines.length * size * 1.3 > maxHeight) { size -= 1; lines = wrapReportText(value, width, size); }
  return lines.map((line, i) => text(x, y + size + i * size * 1.3, line, size, color, weight)).join('');
}
export function tournamentReportCover(report: TournamentReport): string {
  const parts = [rect(0, 0, 1080, 1350, C.navy), `<circle cx="940" cy="210" r="360" fill="#244158" opacity=".38"/>`, `<path d="M60 90H1020M60 1230H1020" stroke="#bd9851" stroke-width="2"/>`, text(60, 65, 'FC ARENA  /  COMPLETED TOURNAMENT', 24, '#e2c984', 700)];
  parts.push(coverText(60, 125, report.tournament.name, 960, 225, 58, C.white));
  parts.push(coverText(60, 380, `${report.tournament.league.name} · ${report.tournament.code}`, 960, 85, 27, '#c9d8e5', 500));
  parts.push(`<g transform="translate(454 515)" fill="none" stroke="#e1be62" stroke-width="9" stroke-linejoin="round"><path d="M28 4H144V65Q144 135 86 135Q28 135 28 65Z"/><path d="M28 20H0V58Q0 95 43 95M144 20H172V58Q172 95 129 95M86 135V171M52 174H120M40 192H132"/></g>`);
  parts.push(text(540, 785, 'CHAMPIONS', 24, '#e2c984', 700, 'middle'));
  parts.push(coverText(80, 815, entryName(report.placements.champion), 920, 150, 54, C.white));
  parts.push(coverText(80, 985, `Runner-up: ${entryName(report.placements.runnerUp)}`, 920, 90, 27, '#c9d8e5', 500));
  const numbers = [[String(report.overview.teams), 'TEAMS'], [String(report.overview.verifiedMatches), 'MATCHES'], [String(report.overview.totalGoals), 'GOALS']];
  numbers.forEach(([number, label], i) => { const x = 60 + i * 330; parts.push(rect(x, 1110, 300, 98, '#1a354d', 15), text(x + 150, 1150, number, 36, C.white, 750, 'middle'), text(x + 150, 1185, label, 18, '#c3b582', 700, 'middle')); });
  parts.push(text(60, 1275, `Completed ${date(report.tournament.completedAt)}`, 21, '#c9d8e5'), text(60, 1310, 'Full results, standings, awards and rosters are included in the PDF report.', 18, '#94abbc'));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">${parts.join('')}</svg>`;
}

/** A small image-page PDF writer; offsets and stream lengths are bytes, never JS characters. */
export function imagePagesToPdf(images: readonly Buffer[], width = WIDTH, height = HEIGHT): Buffer {
  const count = images.length;
  if (!count || count > PAGE_LIMIT) throw new TournamentReportRenderLimitError();
  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')], offsets = [0]; let length = chunks[0].length;
  const push = (data: Buffer | string) => { const bytes = typeof data === 'string' ? Buffer.from(data, 'ascii') : data; chunks.push(bytes); length += bytes.length; };
  const object = (id: number, parts: Array<Buffer | string>) => { offsets[id] = length; push(`${id} 0 obj\n`); parts.forEach(push); push('\nendobj\n'); };
  object(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
  object(2, [`<< /Type /Pages /Count ${count} /Kids [${images.map((_, i) => `${4 + i * 3} 0 R`).join(' ')}] >>`]);
  images.forEach((bytes, i) => {
    const image = 3 + i * 3, page = image + 1, content = image + 2;
    object(image, [`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`, bytes, '\nendstream']);
    object(page, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.276 841.89] /Resources << /XObject << /I${i} ${image} 0 R >> >> /Contents ${content} 0 R >>`]);
    const commands = `q\n595.276 0 0 841.89 0 0 cm\n/I${i} Do\nQ\n`;
    object(content, [`<< /Length ${Buffer.byteLength(commands)} >>\nstream\n${commands}endstream`]);
  });
  const xref = length;
  push(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  for (let id = 1; id < offsets.length; id++) push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return Buffer.concat(chunks);
}

export async function renderTournamentReport(report: TournamentReport, format: TournamentReportFormat): Promise<RenderedTournamentReport> {
  if (format === 'png') {
    const bytes = await sharp(Buffer.from(tournamentReportCover(report)), { limitInputPixels: 4_194_304 }).png({ compressionLevel: 7 }).toBuffer();
    return { bytes, contentType: 'image/png', pages: 1 };
  }
  const pages = tournamentReportPages(report), images: Buffer[] = []; let total = 0;
  for (const svg of pages) {
    const image = await sharp(Buffer.from(svg), { limitInputPixels: 4_194_304 }).flatten({ background: C.white }).jpeg({ quality: 88, chromaSubsampling: '4:4:4' }).toBuffer();
    total += image.length;
    if (total > BYTE_LIMIT) throw new TournamentReportRenderLimitError();
    images.push(image);
  }
  return { bytes: imagePagesToPdf(images), contentType: 'application/pdf', pages: pages.length };
}

export function tournamentTeamListPages(report: TournamentTeamList): string[] {
  const b = new Book(report);
  b.next('THE TEAM LIST', true);
  b.paragraph(report.tournament.name, 46, C.white, 18, 750);
  b.paragraph(`${report.tournament.league.name}\n${report.tournament.code}`, 26, '#dcc791');
  b.heading(`${report.overview.teams} APPROVED TEAMS`);
  b.paragraph(`${report.overview.players} linked players · ${report.overview.groups} groups\n${words(report.tournament.competitionFormat)} · ${words(report.tournament.mode)}`, 25);
  b.paragraph(`Team list generated ${date(report.generatedAt)}.`, 21);
  if (report.overview.pending) b.paragraph(`${report.overview.pending} applications are awaiting approval and are not included in this approved roster. Export again after approving them for an updated list.`, 22);
  b.table('Complete approved team list', [{ title: '#', width: 60 }, { title: 'Team / group', width: 370 }, { title: 'Players / FC Arena IDs', width: 650 }], report.teams.map((team, i) => [String(i + 1), `${team.name}${team.groupName ? `\n${team.groupName}` : ''}`, team.members.map(member => `${member.name}${member.playerCode ? ` (${member.playerCode})` : ''}`).join('\n') || 'No linked players recorded']));
  return b.finish();
}

export async function renderTournamentTeamList(report: TournamentTeamList, format: TournamentReportFormat): Promise<RenderedTournamentReport> {
  const pages = tournamentTeamListPages(report);
  if (format === 'png') {
    if (pages.length > 12) throw new TournamentReportRenderLimitError();
    const images = [];
    for (const [i, svg] of pages.entries()) images.push({ input: await sharp(Buffer.from(svg)).png().toBuffer(), top: i * HEIGHT, left: 0 });
    const bytes = await sharp({ create: { width: WIDTH, height: HEIGHT * pages.length, channels: 3, background: C.paper } }).composite(images).png({ compressionLevel: 7 }).toBuffer();
    return { bytes, contentType: 'image/png', pages: pages.length };
  }
  const images: Buffer[] = []; let total = 0;
  for (const svg of pages) {
    const image = await sharp(Buffer.from(svg)).flatten({ background: C.white }).jpeg({ quality: 88, chromaSubsampling: '4:4:4' }).toBuffer();
    total += image.length; if (total > BYTE_LIMIT) throw new TournamentReportRenderLimitError(); images.push(image);
  }
  return { bytes: imagePagesToPdf(images), contentType: 'application/pdf', pages: pages.length };
}
