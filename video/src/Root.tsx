import { Composition } from 'remotion'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import { LastLight } from './LastLight'

export const FPS = 30

export function Root() {
  return <Composition id="LastLight" component={LastLight} durationInFrames={30 * FPS} fps={FPS} width={1920} height={1080} />
}
