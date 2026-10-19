// THE GAME'S OWN DEV KIT TOOLS — one tab each, shown after the kit's own tabs (Color, …).
// This file (and everything in src/devkit-game/) belongs to the game: installing or updating the
// Dev Kit never touches it. It only loads with the Dev Kit, so nothing here ships once the Dev Kit is off (1.0).
//
// To add a tool:
//   1. make a component in src/devkit-game/, e.g. TableTab.tsx — it edits a content/ JSON file,
//      with Save (saveContentFile) and Copy for Claude (copyText) from '../devkit/saveContent'
//   2. list it below:  { id: 'table', label: 'Table', Panel: TableTab }
//
// Framework tabs a game can list here: aiTab(…) (../devkit/ai/aiTabEntry), soundTab(getAudio, { file: audioJson })
// (../devkit/sound/soundTabEntry), reviewTab({ id, label, load, save }) (../devkit/review/reviewTabEntry) and
// textTab({ file: 'content/text/en.json', data: en }) (../devkit/text/textTabEntry) — see the Dev Kit README.
//
// To plug the game into Snapshots + Bug capture: write its adapter in src/devkit-game/ (see ../devkit/devkitGame.ts)
// and register it here, once:
//   import { registerDevKitGame } from '../devkit/devkitGame'
//   import { myGameAdapter } from './myGameAdapter'
//   registerDevKitGame(myGameAdapter)
import type { ComponentType } from 'react'
import audioJson from '../../content/audio.json'
import { getAudio } from '../audio'
import { registerDevKitGame } from '../devkit/devkitGame'
import { soundTab } from '../devkit/sound/soundTabEntry'
import { goopsAdapter } from './goopsAdapter'

// Snapshots, Bug capture and the Pause buttons reach the running shift through this (goopsAdapter.ts)
registerDevKitGame(goopsAdapter)

// Sound: every sound in content/audio.json — listen, tune, swap files, the mixer and the log (F29)
export const gameTabs: { id: string; label: string; Panel: ComponentType<{ query?: string }> }[] = [soundTab(getAudio, { file: audioJson })]
