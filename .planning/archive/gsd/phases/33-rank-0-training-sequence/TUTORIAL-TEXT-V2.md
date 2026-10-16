# Tutorial Text V2 — User-Authored

Legend: `[]` = garbled, `'` = green keyword, plain = clear non-keyword

## Messages

**A1_BRIEFING:**
> [Welcome] 'Operator. [You must complete] training [before your first] 'shift.

**A2_PERISCOPE:**
> [Use the] 'periscope [to] look inside [the] 'tank. Drag [it] down [to] start [your shift].

**B1_GOOP_INTRO:**
> [The goop] extruder [drops] 'goop into [the] 'tank. [The goop] drops slowly.

**B2_FAST_FALL:**
> Swipe down or [press] S [to] 'fast-drop. [The] faster [you place it, the] better.

**B3_PIECE_ROTATION:**
> 'Rotate [the goop before it lands]. Tap [the left/right side of the] screen or [press] Q/E [to rotate].

**C1_POP_INTRO:**
> 'Pressure [increases] over time. [Use the] 'laser [to] pop 'goop [to] vent [some of the] 'pressure.

**C2_MERGE:**
> Same color 'goop 'merges [together into] bigger [goop]. Popping bigger [goops] vents more [pressure].

**C3_FILL_TIMING:**
> Fresh 'goop needs [time to] solidify before [it can be] popped. [The] 'pressure must [be] high [enough] as well.

**D1_CRACK_APPEARS:**
> You [have] one job! 'Cracks form in [the] 'tank [wall]. Cover [them with matching] color 'goop. [Then] seal [them] with [the] 'laser.

**D2_TANK_ROTATION:**
> Swipe left/right or [use] A/D to spin [the] 'tank. [This will] align the [falling] 'goop [with the] 'crack.

**D3_OFFSCREEN_CRACKS:**
> [You] only see 1/3 [of the] 'tank [at a time]. 'Cracks [can] form anywhere. Spin [the] 'tank [to] find [the next] crack.

**E1_SCAFFOLDING:**
> 'Cracks [form] higher [as the] 'pressure increases. Stack 'goop [to] reach higher 'cracks.

**F1_CLEANUP:**
> Clear [as much] residual 'goop [as possible] before [the] 'shift end. Don't let [the] 'goop overflow [the top of] the 'tank!

**F2_PRACTICE:**
> We'll turn [the] 'pressure off [so you can] practice. When [you're] done practicing, [just let the goop] overflow [the] 'tank.

---

## Final Flow (14 steps)

| Step | Phase | Name | Advance | Notes |
|------|-------|------|---------|-------|
| A1 | A: Console Briefing | Welcome | tap | |
| A2 | A | Periscope | action: drag-periscope | |
| B1 | B: Goop Basics | Watch goop | event: piece-landed | |
| B2 | B | Fast-drop | action: fast-fall | |
| B3 | B | Rotation | action: rotate-piece | |
| C1 | C: Pressure & Popping | Pressure + laser | action: pop-goop | |
| C2 | C | Merging | event: goop-merged | |
| C3 | C | Solidify timing | tap | |
| D1 | D: Cracks & Sealing | Crack intro + seal | action: pop-goop | on matching crack |
| D2 | D | Tank rotation | action: rotate-tank | |
| D3 | D | Offscreen cracks | tap | |
| E1 | E: Scaffolding | Stack to reach | event: crack-sealed | |
| F1 | F: Endgame | Clear residual | tap | |
| F2 | F | Practice mode | event: game-over | pressure off, infinite play |

## Key Design Changes
- Pressure rises **automatically over time**, NOT from goop volume
- Laser and popping introduced at C1 (earlier)
- Cracks + sealing taught together at D1 (was split across old D1/F1)
- 360° awareness is NOT explicitly taught — player discovers it by rotating
- D3 explains cracks form out of view, spin to find them
- Scaffolding is one step (E1)
- F2 is free-play practice with pressure off — overflow to end and reach rank 1
- 100% pressure = shift ends (not "fail")
