# Ladder — every rank gate in one file

Built in Goops for F78 — One rank ladder file (2026-11-02). Muzzy: "ensure the architecture makes pivots like this
easier (hardcoding stuff can lead to really tough refactors)". Self-contained (no game imports), so it can move into
the framework as a module.

## The idea
- Every "from rank N" in a game is a **named beat** in one file: `"wildGoop": 40`.
- Systems ask `rankOf('wildGoop')`. No system keeps its own `fromRank`.
- Moving a beat = one number. Reshaping the whole climb = numbers in one file.

## The file (a game's `content/tuning/ladder.json`)
| Key | What it is |
|---|---|
| `maxRank` | the top rank (ranks run 0…maxRank) |
| `beats` | `{ name: rank }` — the gates. A plain name is looked up here |
| any other `{ name: rank }` group | e.g. `titles`, `upgrades`, `story` — asked as `"titles.technician"` |
| `grants` | `{ kind: { beat: amount } }` — extra rewards on a beat's rank, e.g. `"scraps": { "veteranCaught": 8 }` |
| `_about`, `_help`, `_ranges`, any `_` key | notes for people and the Dev Kit's Tuning tab (never read here) |

## The API (`createLadder(file)`)
- `rankOf(name)` — a beat's rank. Unknown name → throws a `LadderError` naming the file.
- `has(name)` · `maxRank()` · `beatsAt(rank)` (every name at a rank)
- `group('titles')` → `[{ name, rank }]` in file order · `lastAt('titles', rank)` → the band a rank is in
- `stepAt(steps, rank)` — a step table that names beats: `[{ beat: 'firstDay', count: 4 }, { beat: 'fifthColour', count: 5 }]`
- `grantAt('scraps', rank)` · `grantsAt('scraps', rank)` (each entry on that rank, by name) · `grantsUpTo('scraps', rank)`
- `problems()` — plain-words list of what's wrong (ranks off the ladder, grants on unknown beats); a game's test keeps it empty

## Live (module contract: the Dev Kit changes the running game)
The ladder keeps the file object it was given and reads it on every call — never a copy. With the Dev Kit's Vite
plugin the imported JSON is already a live object, so a Tuning-tab edit applies on the next call. `createLadder` also
takes a function returning the latest file.

## What a game must provide
1. `content/tuning/ladder.json` with `maxRank`, `beats`, a `_help` and a `_ranges` line for every number.
2. One binding file (Goops: `src/progress/ladder.ts`) that makes the ladder from that file and exports `rankOf`.
3. Every system asks the ladder by name; content files name beats (`"beat": "fifthColour"`), never rank numbers.
4. A test that `ladder.problems()` is empty and every group matches what it points at (Goops: `tests/ladder.test.ts`).
