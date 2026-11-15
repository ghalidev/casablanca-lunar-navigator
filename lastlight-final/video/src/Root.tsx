import { Composition } from 'remotion'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-sans-condensed/latin-500.css'
import '@fontsource/ibm-plex-sans-condensed/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import { Film } from './Film'
import { Film2D } from './Film2D'
import { LastLight } from './LastLight'
import { Cinematic } from './Cinematic'
import { Explainer } from './Explainer'

export const FPS = 30

export function Root() {
  return (
    <>
      <Composition id="LastLight" component={LastLight} durationInFrames={30 * FPS} fps={FPS} width={1920} height={1080} />
      <Composition id="Cinematic" component={Cinematic} durationInFrames={30 * FPS} fps={FPS} width={1920} height={1080} />
      <Composition id="Film2D" component={Film2D} durationInFrames={869} fps={FPS} width={1920} height={1080} />
      <Composition id="Film" component={Film} durationInFrames={30 * FPS} fps={FPS} width={1920} height={1080} />
      <Composition id="Explainer" component={Explainer} durationInFrames={30 * FPS} fps={FPS} width={1920} height={1080} />
    </>
  )
}
