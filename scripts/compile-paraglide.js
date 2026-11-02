// Generates src/lib/paraglide/ (git-ignored) so `check-types` works on a fresh
// clone without first running a dev server or build. The Vite plugin
// regenerates these on dev/build with the same options (see vite.config.ts).
import { compile } from '@inlang/paraglide-js';

await compile({
	project: './project.inlang',
	outdir: './src/lib/paraglide',
	strategy: ['cookie', 'preferredLanguage', 'baseLocale']
});
