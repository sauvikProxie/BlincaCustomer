export type RefundStatus = 'requested' | 'processing' | 'succeeded' | 'failed';
export type RefundStepState = 'done' | 'current' | 'todo' | 'failed';

const PATH: RefundStatus[] = ['requested', 'processing', 'succeeded'];

/** The refund as a three-step path; a failed refund ends in a failed last step. */
export function refundSteps(status: string): { key: RefundStatus; state: RefundStepState }[] {
	const failed = status === 'failed';
	const at = failed ? 1 : Math.max(0, PATH.indexOf(status as RefundStatus));
	return PATH.map((key, i) => {
		if (failed && i === 2) return { key: 'failed' as const, state: 'failed' as const };
		if (status === 'succeeded' || i < at) return { key, state: 'done' as const };
		return { key, state: i === at ? ('current' as const) : ('todo' as const) };
	});
}
