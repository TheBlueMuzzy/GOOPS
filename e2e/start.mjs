// Start a shift the way a player does since F21: the game opens on the console; tapping the periscope ("Start shift")
// pulls it, the console slides away, and the shift is running once the console is gone.
export async function startShift(page) {
  await page.getByRole('button', { name: 'Start shift' }).click()
  await page.locator('.kit-art-stage').waitFor({ state: 'detached', timeout: 5000 })
  await page.waitForFunction(() => window.__goops?.engine.state.status === 'playing')
}
