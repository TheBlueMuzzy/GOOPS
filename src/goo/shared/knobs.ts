// Goo knobs live in content/tuning/goo-*.json: numbers by name, plus notes under keys that start with "_".

export type Knobs = Record<string, number>

// Parse a knob file (its text, or the file as imported): keep only the numbers (notes and help text are for people)
export function parseKnobs(json: string | object): Knobs {
  const raw = (typeof json === 'string' ? JSON.parse(json) : json) as Record<string, unknown>
  const out: Knobs = {}
  for (const [k, v] of Object.entries(raw)) if (!k.startsWith('_') && typeof v === 'number' && Number.isFinite(v)) out[k] = v
  return out
}

// setKnobs(): live update. Unknown names are ignored; non-numbers are ignored.
export function mergeKnobs(into: Knobs, values: Record<string, number>): void {
  for (const [k, v] of Object.entries(values)) if (k in into && typeof v === 'number' && Number.isFinite(v)) into[k] = v
}

// Follow the knob file live (the Dev Kit's Tuning sliders): call once per frame. A knob whose value IN THE FILE changed
// since the last call is copied into `into`; the others are left alone, so setKnobs() values (the goo lab's own
// sliders) stay until the file's value for that knob moves. `seen` = the file's values as of the last call.
// (Reading every knob straight from the live file in the physics loop would cost a getter per read, thousands of
// times a frame; this costs one pass over ~40 knobs a frame.)
export function followFile(into: Knobs, file: object, seen: Knobs): void {
  for (const [k, v] of Object.entries(file)) {
    if (k.startsWith('_') || typeof v !== 'number' || !Number.isFinite(v) || seen[k] === v) continue
    seen[k] = v
    if (k in into) into[k] = v
  }
}
