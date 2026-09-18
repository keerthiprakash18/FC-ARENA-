import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  generateKnockoutFixtures,
  generateRoundRobinFixtures,
} from './fixture-engine.js';

function ids(count: number): string[] {
  return Array.from(
    { length: count },
    (_, index) => `ENTRY-${index + 1}`,
  );
}

describe('Round Robin Fixture Engine', () => {
  it('creates exactly 6 fixtures for 4 entries', () => {
    const fixtures =
      generateRoundRobinFixtures(ids(4));

    expect(fixtures).toHaveLength(6);

    const appearances = new Map<string, number>();

    for (const fixture of fixtures) {
      expect(
        fixture.homeRegistrationId,
      ).not.toBe(
        fixture.awayRegistrationId,
      );

      for (const participant of [
        fixture.homeRegistrationId,
        fixture.awayRegistrationId,
      ]) {
        if (!participant) continue;

        appearances.set(
          participant,
          (appearances.get(participant) ?? 0) + 1,
        );
      }
    }

    for (const id of ids(4)) {
      expect(appearances.get(id)).toBe(3);
    }
  });

  it('creates exactly 190 fixtures for 20 entries', () => {
    const fixtures =
      generateRoundRobinFixtures(ids(20));

    expect(fixtures).toHaveLength(190);

    const pairs = new Set<string>();
    const appearances = new Map<string, number>();

    for (const fixture of fixtures) {
      const home =
        fixture.homeRegistrationId;
      const away =
        fixture.awayRegistrationId;

      expect(home).not.toBeNull();
      expect(away).not.toBeNull();
      expect(home).not.toBe(away);

      const pair = [home, away]
        .sort()
        .join(':');

      expect(pairs.has(pair)).toBe(false);

      pairs.add(pair);

      for (const participant of [
        home,
        away,
      ]) {
        if (!participant) continue;

        appearances.set(
          participant,
          (appearances.get(participant) ?? 0) + 1,
        );
      }
    }

    expect(pairs.size).toBe(190);

    for (const id of ids(20)) {
      expect(appearances.get(id)).toBe(19);
    }
  });

  it('handles odd participant count without creating BYE fixtures', () => {
    const fixtures =
      generateRoundRobinFixtures(ids(5));

    expect(fixtures).toHaveLength(10);

    for (const fixture of fixtures) {
      expect(
        fixture.homeRegistrationId,
      ).not.toBeNull();

      expect(
        fixture.awayRegistrationId,
      ).not.toBeNull();
    }
  });
});

describe('Knockout Fixture Engine', () => {
  it('creates n - 1 actual fixtures', () => {
    expect(
      generateKnockoutFixtures(ids(2)),
    ).toHaveLength(1);

    expect(
      generateKnockoutFixtures(ids(5)),
    ).toHaveLength(4);

    expect(
      generateKnockoutFixtures(ids(8)),
    ).toHaveLength(7);

    expect(
      generateKnockoutFixtures(ids(20)),
    ).toHaveLength(19);
  });

  it('creates a final round', () => {
    const fixtures =
      generateKnockoutFixtures(ids(8));

    const finalFixture = fixtures.find(
      (fixture) =>
        fixture.roundName === 'FINAL',
    );

    expect(finalFixture).toBeDefined();
  });
});