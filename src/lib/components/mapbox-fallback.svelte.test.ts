/* With no Mapbox token (PUBLIC_MAPBOX_ACCESS_TOKEN empty) the maps degrade
   quietly: the address picker renders nothing, the tracking map its faux map. */
import { describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';

vi.mock('$app/env/public', () => ({ PUBLIC_CONVEX_URL: 'http://127.0.0.1:1', PUBLIC_MAPBOX_ACCESS_TOKEN: '' }));
// Spy mode: the real module (MAPBOX_TOKEN and helpers) with every export a
// spy, so loadMapbox calls are observable. A factory spreading importOriginal()
// crashes Vitest's browser mocker on Windows paths with spaces ("Blinca Backend").
vi.mock('#lib/mapbox.js', { spy: true });

import AddressMapPicker from './AddressMapPicker.svelte';
import TrackMap from './track/TrackMap.svelte';
import { MAPBOX_TOKEN, loadMapbox } from '#lib/mapbox.js';

const load = vi.mocked(loadMapbox);
import { t } from '#lib/stores/language.svelte.js';

const tr = (over: Record<string, unknown> = {}) => ({
	mode: 'delivery',
	status: 'on_the_way',
	stepIndex: 3,
	final: false,
	cancelled: false,
	distanceKm: 0,
	courier: null,
	courierPos: { x: 20, y: 72 },
	points: { restaurant: { x: 20, y: 72 }, home: { x: 80, y: 26 } },
	restaurant: { name: 'Blinca Demo', address: 'Drottninggatan 1' },
	...over
});

test('the token is empty in this test setup', () => {
	expect(MAPBOX_TOKEN).toBe('');
});

describe('AddressMapPicker without a token', () => {
	test('renders nothing and never loads mapbox-gl', async () => {
		const { container } = render(AddressMapPicker, {});
		expect(container.querySelector('#na-map-search, .am-wrap')).toBeNull();
		expect(load).not.toHaveBeenCalled();
	});
});

describe('TrackMap without a token', () => {
	test('delivery shows the faux map as an image with the status in its label', async () => {
		render(TrackMap, { tr: tr(), address: 'Storgatan 5, Stockholm' });
		await expect.element(page.getByRole('img')).toBeInTheDocument();
		await expect.element(page.getByText('Storgatan 5, Stockholm')).toBeInTheDocument();
		expect(document.querySelector('.map-canvas')).toBeNull();
		expect(load).not.toHaveBeenCalled();
	});

	test('pickup offers directions to the restaurant, not a courier route', async () => {
		render(TrackMap, { tr: tr({ mode: 'pickup', stepIndex: 2, status: 'ready' }) });
		const link = page.getByRole('link', { name: t('track.getDirections') });
		await expect.element(link).toHaveAttribute('href', expect.stringContaining(encodeURIComponent('Drottninggatan 1')));
		expect(document.querySelector('.map-canvas')).toBeNull();
	});

	test('a cancelled order still renders', async () => {
		render(TrackMap, { tr: tr({ cancelled: true, stepIndex: -1, status: 'cancelled', final: true }) });
		await expect.element(page.getByRole('img')).toBeInTheDocument();
	});
});
