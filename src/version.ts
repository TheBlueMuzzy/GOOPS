// The game's version, one source of truth: version.json → vite.config.ts bakes it in (import.meta.env.GOOPS_VERSION,
// "X.Y.Z.B") and puts <meta name="app-version" content="vX.Y.Z.B"> in the page for tests → everything shows it as
// versionLabel ("vX.Y.Z.B", words in content/text/en.json console.version): the console footer, Settings → About,
// and the Dev Kit's snapshots and bug files (src/devkit-game/goopsAdapter.ts).
import { fill } from './ui/kit'
import text from '../content/text/en.json'

export const VERSION: string = import.meta.env.GOOPS_VERSION ?? 'dev'
export const versionLabel = fill(text.console.version, { v: VERSION })
