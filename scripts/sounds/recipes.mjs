// Goops recorded sounds: output file -> layers from the CC0 packs (paths inside %TEMP%/goops-sfx)
// layer: src, start/dur (s), gain (dB, relative to the layer's own peak), at (ms), pitch (st), glideTo (st), af (ffmpeg filter), toD, fadeOutMs
const W = 'rdwater/', D = 'rd100/', M = 'rdmetal/', G = 'rdrpg/'
const I = 'impact/Audio/', C = 'casino/Audio/', P = 'rpg/Audio/', U = 'uiaudio/Audio/', S = 'swish/swishes/'

export default {
  // goo: wet slime squelch + a small soft thud under it
  'sfx/sfx_goop_land_01.mp3': { layers: [{ src: W + 'slime_01.ogg' }, { src: I + 'impactSoft_medium_000.ogg', gain: -8 }], maxSec: 0.45, fadeOutMs: 80 },
  'sfx/sfx_goop_land_02.mp3': { layers: [{ src: W + 'slime_04.ogg' }, { src: I + 'impactSoft_medium_001.ogg', gain: -8 }], maxSec: 0.45, fadeOutMs: 80 },
  'sfx/sfx_goop_land_03.mp3': { layers: [{ src: W + 'slime_15.ogg' }, { src: I + 'impactSoft_medium_002.ogg', gain: -8 }], maxSec: 0.45, fadeOutMs: 80 },
  'sfx/sfx_goop_merge_01.mp3': { layers: [{ src: W + 'slime_12.ogg', pitch: 1 }], maxSec: 0.3, fadeOutMs: 60 },
  'sfx/sfx_goop_merge_02.mp3': { layers: [{ src: W + 'slime_16.ogg', pitch: 1 }], maxSec: 0.3, fadeOutMs: 80 },
  // ladder: one real plop, tuned to D (the ladder's key)
  'sfx/sfx_goop_ready_01.mp3': { layers: [{ src: D + 'plop_01.ogg', toD: true }], maxSec: 0.3, fadeOutMs: 60 },
  // pop: a short splash with a plop on the front
  'sfx/sfx_goop_pop_01.mp3': { layers: [{ src: W + 'splash_09.ogg' }, { src: D + 'plop_01.ogg', gain: -6 }], maxSec: 0.5, fadeOutMs: 100 },
  'sfx/sfx_goop_pop_02.mp3': { layers: [{ src: W + 'splash_10.ogg' }, { src: D + 'plop_01.ogg', gain: -6, pitch: 2 }], maxSec: 0.5, fadeOutMs: 100 },
  'sfx/sfx_goop_pop_03.mp3': { layers: [{ src: W + 'splash_06.ogg' }, { src: D + 'plop_01.ogg', gain: -6, pitch: -2 }], maxSec: 0.5, fadeOutMs: 100 },
  // poke: a muffled little squish (jelly that won't give)
  'sfx/sfx_goop_poke_01.mp3': { layers: [{ src: W + 'slime_05.ogg', pitch: 2, af: 'lowpass=f=2500' }], maxSec: 0.25, fadeOutMs: 80 },
  'sfx/sfx_goop_poke_02.mp3': { layers: [{ src: W + 'slime_14.ogg', pitch: 2, af: 'lowpass=f=2500' }], maxSec: 0.25, fadeOutMs: 80 },
  // cracks: glassy tick; seal = a wet plug and a metal-plate thunk
  'sfx/sfx_crack_form_01.mp3': { layers: [{ src: M + 'wood_cracking_01.ogg', pitch: 3 }, { src: I + 'impactGlass_light_001.ogg', gain: -7 }], maxSec: 0.22, fadeOutMs: 50 },
  'sfx/sfx_crack_form_02.mp3': { layers: [{ src: M + 'wood_cracking_04.ogg', pitch: 3 }, { src: I + 'impactGlass_light_003.ogg', gain: -7 }], maxSec: 0.22, fadeOutMs: 50 },
  'sfx/sfx_crack_seal_01.mp3': { layers: [{ src: I + 'impactPlate_heavy_001.ogg' }, { src: W + 'slime_13.ogg', gain: -8 }], maxSec: 0.5, fadeOutMs: 100 },
  // the piece and the tank: plastic and ratchet clicks, swishes
  'sfx/sfx_piece_rotate_01.mp3': { layers: [{ src: C + 'chip-lay-1.ogg' }], maxSec: 0.15, fadeOutMs: 40 },
  'sfx/sfx_tank_spin_01.mp3': { layers: [{ src: D + 'other_01.ogg', start: 0.24, dur: 0.07 }], fadeOutMs: 30 },
  'sfx/sfx_tank_spin_02.mp3': { layers: [{ src: D + 'other_01.ogg', start: 0.32, dur: 0.06 }], fadeOutMs: 30 },
  'sfx/sfx_piece_swap_01.mp3': { layers: [{ src: S + 'swish-12.wav', keepLead: true }, { src: C + 'chip-lay-2.ogg', at: 70, gain: -3 }], maxSec: 0.3, fadeOutMs: 60 },
  'sfx/sfx_piece_drop_01.mp3': { layers: [{ src: S + 'swish-7.wav', pitch: -4, keepLead: true }], fadeOutMs: 60 },
  // machines break: a motor winding down + a fizz; static + a cracked visor; a sputtering motor + hiss
  'sfx/sfx_laser_break_01.mp3': { layers: [{ src: D + 'machine_02.ogg', glideTo: -14, fadeOutMs: 200 }, { src: G + 'spell_fire_02.ogg', gain: -6, dur: 0.6, fadeOutMs: 250 }], maxSec: 0.85, fadeOutMs: 150 },
  'sfx/sfx_visor_break_01.mp3': { layers: [{ src: D + 'noise_01.ogg' }, { src: I + 'impactGlass_light_004.ogg', gain: -5 }], maxSec: 0.6, fadeOutMs: 120 },
  'sfx/sfx_controls_break_01.mp3': { layers: [{ src: D + 'machine_03.ogg', glideTo: -5 }, { src: G + 'spell_fire_04.ogg', gain: -5, at: 250, dur: 0.6, fadeOutMs: 250 }], maxSec: 0.9, fadeOutMs: 150 },
  // fixed: a metal latch, then a small motor winding up
  'sfx/sfx_machine_fix_01.mp3': { layers: [{ src: P + 'metalLatch.ogg' }, { src: D + 'machine_01.ogg', pitch: -10, glideTo: 0, at: 60, gain: -10, dur: 0.45, fadeOutMs: 150 }], maxSec: 0.6, fadeOutMs: 120 },
  // rupture: glass bursts, a big splash, a low blast
  'sfx/sfx_tank_rupture_01.mp3': { layers: [{ src: I + 'impactGlass_heavy_000.ogg' }, { src: W + 'splash_01.ogg', gain: -2, at: 30 }, { src: D + 'explosion.ogg', gain: -5, pitch: -3 }], maxSec: 1.7, fadeOutMs: 400 },
  // stingers: real bells (pitched into a rising ding-ding / three-note rise), coins; lost = a low gong with a clatter
  'sfx/sfx_shift_quota_01.mp3': { layers: [{ src: D + 'bell_02.ogg' }, { src: D + 'bell_02.ogg', pitch: 5, at: 130 }, { src: G + 'item_coins_02.ogg', gain: -9, at: 40 }], maxSec: 0.9, fadeOutMs: 250 },
  'sfx/sfx_shift_won_01.mp3': { layers: [{ src: D + 'bell_01.ogg' }, { src: D + 'bell_01.ogg', pitch: 4, at: 160, gain: -1 }, { src: D + 'bell_01.ogg', pitch: 7, at: 320, gain: -1 }, { src: G + 'item_coins_04.ogg', gain: -10, at: 60 }], maxSec: 1.6, fadeOutMs: 500 },
  'sfx/sfx_shift_lost_01.mp3': { layers: [{ src: D + 'gong_02.ogg', pitch: -3 }, { src: M + 'metal_falling_02.ogg', gain: -10, at: 120 }], maxSec: 1.5, fadeOutMs: 500 },
  // console: a heavy switch + a plate thunk; a small switch; a dull bonk; a metal click (press / release); a toggle switch
  'ui/ui_periscope_pull_01.mp3': { layers: [{ src: D + 'switch_02.ogg' }, { src: I + 'impactPlate_heavy_000.ogg', gain: -4, at: 20, pitch: -3 }], maxSec: 0.5, fadeOutMs: 120 },
  'ui/ui_repair_step_01.mp3': { layers: [{ src: D + 'switch_02.ogg', pitch: 3 }], maxSec: 0.2, fadeOutMs: 60 },
  'ui/ui_repair_wrong_01.mp3': { layers: [{ src: I + 'impactPlank_medium_001.ogg', pitch: -3 }, { src: I + 'impactTin_medium_001.ogg', gain: -8, pitch: -5 }], maxSec: 0.25, fadeOutMs: 80 },
  'ui/ui_button_tap_01.mp3': { layers: [{ src: P + 'metalClick.ogg', start: 0.09, dur: 0.1 }], fadeOutMs: 30 },
  'ui/ui_button_back_01.mp3': { layers: [{ src: P + 'metalClick.ogg', start: 0.26, dur: 0.12, pitch: -2 }], fadeOutMs: 30 },
  'ui/ui_toggle_on_01.mp3': { layers: [{ src: D + 'switch_01.ogg', pitch: 1 }], maxSec: 0.15, fadeOutMs: 40 },
  'ui/ui_toggle_off_01.mp3': { layers: [{ src: D + 'switch_01.ogg', pitch: -2 }], maxSec: 0.15, fadeOutMs: 40 },
}
