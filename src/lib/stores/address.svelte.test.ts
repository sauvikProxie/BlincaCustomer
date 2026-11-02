/*
 * Address store saves. Real-mode rows go through the registered Convex
 * mutations (createMyAddress / updateMyAddress) — no local shadow copy — and a
 * failed save leaves the list untouched instead of half-writing it.
 */
import { beforeEach, describe, expect, test } from 'vitest';
import {
	addAddress,
	addressId,
	allAddresses,
	setAddressCache,
	setAddressMutations,
	updateAddress
} from './address.svelte.js';
import { setSession } from './session.svelte.js';

/** @param {any} over */
function row(over = {}) {
	return {
		_id: 'a1',
		label: 'Hem',
		street: 'Gatan 1',
		postalCode: '111 22',
		city: 'Stockholm',
		isDefault: true,
		...over
	};
}

const DRAFT = {
	label: 'Hem',
	street: 'Gatan 1',
	zip: '111 22',
	city: 'Stockholm',
	extraEta: 10
};

describe('address saves', () => {
	let calls: { create: Record<string, unknown>[]; update: Record<string, unknown>[] };
	beforeEach(() => {
		window.localStorage.clear();
		setSession({ id: 'c1' }, null);
		setAddressCache([]);
		calls = { create: [], update: [] };
		setAddressMutations({
			create: async (args: Record<string, unknown>) => {
				calls.create.push(args);
				return 'new1';
			},
			update: async (args: Record<string, unknown>) => {
				calls.update.push(args);
				return null;
			}
		});
	});

	test('add does not list the row twice when the live query lands first', async () => {
		setAddressMutations({
			create: async () => {
				setAddressCache([row({ _id: 'new1' })]);
				return 'new1';
			},
			update: async () => null
		});
		await addAddress({ ...DRAFT });
		expect(allAddresses().filter((a: { id: string }) => a.id === 'new1')).toHaveLength(1);
	});

	test('add saves through the backend, maps zip → postalCode, pins and selects it', async () => {
		const a = await addAddress({ ...DRAFT, lat: 59.3, lng: 18.1 });

		expect(calls.create).toEqual([
			{ label: 'Hem', street: 'Gatan 1', postalCode: '111 22', city: 'Stockholm', lat: 59.3, lng: 18.1 }
		]);
		expect(a.id).toBe('new1');
		expect(addressId()).toBe('new1');
		const all = allAddresses();
		expect(all).toHaveLength(1);
		expect(all[0].id).toBe('new1');
		expect(all[0]._id).toBe('new1');
		expect(all[0].street).toBe('Gatan 1');
	});

	test('a failed add throws and saves nothing', async () => {
		setAddressMutations({
			create: async () => {
				throw new Error('nope');
			}
		});
		await expect(addAddress({ ...DRAFT })).rejects.toThrow('nope');
		expect(allAddresses()).toHaveLength(0);
	});

	test('edit saves in place, keeping id and default flag', async () => {
		setAddressCache([row()]);
		await updateAddress('a1', {
			label: 'Jobb',
			street: 'Nya gatan 5',
			zip: '333 44',
			city: 'Solna',
			extraEta: 10,
			lat: 59.3,
			lng: 18.1
		});

		expect(calls.update).toEqual([
			{
				addressId: 'a1',
				label: 'Jobb',
				street: 'Nya gatan 5',
				postalCode: '333 44',
				city: 'Solna',
				lat: 59.3,
				lng: 18.1
			}
		]);
		const all = allAddresses();
		expect(all).toHaveLength(1);
		expect(all[0].id).toBe('a1');
		expect(all[0].street).toBe('Nya gatan 5');
		expect(all[0].isDefault).toBe(true);
	});

	test('a missing pin is omitted, so an edit keeps the saved coordinates', async () => {
		setAddressCache([row({ lat: 59.3, lng: 18.1 })]);
		await updateAddress('a1', { ...DRAFT, lat: null, lng: null });
		expect('lat' in calls.update[0]!).toBe(false);
		expect('lng' in calls.update[0]!).toBe(false);
	});

	test('a failed edit throws and leaves the row unchanged', async () => {
		setAddressCache([row()]);
		setAddressMutations({
			update: async () => {
				throw new Error('nope');
			}
		});
		await expect(updateAddress('a1', { street: 'X' })).rejects.toThrow('nope');
		expect(allAddresses()[0].street).toBe('Gatan 1');
	});

	test('a backend re-push wins over the local mirror', async () => {
		setAddressCache([row()]);
		await updateAddress('a1', { street: 'Nya gatan 5' });
		setAddressCache([row({ street: 'Nya gatan 5' })]);
		const all = allAddresses();
		expect(all).toHaveLength(1);
		expect(all[0].street).toBe('Nya gatan 5');
	});
});

describe('selected address', () => {
	beforeEach(() => {
		window.localStorage.clear();
		setSession({ id: 'c1' }, null);
	});

	test('with nothing stored, the default saved address is the selected one', () => {
		setAddressCache([row({ _id: 'a1', isDefault: false }), row({ _id: 'a2', isDefault: true })]);
		expect(addressId()).toBe('a2');
	});

	test('with no default flag, the first saved address is selected', () => {
		setAddressCache([row({ _id: 'a1', isDefault: false }), row({ _id: 'a2', isDefault: false })]);
		expect(addressId()).toBe('a1');
	});

	test('a stored pick that still exists wins over the default', () => {
		setAddressCache([row({ _id: 'a1', isDefault: true }), row({ _id: 'a2', isDefault: false })]);
		window.localStorage.setItem('blinca.v1.address', JSON.stringify('a2'));
		expect(addressId()).toBe('a2');
	});
});
