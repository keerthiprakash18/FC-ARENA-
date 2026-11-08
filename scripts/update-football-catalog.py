"""Refresh the registration name catalogue from publisher rosters and FIFA associations.

Run manually, review the resulting diff and tests, then ship the snapshot with the app.
No third-party request is made when a player opens registration.
The 50 leagues are an editorial selection, not an official global ranking.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
import argparse
import json
import re
import time
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
SPECS = [
    ('eng.1', 'Premier League', 'England'), ('eng.2', 'EFL Championship', 'England'),
    ('esp.1', 'La Liga', 'Spain'), ('esp.2', 'Segunda División', 'Spain'),
    ('ger.1', 'Bundesliga', 'Germany'), ('ger.2', '2. Bundesliga', 'Germany'),
    ('ita.1', 'Serie A', 'Italy'), ('ita.2', 'Serie B', 'Italy'),
    ('fra.1', 'Ligue 1', 'France'), ('fra.2', 'Ligue 2', 'France'),
    ('por.1', 'Primeira Liga', 'Portugal'), ('ned.1', 'Eredivisie', 'Netherlands'),
    ('ned.2', 'Eerste Divisie', 'Netherlands'), ('sco.1', 'Scottish Premiership', 'Scotland'),
    ('sui.1', 'Swiss Super League', 'Switzerland'), ('bel.1', 'Belgian Pro League', 'Belgium'),
    ('aut.1', 'Austrian Bundesliga', 'Austria'), ('rus.1', 'Russian Premier League', 'Russia'),
    ('tur.1', 'Süper Lig', 'Türkiye'), ('gre.1', 'Super League Greece', 'Greece'),
    ('den.1', 'Danish Superliga', 'Denmark'), ('swe.1', 'Allsvenskan', 'Sweden'),
    ('nor.1', 'Eliteserien', 'Norway'), ('usa.1', 'Major League Soccer', 'USA / Canada'),
    ('usa.usl.1', 'USL Championship', 'USA'), ('mex.1', 'Liga MX', 'Mexico'),
    ('mex.2', 'Liga de Expansión MX', 'Mexico'), ('arg.1', 'Argentine Primera División', 'Argentina'),
    ('arg.2', 'Primera Nacional', 'Argentina'), ('bra.1', 'Brasileirão Série A', 'Brazil'),
    ('bra.2', 'Brasileirão Série B', 'Brazil'), ('chi.1', 'Chilean Primera División', 'Chile'),
    ('col.1', 'Categoría Primera A', 'Colombia'), ('uru.1', 'Uruguayan Primera División', 'Uruguay'),
    ('per.1', 'Liga 1', 'Peru'), ('ecu.1', 'Ecuadorian Serie A', 'Ecuador'),
    ('par.1', 'Paraguayan Primera División', 'Paraguay'), ('bol.1', 'Bolivian Primera División', 'Bolivia'),
    ('ven.1', 'Venezuelan Primera División', 'Venezuela'), ('crc.1', 'Costa Rican Primera División', 'Costa Rica'),
    ('hon.1', 'Liga Nacional', 'Honduras'), ('gua.1', 'Liga Nacional', 'Guatemala'),
    ('slv.1', 'Primera División', 'El Salvador'), ('ksa.1', 'Saudi Pro League', 'Saudi Arabia'),
    ('chn.1', 'Chinese Super League', 'China'), ('jpn.1', 'J1 League', 'Japan'),
    ('ind.1', 'Indian Super League', 'India'), ('ind.2', 'I-League', 'India'),
    ('aus.1', 'A-League Men', 'Australia / New Zealand'), ('rsa.1', 'South African Premiership', 'South Africa'),
]


def fetch(url):
    for attempt in range(2):
        try:
            with urllib.request.urlopen(url, timeout=25) as response:
                return response.read().decode('utf-8')
        except Exception:
            if attempt: raise
            time.sleep(1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', type=Path, default=ROOT / '.cache/team-catalog/sources')
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)

    def cached(name, url):
        path = args.cache / name
        if not path.exists(): path.write_text(fetch(url), encoding='utf-8', newline='\n')
        return path.read_text(encoding='utf-8')

    html = cached('fifa.html', 'https://inside.fifa.com/associations')
    raw = json.loads(re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html).group(1))
    countries = raw['props']['pageProps']['pageData']['content'][0]['countryListProps']
    nations = sorted([{'id': c['url'].rsplit('/', 1)[-1], 'name': c['name'], 'confederation': c['confederation']} for c in countries], key=lambda c: c['name'])
    assert len(nations) == len({n['id'] for n in nations}) == 211, 'Incomplete FIFA association list'

    def league(spec):
        slug, name, country = spec
        url = f'https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/teams?limit=1000'
        data = json.loads(cached(slug + '.json', url))['sports'][0]['leagues'][0]
        assert data['slug'] == slug
        clubs = sorted({t['team']['displayName'] for t in data['teams']
                        if not t['team'].get('isAllStar') and t['team'].get('isActive') is not False
                        and not re.search(r'\b(TBD|TBA|To Be Determined)\b', t['team']['displayName'], re.I)})
        assert 8 <= len(clubs) <= 50, f'Unexpected roster size for {slug}: {len(clubs)}'
        print(f'{name}: {len(clubs)} clubs', flush=True)
        return {'id': slug, 'name': name, 'country': country, 'season': data.get('season', {}).get('displayName', ''), 'source': url, 'clubs': clubs}

    with ThreadPoolExecutor(max_workers=4) as pool: leagues = list(pool.map(league, SPECS))
    assert len(leagues) == len({l['id'] for l in leagues}) == 50
    result = {'updatedAt': datetime.now(timezone.utc).date().isoformat(), 'nationalTeamsSource': 'https://inside.fifa.com/associations', 'leagues': leagues, 'nationalTeams': nations}
    out = ROOT / 'apps/web/src/data/football-teams.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps({'leagues': len(leagues), 'clubs': sum(len(l['clubs']) for l in leagues), 'nationalTeams': len(nations)}))


if __name__ == '__main__': main()
