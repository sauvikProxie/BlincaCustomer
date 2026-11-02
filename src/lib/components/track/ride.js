/**
 * Advance the courier's progress along the route toward `target`.
 *
 * Exponential ease with a short time constant: smooth, monotonic and never
 * overshooting. A target at or behind the current progress (or a non-positive
 * frame gap) leaves progress untouched, so the marker cannot jump backward.
 *
 * @param {number} progress current 0..1
 * @param {number} target desired 0..1
 * @param {number} dt milliseconds since the last frame
 * @returns {number} 0..1
 */
export function easeProgress(progress, target, dt) {
	if (dt <= 0 || target <= progress) return progress;
	return progress + (target - progress) * (1 - Math.exp(-dt / 300));
}
