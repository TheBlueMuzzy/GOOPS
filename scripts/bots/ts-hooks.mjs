// Lets plain Node (24+, which strips TypeScript types by itself) run the engine's .ts files.
// The engine writes imports without an extension ("./types", "../engine"), as Vite allows; this hook tries
// "<path>.ts" and then "<path>/index.ts" for those.
// F51: src/progress imports the tuning files as plain `import x from '….json'` (Vite allows it); Node wants
// `with { type: 'json' }`, so .json files are loaded as JSON here.
// Loaded with: node --import ./scripts/bots/ts-register.mjs ...
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  } catch (err) {
    const relative = specifier.startsWith('./') || specifier.startsWith('../')
    if (!relative || /\.[cm]?[jt]s$/.test(specifier)) throw err
    try {
      return await nextResolve(specifier + '.ts', context)
    } catch {
      return nextResolve(specifier + '/index.ts', context)
    }
  }
}

export async function load(url, context, nextLoad) {
  if (url.startsWith('file:') && url.endsWith('.json')) return nextLoad(url, { ...context, importAttributes: { ...context.importAttributes, type: 'json' } })
  return nextLoad(url, context)
}
