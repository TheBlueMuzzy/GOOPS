// Goo knobs live in content/tuning/goo-*.json: numbers by name, plus notes under keys that start with "_".

export type Knobs = Record<string, number>

// Parse a knob file: keep only the numbers (notes and help text are for people)
export function parseKnobs(json: string): Knobs {
  const raw = JSON.parse(json) as Record<string, unknown>
  const out: Knobs = {}
  for (const [k, v] of Object.entries(raw)) if (!k.startsWith('_') && typeof v === 'number' && Number.isFinite(v)) out[k] = v
  return out
}

// setKnobs(): live update. Unknown names are ignored; non-numbers are ignored.
export function mergeKnobs(into: Knobs, values: Record<string, number>): void {
  for (const [k, v] of Object.entries(values)) if (k in into && typeof v === 'number' && Number.isFinite(v)) into[k] = v
}
