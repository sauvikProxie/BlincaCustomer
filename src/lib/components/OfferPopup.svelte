<script>
	/* Invisible controller: shows the offers popup ~6s after an eligible page loads. */
	import { page } from '#app/state';
	import { goto } from '#app/navigation';
	import { layers, openModal, toast } from '#lib/layers.svelte.js';
	import NewOfferModal from '#lib/components/NewOfferModal.svelte';
	import { t } from '#lib/stores/language.svelte.js';
	import { isHomePath, isRestaurantPath } from '#lib/routes.js';
	import { ensureInit, offers, newOffers, markAllSeen, flashOffer, offerKey } from '#lib/stores/offers.svelte.js';

	const DELAY = 6000;

	// Re-run as offers arrive: the first-visit baseline needs the loaded list.
	$effect(() => {
		void offers().length;
		ensureInit();
	});

	/** @param {string} code */
	function showOffers(code) {
		flashOffer(code);
		if (location.pathname === '/') {
			document.getElementById('offers')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		} else {
			goto('/#offers');
		}
	}

	/* Schedule per eligible navigation (home + restaurant only → checkout/login/error excluded).
	   Matched on the pathname: route.id carries the (app) group, so it never equals '/'. */
	$effect(() => {
		const path = page.url.pathname;
		if (!isHomePath(path) && !isRestaurantPath(path)) return;

		const timer = setTimeout(() => {
			if (layers.some((l) => !l.closing)) return; // another modal/drawer is open
			// Never steal focus from someone who is typing (search, promo code…).
			if (document.activeElement?.matches('input, textarea, select')) return;
			const list = newOffers(); // active offers this customer has not seen yet
			if (!list.length) return;
			const codes = list.map(offerKey);
			openModal(
				NewOfferModal,
				{ list },
				{
					className: 'modal-offer',
					label: t('offer.newOffer'),
					onClose: () => {
						markAllSeen(codes);
						toast(t('offer.saved'), { label: t('offer.show'), onClick: () => showOffers(codes[0]) });
					}
				}
			);
		}, DELAY);

		return () => clearTimeout(timer);
	});
</script>
