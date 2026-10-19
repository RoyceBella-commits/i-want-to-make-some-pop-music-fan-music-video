import React, {useState} from 'react';
import {AbsoluteFill, cancelRender, continueRender, delayRender} from 'remotion';
import {FONT_SANS, FONT_SERIF, INK, INK_ORDER, PAPER, fontsReady, type InkName} from '../lib/theme';
import {misreg} from '../riso/misreg';
import {RisoCanvas, usePlate} from '../riso/RisoCanvas';

/** 4:3 centre-crop safe area of a 1920 × 1080 frame. */
const SAFE_L = 240;
const SAFE_R = 1680;

/**
 * Cover still: the cover plate printed with the same Riso pipeline as the MV, title set vertically
 * on the left and the band on the right, both inside the 4:3 crop.
 */
export const Cover: React.FC<{text: boolean; guides?: boolean}> = ({text, guides}) => {
  const plate = usePlate('cover');
  const [ok, setOk] = useState(false);
  const [h] = useState(() => delayRender('fonts'));
  React.useEffect(() => {
    fontsReady.then(() => {
      setOk(true);
      continueRender(h);
    }, cancelRender);
  }, [h]);
  if (!plate || !ok) return <AbsoluteFill style={{background: PAPER}} />;
  // A quiet moment between hits: resting registration only.
  const offsets = misreg(0.3);
  const reveal = Object.fromEntries(INK_ORDER.map((k) => [k, 1])) as Record<InkName, number>;
  const ink = (k: InkName, dx = 0): React.CSSProperties => ({
    color: INK[k],
    transform: `translate(${offsets[k][0] + dx}px, ${offsets[k][1] + dx}px)`,
  });
  return (
    <AbsoluteFill style={{background: PAPER}}>
      <RisoCanvas state={{plate, cam: {x: 0, y: 0, zoom: 1.0, roll: 0, depth: 0}, reveal, offsets, seed: 7, time: 0}} />
      {text && (
        <AbsoluteFill style={{mixBlendMode: 'multiply'}}>
          {/* Title, vertical, left of the rug. */}
          {(['yellow', 'teal'] as InkName[]).map((k, i) => (
            <div
              key={k}
              style={{
                position: 'absolute',
                left: SAFE_L + 74,
                top: 128,
                writingMode: 'vertical-rl',
                fontFamily: FONT_SERIF,
                fontWeight: 900,
                fontSize: 86,
                lineHeight: 1,
                letterSpacing: 6,
                ...ink(k, i === 0 ? 5 : 0),
              }}
            >
              我想要做点流行音乐
            </div>
          ))}
          {/* Band, vertical, right of the rug. */}
          <div style={{position: 'absolute', right: 1920 - SAFE_R + 70, top: 170, display: 'flex', flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 14}}>
            <div style={{writingMode: 'vertical-rl', fontFamily: FONT_SERIF, fontWeight: 900, fontSize: 84, lineHeight: 1, letterSpacing: 10, ...ink('pink')}}>回环</div>
            <div style={{writingMode: 'vertical-rl', fontFamily: FONT_SANS, fontWeight: 800, fontSize: 40, lineHeight: 1, letterSpacing: 6, marginTop: 6, ...ink('brown')}}>RingAgain</div>
          </div>
          <div style={{position: 'absolute', right: 1920 - SAFE_R + 70, bottom: 150, writingMode: 'vertical-rl', fontFamily: FONT_SANS, fontWeight: 700, fontSize: 26, letterSpacing: 4, ...ink('cornflower')}}>
            专辑《松一口气！》
          </div>
        </AbsoluteFill>
      )}
      {guides && (
        <AbsoluteFill>
          <div style={{position: 'absolute', left: SAFE_L, top: 0, bottom: 0, borderLeft: '3px dashed red'}} />
          <div style={{position: 'absolute', left: SAFE_R, top: 0, bottom: 0, borderLeft: '3px dashed red'}} />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
