import { z } from 'zod';

/**
 * Shared credential schemas. Only ever a first pass for inline UI feedback —
 * Convex stays the source of truth (packages/backend/convex/lib/validation.ts
 * and Better Auth's own checks), so anything rejected here is also rejected
 * server-side.
 *
 * Error values are Paraglide message keys rather than sentences, so the page
 * can render them in whichever locale is active. See messages/{sv,en}.json.
 */
export const emailField = z
	.string()
	.trim()
	.min(1, { message: 'login_error_email_required' })
	.pipe(z.email({ message: 'login_error_email_invalid' }));

/** 8 characters matches Better Auth's `minPasswordLength` default. */
export const passwordField = z
	.string()
	.min(1, { message: 'login_error_password_required' })
	.min(8, { message: 'login_error_password_too_short' });

export const loginSchema = z.object({
	email: emailField,
	password: passwordField
});

export type LoginInput = z.infer<typeof loginSchema>;
export type LoginFieldErrors = Partial<Record<keyof LoginInput, string>>;

/** Flattens a failed parse into one message key per field. */
export function loginFieldErrors(error: z.ZodError<LoginInput>): LoginFieldErrors {
	const errors: LoginFieldErrors = {};
	for (const issue of error.issues) {
		const field = issue.path[0];
		if ((field === 'email' || field === 'password') && !errors[field]) {
			errors[field] = issue.message;
		}
	}
	return errors;
}
