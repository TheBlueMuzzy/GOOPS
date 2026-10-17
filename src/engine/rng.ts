// Seeded random numbers (mulberry32). Same seed → same shift. The engine never uses Math.random().

export interface Rng {
  next(): number // 0 <= n < 1
  int(n: number): number // 0..n-1
  chance(p: number): boolean // true with probability p
  pick<T>(items: T[]): T
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (n: number) => Math.floor(next() * n)
  return {
    next,
    int,
    chance: (p) => next() < p,
    pick: (items) => items[int(items.length)],
  }
}
