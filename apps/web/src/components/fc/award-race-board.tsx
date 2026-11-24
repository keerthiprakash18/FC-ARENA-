import { FcIcon } from './fc-icons';
import styles from './award-race-board.module.css';

export interface AwardRaceEntry {
  id: string;
  name: string;
  detail?: string;
  position: number;
  matches: number;
  games?: number;
  goals: number;
  goalsPerMatch: number;
  goalsPerGame?: number;
  cleanSheets: number;
  cleanSheetRate?: number;
  goalsAgainstPerMatch: number;
  goalsAgainstPerGame?: number;
}

export function AwardRaceBoard({ kind, entries, title, entryLabel = 'player' }: {
  kind: 'boot' | 'glove';
  entries: AwardRaceEntry[];
  title?: string;
  entryLabel?: 'player' | 'team' | 'entry';
}) {
  const boot = kind === 'boot';
  const leaders = entries.filter(entry => entry.position === 1).length;
  const award = boot ? 'Golden Boot' : 'Golden Glove';

  return (
    <div className={styles.board} data-award={kind}>
      <div className={styles.header}>
        <div>
          {title ? <h3 className={styles.title}><FcIcon name={boot ? 'football' : 'shield'} size={18} />{title}</h3> : null}
          <p className={styles.count} role="status">
            All {entries.length} verified {entries.length === 1 ? entryLabel : entryLabel === 'entry' ? 'entries' : `${entryLabel}s`} ranked
          </p>
        </div>
        <span className={styles.live}><span aria-hidden="true" />Live race</span>
      </div>

      {entries.length ? (
        <ol className={styles.list} aria-label={`${award} standings`}>
          {entries.map(entry => {
            const individualGames = entry.games !== undefined;
            const played = entry.games ?? entry.matches;
            const cleanSheetRate = entry.cleanSheetRate ?? (played > 0 ? Number((entry.cleanSheets / played * 100).toFixed(1)) : 0);
            const stats = [
              { label: 'Matches', value: entry.matches },
              ...(individualGames ? [{ label: 'Games', value: entry.games! }] : []),
              ...(boot
                ? [{ label: individualGames ? 'Goals / game' : 'Goals / match', value: entry.goalsPerGame ?? entry.goalsPerMatch }]
                : [{ label: 'Clean sheet rate', value: `${cleanSheetRate}%` },
                  { label: individualGames ? 'Conceded / game' : 'Conceded / match', value: entry.goalsAgainstPerGame ?? entry.goalsAgainstPerMatch }]),
            ];
            return (
              <li key={entry.id} className={styles.row} data-leading={entry.position === 1}
                aria-label={`${entry.name}, rank ${entry.position}`}>
                <div className={styles.rowTop}>
                  <span className={styles.rank} aria-label={`Rank ${entry.position}`}>{entry.position}</span>
                  <div className={styles.identity}>
                    {entry.position === 1 ? <span className={styles.leader}>{leaders > 1 ? 'Joint leader' : 'Leading the race'}</span> : null}
                    <p className={styles.name}>{entry.name}</p>
                    {entry.detail ? <p className={styles.detail}>{entry.detail}</p> : null}
                  </div>
                  <div className={styles.score} role="group" aria-label={`${boot ? entry.goals : entry.cleanSheets} ${boot ? 'goals' : 'clean sheets'}`}>
                    <strong>{boot ? entry.goals : entry.cleanSheets}</strong>
                    <span>{boot ? 'Goals' : 'Clean sheets'}</span>
                  </div>
                </div>
                <dl className={styles.stats} data-columns={stats.length}>
                  {stats.map(stat => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}
                </dl>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className={styles.empty}>
          <FcIcon name={boot ? 'football' : 'shield'} size={28} />
          <p>No verified results yet</p>
          <span>Confirmed results will populate this race.</span>
        </div>
      )}
    </div>
  );
}
