import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, convexOrigins } from './csp.js';

const directive = (csp: string, name: string) =>
	csp
		.split('; ')
		.find((d) => d.startsWith(name + ' '))
		?.split(' ')
		.slice(1) ?? [];

describe('convexOrigins', () => {
	it('derives the websocket origin from the HTTP one', () => {
		expect(convexOrigins('https://happy-otter-1.convex.cloud')).toEqual([
			'https://happy-otter-1.convex.cloud',
			'wss://happy-otter-1.convex.cloud'
		]);
		expect(convexOrigins('http://127.0.0.1:3210')).toEqual([
			'http://127.0.0.1:3210',
			'ws://127.0.0.1:3210'
		]);
	});

	it('returns nothing for a value that is not a URL', () => {
		expect(convexOrigins('')).toEqual([]);
		expect(convexOrigins('not a url')).toEqual([]);
	});
});

describe('contentSecurityPolicy', () => {
	const csp = contentSecurityPolicy({
		convexUrl: 'https://happy-otter-1.convex.cloud',
		extraImgHosts: 'https://images.unsplash.com',
		formActionHosts: 'https://www.mollie.com'
	});

	it('allows the Convex HTTP and websocket origins for connections', () => {
		expect(directive(csp, 'connect-src')).toEqual(
			expect.arrayContaining([
				"'self'",
				'https://happy-otter-1.convex.cloud',
				'wss://happy-otter-1.convex.cloud',
				'https://api.mapbox.com',
				'https://events.mapbox.com'
			])
		);
	});

	it('allows Mapbox workers via blob: and tiles for images', () => {
		expect(directive(csp, 'worker-src')).toContain('blob:');
		expect(directive(csp, 'img-src')).toEqual(
			expect.arrayContaining(['https://*.tiles.mapbox.com', 'https://images.unsplash.com'])
		);
	});

	it('limits form navigation to self and the checkout host, and forbids framing', () => {
		expect(directive(csp, 'form-action')).toEqual(["'self'", 'https://www.mollie.com']);
		expect(directive(csp, 'frame-ancestors')).toEqual(["'none'"]);
	});

	it('reports violations to the same-origin log endpoint', () => {
		expect(directive(csp, 'report-uri')).toEqual(['/csp-report']);
	});

	it('drops malformed host entries instead of emitting them', () => {
		const out = contentSecurityPolicy({
			convexUrl: 'https://x.convex.cloud',
			extraImgHosts: "https://ok.example javascript:alert(1) 'unsafe-eval' https://a;b"
		});
		expect(directive(out, 'img-src')).toContain('https://ok.example');
		expect(out).not.toMatch(/javascript:|unsafe-eval/);
	});

	it('still produces a policy when the Convex URL is unusable', () => {
		const out = contentSecurityPolicy({ convexUrl: '' });
		expect(directive(out, 'connect-src')).toContain("'self'");
	});
});
