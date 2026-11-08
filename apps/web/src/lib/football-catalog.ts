export interface FootballCatalog {
  updatedAt: string;
  leagues: Array<{ id: string; name: string; country: string; clubs: string[] }>;
  nationalTeams: Array<{ id: string; name: string; confederation: string }>;
}
export type FootballTeamKind = 'CLUB' | 'NATIONAL';
export interface FootballTeamOption { id: string; name: string; group: string }

const aliases: Record<string, string> = {
  'Korea Republic': 'South Korea', 'Korea DPR': 'North Korea',
  'IR Iran': 'Iran', 'Côte d’Ivoire': 'Ivory Coast', 'Türkiye': 'Turkey',
  'USA': 'United States of America', 'Congo DR': 'Democratic Republic of Congo',
};
function searchable(text: string) {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[’']/g, '');
}
export function footballTeamOptions(catalog: FootballCatalog, kind: FootballTeamKind, leagueId: string, query: string): FootballTeamOption[] {
  const words = searchable(query.trim()).split(/\s+/).filter(Boolean);
  const options = kind === 'NATIONAL'
    ? catalog.nationalTeams.map(team => ({ id: team.id, name: team.name, group: team.confederation }))
    : catalog.leagues.filter(league => !leagueId || league.id === leagueId).flatMap(league =>
      league.clubs.map(name => ({ id: `${league.id}:${name}`, name, group: `${league.name} · ${league.country}` })));
  return options.filter(team => {
    const text = searchable(`${team.name} ${team.group} ${aliases[team.name] ?? ''}`);
    return words.every(word => text.includes(word));
  });
}
