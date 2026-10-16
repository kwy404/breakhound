import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

interface Seasons {
  ids: string[];
  easter(year: number): Date;
  detect(date: Date, lang?: string): string;
  name(id: string, lang?: string): string;
  resolve(search: string, date: Date, lang: string, off?: (id: string) => boolean): { id: string; on: boolean; forced: boolean };
}

const source = readFileSync(new URL('../assets/seasons/seasons.js', import.meta.url), 'utf8');
const fake: { BreakhoundSeasons?: Seasons } = {};
new Function('window', source)(fake);
const S = fake.BreakhoundSeasons as Seasons;
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

describe('seasons', () => {
  test('Easter Sunday from 2024 to 2030', () => {
    const known = ['2024-03-31', '2025-04-20', '2026-04-05', '2027-03-28', '2028-04-16', '2029-04-01', '2030-04-21'];
    expect([2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => iso(S.easter(y)))).toEqual(known);
  });

  test('fixed windows, inclusive at both ends', () => {
    const cases: [Date, string][] = [
      [d(2026, 12, 29), ''],
      [d(2026, 12, 30), 'newyear'],
      [d(2027, 1, 1), 'newyear'],
      [d(2027, 1, 2), 'newyear'],
      [d(2027, 1, 3), ''],
      [d(2026, 2, 13), ''],
      [d(2026, 2, 14), 'valentine'],
      [d(2026, 2, 15), 'carnival'],
      [d(2026, 6, 12), ''],
      [d(2026, 6, 13), 'junina'],
      [d(2026, 6, 29), 'junina'],
      [d(2026, 6, 30), ''],
      [d(2026, 10, 23), ''],
      [d(2026, 10, 24), 'halloween'],
      [d(2026, 10, 31), 'halloween'],
      [d(2026, 11, 1), ''],
      [d(2026, 12, 17), ''],
      [d(2026, 12, 18), 'christmas'],
      [d(2026, 12, 26), 'christmas'],
      [d(2026, 12, 27), ''],
    ];
    for (const [date, id] of cases) expect(`${iso(date)} ${S.detect(date, 'en-US')}`).toBe(`${iso(date)} ${id}`);
  });

  test('carnival and Easter move with the year', () => {
    // 2026: Easter April 5, Ash Wednesday February 18, carnival from Saturday February 14.
    expect(S.detect(d(2026, 2, 13))).toBe('');
    expect(S.detect(d(2026, 2, 16))).toBe('carnival');
    expect(S.detect(d(2026, 2, 18))).toBe('carnival');
    expect(S.detect(d(2026, 2, 19))).toBe('');
    expect(S.detect(d(2026, 4, 2))).toBe('');
    expect(S.detect(d(2026, 4, 3))).toBe('easter');
    expect(S.detect(d(2026, 4, 5))).toBe('easter');
    expect(S.detect(d(2026, 4, 6))).toBe('');
    // 2027: Easter March 28, Ash Wednesday February 10.
    expect(S.detect(d(2027, 2, 5))).toBe('');
    expect(S.detect(d(2027, 2, 6))).toBe('carnival');
    expect(S.detect(d(2027, 2, 10))).toBe('carnival');
    expect(S.detect(d(2027, 2, 11))).toBe('');
    expect(S.detect(d(2027, 3, 26))).toBe('easter');
    expect(S.detect(d(2027, 3, 29))).toBe('');
  });

  test('Brazilian Portuguese gets June 12 and the Festa Junina name', () => {
    expect(S.detect(d(2026, 6, 12), 'pt-BR')).toBe('valentine');
    expect(S.detect(d(2026, 6, 12), 'en-US')).toBe('');
    expect(S.name('junina', 'pt-BR')).toBe('Festa Junina');
    expect(S.name('junina', 'en-US')).toBe('Midsummer');
    expect(S.name('halloween', 'pt-BR')).toBe('Halloween');
  });

  test('overrides and the off switch', () => {
    const never = () => false;
    expect(S.resolve('?season=christmas', d(2026, 7, 1), 'en', never)).toEqual({ id: 'christmas', on: true, forced: true });
    expect(S.resolve('?a=1&season=off', d(2026, 10, 31), 'en', never)).toEqual({ id: '', on: false, forced: true });
    expect(S.resolve('?season=nope', d(2026, 10, 31), 'en', never)).toEqual({ id: 'halloween', on: true, forced: false });
    expect(S.resolve('', d(2026, 10, 31), 'en', (id) => id === 'halloween')).toEqual({ id: 'halloween', on: false, forced: false });
    expect(S.resolve('', d(2026, 7, 1), 'en', never)).toEqual({ id: '', on: false, forced: false });
  });

  test('stays small', () => {
    const built = readFileSync(new URL('../docs/seasons.js', import.meta.url), 'utf8');
    expect(built.length).toBeLessThan(3072);
    expect(S.ids).toHaveLength(7);
  });
});
