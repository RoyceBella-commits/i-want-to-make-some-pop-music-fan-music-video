import {Composition} from 'remotion';
import {FPS, HEIGHT, WIDTH} from './lib/time';
import {END} from './story/shots';
import {Story} from './story/Story';
import {Cover} from './cover/Cover';

export const RemotionRoot = () => (
  <>
    <Composition id="Story" component={Story} durationInFrames={Math.round(END * FPS)} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="Cover" component={Cover} durationInFrames={1} fps={FPS} width={WIDTH} height={HEIGHT} defaultProps={{text: true, guides: false}} />
    <Composition id="CoverClean" component={Cover} durationInFrames={1} fps={FPS} width={WIDTH} height={HEIGHT} defaultProps={{text: false, guides: false}} />
    <Composition id="CoverGuides" component={Cover} durationInFrames={1} fps={FPS} width={WIDTH} height={HEIGHT} defaultProps={{text: true, guides: true}} />
  </>
);
