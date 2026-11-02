import { describe, expect, test } from 'vitest';
import { dateKey, dayRanges, dishPrice, fmtDate, fmtTime, kr } from '#lib/format.js';

// 2026-10-26 is a Monday; the source hours array runs Mon..Sun.
const monday = new Date(2026, 9, 26, 12, 0, 0);

/** @type {{ hours: (string[]|null)[], specialDays?: { date: string, ranges: string[][] }[] }} */
const r = {
	hours: [
		['11:00', '14:00'],
		null,
		['11:00', '22:00'],
		['11:00', '22:00'],
		['11:00', '22:00'],
		['12:00', '23:00'],
		null
	]
};

describe('dateKey', () => {
	test('formats the local calendar date the way special days are stored', () => {
		expect(dateKey(monday)).toBe('2026-10-26');
		expect(dateKey(new Date(2026, 0, 3))).toBe('2026-01-03');
	});
});

describe('dayRanges', () => {
	test('returns the weekday row', () => {
		expect(dayRanges(r, monday)).toEqual([['11:00', '14:00']]);
	});

	test('a null weekday row is closed', () => {
		expect(dayRanges(r, new Date(2026, 9, 27))).toEqual([]);
	});

	test('a closed special day closes a normally open day', () => {
		const closed = { ...r, specialDays: [{ date: '2026-10-26', ranges: [] }] };
		expect(dayRanges(closed, monday)).toEqual([]);
	});

	test('an open special day replaces the weekday row', () => {
		const special = { ...r, specialDays: [{ date: '2026-10-26', ranges: [['10:00', '12:00']] }] };
		expect(dayRanges(special, monday)).toEqual([['10:00', '12:00']]);
	});

	test('a special day on another date is ignored', () => {
		const other = { ...r, specialDays: [{ date: '2026-12-24', ranges: [] }] };
		expect(dayRanges(other, monday)).toEqual([['11:00', '14:00']]);
	});

	test('a restaurant without specialDays falls back to the weekday', () => {
		expect(dayRanges({ hours: r.hours }, monday)).toEqual([['11:00', '14:00']]);
		expect(dayRanges({ hours: r.hours }, new Date(2026, 9, 27))).toEqual([]);
	});
});

describe('fmtTime / fmtDate', () => {
	// 22:30 UTC is 23:30 in Stockholm (CET, UTC+1 after the 25 Oct DST change), whatever the host zone.
	const instant = Date.UTC(2026, 9, 25, 22, 30);

	test('always renders Stockholm time', () => {
		expect(fmtTime(instant, 'sv')).toBe('23:30');
		expect(fmtDate(instant, 'en', { day: 'numeric', month: 'short' })).toBe('25 Oct');
		expect(fmtDate(Date.UTC(2026, 9, 25, 23, 30), 'sv', { day: 'numeric' })).toBe('26');
	});

	test('accepts a locale tag as well as a short code', () => {
		expect(fmtTime(instant, 'sv-SE')).toBe(fmtTime(instant, 'sv'));
	});
});

describe('kr', () => {
	test('keeps whole and decimal amounts short', () => {
		expect(kr(149)).toBe('149 kr');
		expect(kr(62.5)).toBe('62,50 kr');
		expect(kr(0)).toBe('0 kr');
		expect(kr(NaN)).toBe('0 kr');
	});

	test('groups thousands with a non-breaking space', () => {
		expect(kr(1234)).toBe('1\u00a0234 kr');
		expect(kr(12345.5)).toBe('12\u00a0345,50 kr');
	});
});

describe('dishPrice', () => {
	test('"from" the cheapest size for an item with sizes, the plain price otherwise', () => {
		expect(dishPrice({ price: 25, from: true })).toMatch(/^(från|from) 25/);
		expect(dishPrice({ price: 25 })).toBe(kr(25));
	});
});
