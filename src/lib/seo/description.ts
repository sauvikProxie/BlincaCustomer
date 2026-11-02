/** Meta descriptions render best under ~155 characters; search engines cut the rest. */
export const DESCRIPTION_MAX = 155;

/** Cuts at the last word boundary that leaves room for the ellipsis. */
export function truncateAtWord(text: string, max = DESCRIPTION_MAX): string {
	const clean = text.replace(/\s+/g, ' ').trim();
	if (clean.length <= max) return clean;
	const cut = clean.slice(0, max - 1);
	const lastSpace = cut.lastIndexOf(' ');
	// A single very long word has no boundary to cut at; fall back to a hard cut.
	// If the cut lands exactly at the end of a word, keep that word.
	const wordComplete = clean[max - 1] === ' ';
	const head = wordComplete || lastSpace <= 0 ? cut : cut.slice(0, lastSpace);
	return `${head.replace(/[\s,;:.\-–]+$/, '')}…`;
}

type Args = { name: string; cuisines?: string; city?: string };

export type RestaurantDescriptionMessages = {
	full: (a: { name: string; cuisines: string; city: string }) => string;
	noCity: (a: { name: string; cuisines: string }) => string;
	noCuisine: (a: { name: string; city: string }) => string;
	bare: (a: { name: string }) => string;
};

/** Picks the message that has no empty "( )" or "i " when cuisines or city are missing. */
export function restaurantDescription(
	{ name, cuisines, city }: Args,
	msgs: RestaurantDescriptionMessages
): string {
	const c = cuisines?.trim();
	const t = city?.trim();
	const text =
		c && t
			? msgs.full({ name, cuisines: c, city: t })
			: c
				? msgs.noCity({ name, cuisines: c })
				: t
					? msgs.noCuisine({ name, city: t })
					: msgs.bare({ name });
	return truncateAtWord(text);
}
