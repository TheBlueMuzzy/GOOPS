// F56 — what the periscope's goggles look at: the tank on screen (ShiftStage fills these in, the zoom reads them).
// The shift's stage (its canvases, full-screen) stays UNDER the console; the console has a hole where the goggles'
// glass is, and src/game/PeriscopeZoom.tsx moves + scales the stage so its tank lands in that glass. One render of
// the tank, seen through the glass — so whatever later draws over the tank (a pixel shader) shows in the goggles too.
export type TankBox = {
  left: number // CSS px of the visible tank's left edge, in the stage's own (un-zoomed) px
  width: number // its width (all the visible columns)
  floor: number // the y of its floor (the bottom of the visible rows)
}

export const tankWindow = {
  stage: null as HTMLElement | null, // the mounted ShiftStage's host (null = no tank under the console)
  box: null as TankBox | null, // where its tank is, set at every re-fit
}
