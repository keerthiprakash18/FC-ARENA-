'use client';

import { useState } from 'react';
import { reportDate, reportLabel, type ReportEntry, type ReportMatch, type TournamentReport } from '@/lib/tournament-report';
import styles from './tournament-report.module.css';

function Trophy() {
  return <svg className={styles.trophy} viewBox="0 0 80 96" fill="none" aria-hidden="true"><path d="M20 10h40v20c0 19-8 29-20 29S20 49 20 30V10Z" fill="currentColor" fillOpacity=".13" stroke="currentColor" strokeWidth="2.5"/><path d="M20 16H8v12c0 12 7 19 18 20M60 16h12v12c0 12-7 19-18 20M40 60v17M26 78h28l6 10H20l6-10Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/><path d="m40 23 3.5 7 8 1-5.8 5.6 1.4 8L40 41l-7.1 3.6 1.4-8-5.8-5.6 8-1 3.5-7Z" fill="currentColor"/></svg>;
}
function Crest({ name }: { name: string }) {
  return <span className={styles.crest} aria-hidden="true">{name.split(/\s+/).map(word => word[0]).slice(0, 3).join('').toUpperCase()}</span>;
}
function SectionTitle({ number, title, detail }: { number: string; title: string; detail?: string }) {
  return <div className={styles.sectionTitle}><div><span className={styles.eyebrow}>{number} / Tournament record</span><h2>{title}</h2></div>{detail ? <p>{detail}</p> : null}</div>;
}
function Podium({ label, entry }: { label: string; entry: ReportEntry | null }) {
  return <article className={styles.podiumCard}><span className={styles.eyebrow}>{label}</span><Crest name={entry?.name ?? 'FC'} /><h3>{entry?.name ?? 'Not recorded'}</h3><p>{entry?.members.map(player => player.name).join(' · ') || 'No player details recorded'}</p></article>;
}
function Score({ match }: { match: ReportMatch }) {
  return <article className={styles.match}>
    <p className={styles.matchMeta}>{match.roundName} · {match.fixtureCode}{match.groupName ? ` · ${match.groupName}` : ''}</p>
    <div className={styles.scoreLine}><span>{match.home?.name ?? 'TBD'}</span><strong>{match.score ? `${match.score.home} – ${match.score.away}` : match.status === 'BYE' ? 'BYE' : '—'}</strong><span>{match.away?.name ?? 'TBD'}</span></div>
    <p className={styles.note}>{match.score ? 'Verified result' : reportLabel(match.status)}{match.score?.homePenalties !== null && match.score?.homePenalties !== undefined ? ` · Penalties ${match.score.homePenalties}–${match.score.awayPenalties}` : ''}{match.aggregate ? ` · Aggregate ${match.aggregate.home}–${match.aggregate.away}` : ''}</p>
    {match.scheduledAt ? <p className={styles.note}>{reportDate(match.scheduledAt, true)}</p> : null}
  </article>;
}

export function TournamentReportView({ report }: { report: TournamentReport }) {
  const [matchLimit, setMatchLimit] = useState(40);
  const [playerLimit, setPlayerLimit] = useState(30);
  const champion = report.placements.champion;
  const podium = [<Podium key="champion" label="Champions" entry={champion} />, <Podium key="runners" label="Runners-up" entry={report.placements.runnerUp} />,
    ...report.placements.thirdPlace.map((entry, i) => <Podium key={entry.id} label={report.placements.thirdPlace.length > 1 ? `Joint third · ${i + 1}` : 'Third place'} entry={entry} />)];
  return <div className={styles.report} aria-label="Full tournament report">
    <section className={styles.hero}>
      <div className={styles.masthead}><span className={styles.brand}>FC ARENA</span><span className={styles.edition}>THE TOURNAMENT EDITION · {report.tournament.code}</span></div>
      <p className={`${styles.eyebrow} mt-7`}>Completed competition / Full report</p>
      <h1 className={styles.title}>{report.tournament.name}</h1>
      <p className={styles.meta}>{report.tournament.league.name} · {reportLabel(report.tournament.competitionFormat)} · {reportLabel(report.tournament.mode)}</p>
      <p className={styles.meta}>{reportDate(report.tournament.startAt)} — {reportDate(report.tournament.completedAt ?? report.tournament.endAt)}</p>
      <div className={styles.champion}><Trophy /><div><span className={styles.eyebrow}>The champions</span><h2>{champion?.name ?? 'Placement not recorded'}</h2><p>{champion?.members.map(member => member.name).join(' · ')}</p></div></div>
      <div className={styles.metrics}>{[[report.overview.teams, 'Teams'], [report.overview.verifiedMatches, 'Verified matches'], [report.overview.totalGoals, 'Goals'], [report.overview.averageGoalsPerMatch.toFixed(2), 'Goals / match']].map(([value, title]) => <div className={styles.metric} key={title}><strong>{value}</strong><span>{title}</span></div>)}</div>
    </section>

    {report.integrity.warnings.length ? <aside className={styles.callout} aria-label="Report notes">{report.integrity.warnings.map((warning, i) => <p key={i}>{warning}</p>)}</aside> : null}

    <section className={styles.section}><SectionTitle number="01" title="The final podium" detail={report.placements.source === 'PUBLISHED' ? 'Published tournament honours' : 'Historical competition record'} /><div className={styles.podium}>{podium}</div></section>

    <section className={styles.section}><SectionTitle number="02" title="Individual honours" detail={`${report.awards.length} awards recorded`} />
      {report.awards.length ? <div className={styles.awards}>{report.awards.map(award => <article key={award.id} className={styles.award}><h3>{award.title}</h3><p><strong>{award.player.name}</strong>{award.player.playerCode ?? ''}</p>{award.description ? <p>{award.description}</p> : null}</article>)}</div> : <p className={styles.note}>No individual awards were recorded for this tournament.</p>}
    </section>

    <section className={styles.section}><SectionTitle number="03" title="Final tables" detail={`${report.standings.length} competition tables`} />
      {report.standings.map(table => <div key={table.id} className="mt-6 first:mt-0"><h3 className="text-sm font-bold">{table.name}</h3><div className={styles.tableWrap}><table className={styles.table}><caption className="sr-only">{table.name} final standings</caption><thead><tr><th>Pos</th><th>Team</th>{['P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts'].map(label => <th key={label} className={styles.number}>{label}</th>)}</tr></thead><tbody>{table.rows.map(row => <tr key={row.entry.id}><td>{row.position}</td><td className={styles.name}><strong>{row.entry.name}</strong></td>{[row.played, row.wins, row.draws, row.losses, row.goalsFor, row.goalsAgainst, row.goalDifference, row.points].map((value, i) => <td key={i} className={styles.number}>{value}</td>)}</tr>)}</tbody></table></div></div>)}
      {!report.standings.length ? <p className={styles.note}>This knockout competition has no league table. Its final placements are shown above.</p> : null}
    </section>

    <section className={styles.section}><SectionTitle number="04" title="Every fixture, every result" detail={`${report.matches.length} fixtures · ${report.overview.verifiedMatches} verified`} />
      <div className={styles.matches}>{report.matches.slice(0, matchLimit).map(match => <Score key={match.id} match={match} />)}</div>
      {report.matches.length > matchLimit ? <button type="button" className="mt-4 min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-bold" onClick={() => setMatchLimit(limit => limit + 40)}>Show more results ({report.matches.length - matchLimit} remaining)</button> : null}
      <p className={styles.note}>Only confirmed results contribute to the scores and statistics. Byes and cancelled fixtures are listed separately from verified matches. The PDF includes every fixture.</p>
    </section>

    <section className={styles.section}><SectionTitle number="05" title="Team performance" detail="Across all verified rounds" /><div className={styles.tableWrap}><table className={styles.table}><caption className="sr-only">Team performance across verified matches</caption><thead><tr><th>No.</th><th>Team</th>{['P', 'W', 'D', 'L', 'GF', 'GA', 'GD'].map(label => <th key={label} className={styles.number}>{label}</th>)}</tr></thead><tbody>{report.teamPerformance.map((row, i) => <tr key={row.entry.id}><td>{i + 1}</td><td className={styles.name}><strong>{row.entry.name}</strong></td>{[row.played, row.wins, row.draws, row.losses, row.goalsFor, row.goalsAgainst, row.goalDifference].map((value, n) => <td key={n} className={styles.number}>{value}</td>)}</tr>)}</tbody></table></div></section>

    <section className={styles.section}><SectionTitle number="06" title="Player performance" detail={`${report.players.length} players`} /><div className={styles.tableWrap}><table className={styles.table}><caption className="sr-only">Player performance in this tournament</caption><thead><tr><th>No.</th><th>Player</th><th className={styles.number}>P</th><th className={styles.number}>W</th><th className={styles.number}>D</th><th className={styles.number}>L</th><th className={styles.number}>Win %</th></tr></thead><tbody>{report.players.slice(0, playerLimit).map((row, i) => <tr key={row.player.id}><td>{i + 1}</td><td className={styles.name}><strong>{row.player.name}</strong><small>{row.player.playerCode}</small></td>{[row.matches, row.wins, row.draws, row.losses, `${row.winRate.toFixed(1)}%`].map((value, n) => <td key={n} className={styles.number}>{value}</td>)}</tr>)}</tbody></table></div>
      {report.players.length > playerLimit ? <button type="button" className="mt-4 min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-bold" onClick={() => setPlayerLimit(limit => limit + 30)}>Show more players ({report.players.length - playerLimit} remaining)</button> : null}
      <p className={styles.note}>Team results describe participation performance; they do not represent individual goalscorer events in DUO or TEAM competitions.</p>
    </section>

    <section className={styles.section}><SectionTitle number="07" title="The complete roster" detail={`${report.overview.players} players · ${report.teams.length} teams`} /><div className={styles.teamGrid}>{report.teams.map(team => <article key={team.id} className={styles.team}><h3>{team.name}</h3>{team.groupName ? <p>{team.groupName}</p> : null}<p>{team.members.length ? team.members.map(player => `${player.name}${player.playerCode ? ` · ${player.playerCode}` : ''}`).join('\n') : 'No linked player details recorded.'}</p></article>)}</div></section>
    <footer className={styles.footer}><span>FC ARENA · Play. Compete. Belong.</span><span>Generated {reportDate(report.generatedAt, true)}</span></footer>
  </div>;
}
