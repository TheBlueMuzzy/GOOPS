// F65 THE END-GAME SCREEN (design/story.md "The ending" step 7): after the empty console, Muzzy's art/EndGameScreen.svg
// (served from public/art by art-prep: his frame, the rank meter run full, the four stat boxes) with the game's words
// where his mock-up's were (content/ui/art.json endGame; words en.json ending.endScreen): the goop is free, your new
// title, the top rank, the former employees freed and the careers done, then the valve, the debt, the tanks and the
// speaker. The button where his swipe arrow was begins the new career (src/game/newCareer.ts).
import { Fragment } from 'react'
import { ArtLayer, ArtStage, Button, Row, Screen, fill } from './kit'
import { art } from './art'
import { operatorName } from '../progress/save'
import endingTuning from '../../content/tuning/ending.json'
import text from '../../content/text/en.json'

type Props = { rank: number; stages: number; careers: number; onNewCareer(): void }

export function EndGameScreen({ rank, stages, careers, onNewCareer }: Props) {
  const W = text.ending.endScreen, g = art.endGame, w = g.words
  const name = operatorName()
  const title = text.story.titles.savior
  const boxes: [string, string][] = [[W.stages, `${stages} / ${stages}`], [W.debt, W.debtValue], [W.tanks, W.tanksValue], [W.speaker, W.speakerValue]]
  return (
    <Screen label={W.title} column backdrop={art.console.backdrop}>
      <ArtStage size={g.size} label={W.title}>
        <ArtLayer src={g.src} at={[0, 0, g.size[0], g.size[1]]} />
        <ArtLayer {...w.title} tone="accent" align="center"><span data-tag="end-title">{W.title}</span></ArtLayer>
        <ArtLayer {...w.subtitle} tone="primary" align="center">{name ? fill(W.subtitleNamed, { name, title }) : title}</ArtLayer>
        <ArtLayer {...w.rankLabel} tone="primary" align="start">{W.rank}</ArtLayer>
        <ArtLayer {...w.rankValue} align="start">{rank}</ArtLayer>
        <ArtLayer {...w.topRank} tone="muted" align="end">{W.topRank}</ArtLayer>
        <ArtLayer {...w.freedLabel} tone="primary" align="center">{W.freed}</ArtLayer>
        <ArtLayer {...w.freedValue} align="center">{endingTuning.paidBy.toLocaleString('en')}</ArtLayer>
        <ArtLayer {...w.careersLabel} tone="primary" align="center">{W.careers}</ArtLayer>
        <ArtLayer {...w.careersValue} align="center">{careers}</ArtLayer>
        {/* each stat box: its label over its value, inside the box with room on every side (art.json boxPad, boxLabelShare) */}
        {boxes.map(([label, value], i) => {
          const [x, y, bw, bh] = g.boxes[i], pad = g.boxPad, inner = bh - 2 * pad, top = inner * g.boxLabelShare
          return (
            <Fragment key={label}>
              <ArtLayer at={[x + pad, y + pad, bw - 2 * pad, top]} text={g.boxLabel} tone="primary" align="center">{label}</ArtLayer>
              <ArtLayer at={[x + pad, y + pad + top, bw - 2 * pad, inner - top]} text={g.boxValue} align="center">{value}</ArtLayer>
            </Fragment>
          )
        })}
        <ArtLayer at={g.button}><Row justify="center"><Button onClick={onNewCareer} data-tag="new-career">{W.newCareer}</Button></Row></ArtLayer>
      </ArtStage>
    </Screen>
  )
}
