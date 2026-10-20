# HUD + messages inventory (F26, 2026-10-18)
Problem (Muzzy, 2026-10-17): his eyes live at the **bottom of the tank** (where goop lands, fills and pops); the top HUD "vanishes" and big messages show up where he isn't looking.

## The remake today (Sprint 04)
| Item | When | Where |
|---|---|---|
| Pressure bar (red > 80%) | always | top-left |
| Tank (integrity) bar (red < 30% / rupture) | always | top-left, under pressure |
| "Cracks n / total" → "Quota met · n" → "Rupture!" | always | top-centre |
| Score | always | top-right, beside the Console button |
| Swap progress bar | while holding swap | middle (banner) |
| Quota-met / rupture toasts | once each | screen centre |
| Machine meters Laser / Signal / Heat | unlocked machines | under the tank (beside it on a sideways phone) |
| Pressure water + line | always | in the tank, from the bottom |
| Cracks (pulse), off-screen crack arrows | always | in the tank / tank edges at the crack's row |
| Landing shadow, primed-laser glow | always | in the tank |
| Visor glitch | visor fading | over the tank |
| Why it ended | report only | end report |

Missing: why a zap was refused (above the line / still filling — engine sends `reject` with no reason), "a machine broke — swipe up to fix", "tank integrity low", pressure near max.

## v1 (archive/goops-v1, 40 cues — full list from the helper report)
Top edge: pressure % (red pulse > 80%), shift score, STORED/NEXT previews (upgrades). Top corners of the tank: laser + heat vertical meters with cooldown seconds. Upper middle: "xN SURGE" combo. Dead centre: blinking red "Laser Malfunction — Fix at Console". Full screen: red pulsing vignette > 90% pressure.
At the action: "+N", "Vented", "SEALED!", "Plugged!" text at the popped group (static, ~1 s); rejected tap = a ±2 px jiggle with a sound, **no words**.
No crack count during play, no quota message, no in-shift reason for the end (cut straight to the console).
Lesson: v1 also put almost everything away from the bottom; its only "at the action" feedback was the pop popups.

## Layouts to try (task 2) — two Settings rows so Muzzy can mix
**Meters (test):** Top (today) · Hug the tank (pressure % tag on the pressure line; integrity = the tank's rim glowing cyan → red, flickering when low; cracks + score as small tags at the tank's bottom corners) · Bottom strip (pressure, tank, cracks and machine meters in one strip right under the tank; score stays top-right).
**Messages (test):** Centre (today) · At the stack (messages appear just above the highest goop, where the eyes are).
New messages in both modes: refused zap with its reason, machine broke → swipe up, integrity low, pressure near max, quota met, rupture + why.
