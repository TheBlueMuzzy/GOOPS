// Registers ts-hooks.mjs (extensionless .ts imports) for this process and its worker threads.
import { register } from 'node:module'
register('./ts-hooks.mjs', import.meta.url)
