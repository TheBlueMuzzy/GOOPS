// Start a shift the way a player does since F21: the game opens on the console; tapping the periscope ("Start shift")
// pulls it, the console slides away, and the shift is running once the console is gone.
// F59: from rank 1 a device's first shifts start with an unlock lesson (the next-piece window, then swap) that waits
// for "Got it" with the shift stopped under it. Scripts about something else skip them, as a player who has had them
// would — marked seen on the device first ({ unlockLessons: true } keeps them: e2e/unlocks.mjs).
export async function startShift(page, { unlockLessons = false } = {}) {
  if (!unlockLessons) await page.evaluate(() => window.__goopsSeen?.(['lesson:unlock-window', 'lesson:unlock-swap']))
  await page.getByRole('button', { name: 'Start shift' }).click()
  await page.locator('.kit-art-stage').waitFor({ state: 'detached', timeout: 5000 })
  await page.waitForFunction(() => window.__goops?.engine.state.status === 'playing')
}
