// Breakdowns (F23, GDD §5): the console's three machines and their meters.
// Each machine's health is 0..1 (1 = fine) and moves only through the shift's own actions and tick time,
// so it stays pure and dt-driven. Locked machines (rank below their unlock rank) never change.
// The shift engine calls in: tick (time), zapped (cells popped), landed (a piece locked), spun (a tank turn), repair.
// It only calls the meter functions while the shift is 'playing' — during a rupture the meters freeze.
import type { MachineId, MachineState, ShiftEvent } from './types'
import type { Modifiers } from './upgrades'

// The shape of content/tuning/breakdowns.json.
export interface BreakdownConfig {
  consoleTimeScale?: number // read by the game, not the engine
  cooldown: { maxSeconds: number; minSeconds: number; margin: number }
  laser: { unlockRank: number; drainPerCell: number; refillPerPiece: number; repairSliders?: number } // repairSliders: the console's, not the engine's
  visor: { unlockRank: number; graceMs: number; fadeMs: number; breakAt: number; brokenHealth: number; recoverPerSec: number }
  controls: { unlockRank: number; heatPerSpin: number; coolDelayMs: number; coolPerSec: number; repairCorners?: number } // repairCorners: the console's
}

export const MACHINE_IDS: readonly MachineId[] = ['laser', 'visor', 'controls']

const EPSILON = 1e-9 // so 25 × 0.04 counts as exactly empty

export class Machines {
  readonly state: Record<MachineId, MachineState>
  private readonly config: BreakdownConfig | undefined // none = every machine stays locked
  private readonly rank: number // the shift's starting rank
  private readonly mods: Modifiers
  private readonly emit: (event: ShiftEvent) => void
  private visorQuietMs = 0 // time since fast drop was last on (the visor's grace)
  private controlsIdleMs = 0 // time since the last tank turn

  constructor(config: BreakdownConfig | undefined, rank: number, mods: Modifiers, emit: (event: ShiftEvent) => void) {
    this.config = config
    this.rank = rank
    this.mods = mods
    this.emit = emit
    const machine = (id: MachineId): MachineState => ({
      id,
      unlocked: !!config && rank >= config[id].unlockRank,
      health: 1,
      broken: false,
      cooldownMs: 0,
    })
    this.state = { laser: machine('laser'), visor: machine('visor'), controls: machine('controls') }
  }

  isBroken(id: MachineId): boolean {
    return this.state[id].broken
  }

  // ---------------------------------------------------------------- meters (only while playing)

  tick(dt: number, fastDropping: boolean): void {
    const cfg = this.config
    if (!cfg) return
    for (const id of MACHINE_IDS) {
      const m = this.state[id]
      if (m.unlocked) m.cooldownMs = Math.max(0, m.cooldownMs - dt)
    }

    // Visor: fast-dropping recovers it and restarts the grace; otherwise after the grace it fades to breakAt over fadeMs.
    const visor = this.state.visor
    if (fastDropping) {
      this.visorQuietMs = 0
      this.setHealth(visor, visor.health + (cfg.visor.recoverPerSec * dt) / 1000)
    } else {
      this.visorQuietMs += dt
      const fadingMs = Math.min(dt, this.visorQuietMs - cfg.visor.graceMs * this.mods.visorGraceMult)
      if (fadingMs > 0) this.setHealth(visor, visor.health - ((1 - cfg.visor.breakAt) * fadingMs) / cfg.visor.fadeMs)
    }

    // Controls: after coolDelayMs without a turn, heat cools (health rises).
    const controls = this.state.controls
    this.controlsIdleMs += dt
    const coolingMs = Math.min(dt, this.controlsIdleMs - cfg.controls.coolDelayMs)
    if (coolingMs > 0) this.setHealth(controls, controls.health + (cfg.controls.coolPerSec * this.mods.controlsCoolMult * coolingMs) / 1000)
  }

  // Goop cells zapped by the laser drain its capacitor.
  zapped(cells: number): void {
    if (!this.config) return
    const laser = this.state.laser
    this.setHealth(laser, laser.health - cells * this.config.laser.drainPerCell * this.mods.laserDrainMult)
  }

  // A landed piece recharges the capacitor (a broken laser stays broken until repaired).
  landed(): void {
    if (!this.config) return
    const laser = this.state.laser
    this.setHealth(laser, laser.health + this.config.laser.refillPerPiece)
  }

  // Every tank turn heats the controls.
  spun(): void {
    if (!this.config) return
    this.controlsIdleMs = 0
    const controls = this.state.controls
    this.setHealth(controls, controls.health - this.config.controls.heatPerSpin)
  }

  // ---------------------------------------------------------------- repair (works during a rupture too)

  // The console's repair was solved. Only a broken machine can be repaired (false = rejected).
  repair(id: MachineId): boolean {
    const m = this.state[id]
    const cfg = this.config
    if (!cfg || !m.broken) return false
    m.broken = false
    m.health = 1
    const seconds = Math.max(cfg.cooldown.minSeconds, cfg.cooldown.maxSeconds - (this.rank - cfg[id].unlockRank))
    m.cooldownMs = seconds * 1000 * this.mods.breakdownCooldownMult
    if (id === 'visor') this.visorQuietMs = 0
    if (id === 'controls') this.controlsIdleMs = 0
    this.emit({ type: 'repaired', machine: id })
    return true
  }

  // ---------------------------------------------------------------- inside

  // Where each machine breaks, in health terms: laser empty, controls at full heat, visor at its threshold.
  private breakAt(id: MachineId): number {
    return id === 'visor' ? this.config!.visor.breakAt : 0
  }

  // Move a meter. Locked or broken machines don't move. During a cooldown the meter can't reach its break point.
  private setHealth(m: MachineState, value: number): void {
    if (!m.unlocked || m.broken) return
    const breakAt = this.breakAt(m.id)
    const floor = m.cooldownMs > 0 ? breakAt + this.config!.cooldown.margin : 0
    m.health = Math.max(floor, Math.min(1, value))
    if (m.cooldownMs <= 0 && m.health <= breakAt + EPSILON) {
      m.broken = true
      m.health = m.id === 'visor' ? this.config!.visor.brokenHealth : 0
      this.emit({ type: 'breakdown', machine: m.id })
    }
  }
}
