import React, {useState} from 'react';
import {AbsoluteFill, cancelRender, continueRender, delayRender, useCurrentFrame} from 'remotion';
import {useFeatures} from '../lib/features';
import {sectionAt} from '../lib/lyrics';
import {INK_ORDER, PAPER, fontsReady, type InkName} from '../lib/theme';
import {FPS, clamp, decay} from '../lib/time';
import {LyricInk} from '../lyric/LyricInk';
import {project} from '../riso/camera';
import {boilSeed, jolt, misreg} from '../riso/misreg';
import {RisoCanvas, usePlate, type RisoState} from '../riso/RisoCanvas';
import {FX, type Ctx} from './fx';
import {SHOTS, camAt, linesOf, revealTimes, shotAt, type Shot} from './shots';

const useFonts = () => {
  const [ok, setOk] = useState(false);
  const [h] = useState(() => delayRender('fonts'));
  React.useEffect(() => {
    fontsReady.then(() => {
      setOk(true);
      continueRender(h);
    }, cancelRender);
  }, [h]);
  return ok;
};

const nextShot = (s: Shot) => SHOTS[SHOTS.indexOf(s) + 1];

export const Story: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const shot = shotAt(t);
  const fontsOk = useFonts();
  const features = useFeatures();
  const fxFn = shot.fx ? FX[shot.fx] : undefined;

  // The effect may swap the plate (flashback) — ask it first which plate it wants.
  const plateId = fxFn?.plateFor?.(t, shot) ?? shot.plate;
  const plate = usePlate(plateId ?? 's01_summer', nextShot(shot)?.plate ?? undefined);
  if (!fontsOk || !features || (plateId && !plate)) return <AbsoluteFill style={{background: PAPER}} />;

  // Held notes freeze the print: grain and registration stop where they were at the cut.
  const tPrint = shot.freeze ? shot.start : t;
  const base = misreg(tPrint, shot.misreg ?? 1);
  const offsets = shot.hard ? jolt(base, decay(t - shot.start, 0.09)) : base;
  const seed = boilSeed(tPrint);
  const cam = camAt(shot, t);
  const reveal = Object.fromEntries(INK_ORDER.map((k) => [k, 0])) as Record<InkName, number>;
  const times = revealTimes(shot);
  shot.inks.forEach((k, i) => (reveal[k] = clamp((t - times[i]) / 0.24)));
  // Inks a shot does not print stay off (e.g. the teal-only nobody-cares table).
  const meta = plate?.meta;
  const at = (u: number, v: number) => (meta ? project(cam, meta.depth_grid, u, v) : {x: u * 1920, y: v * 1080, scale: 1});

  const ctx: Ctx = {t, shot, cam, offsets, at, features, local: t - shot.start, plateId};
  const out = fxFn?.(ctx) ?? {};

  const state: RisoState = {
    plate: plateId ? plate : null,
    cam: out.cam ?? cam,
    reveal: out.reveal ?? reveal,
    offsets: out.offsets ?? offsets,
    seed,
    time: t,
    mono: shot.mono,
    ...out.riso,
  };

  // A line still being sung at the cut carries over, so its last words land in this shot.
  const prev = SHOTS[SHOTS.indexOf(shot) - 1];
  const carried = prev ? linesOf(prev).filter((l) => (l.tokens.filter((tk) => tk.s !== undefined).pop()?.s ?? 0) >= shot.start - 0.3) : [];
  const drop = shot.lyric?.drop;
  const lines = [...carried, ...linesOf(shot)]
    .filter((l) => !out.skipLines?.includes(l.i))
    .map((l) => (drop ? {...l, tokens: l.tokens.filter((tk) => !drop.includes(tk.t))} : l));
  const ly = shot.lyric && !out.hideLyrics ? {...shot.lyric, ...out.lyric} : null;
  const anchor = ly ? (ly.screen ? {x: ly.u * 1920, y: ly.v * 1080, scale: 1} : at(ly.u, ly.v)) : null;
  const lyricNode =
    ly && anchor ? (
      <LyricInk
        lines={lines}
        t={t}
        x={anchor.x}
        y={anchor.y}
        size={ly.size}
        ink={ly.ink}
        shadow={ly.shadow}
        staffInk={ly.staffInk}
        offsets={state.offsets}
        feel={sectionAt(t).feel === 'pop' ? 'pop' : 'soul'}
        layout={ly.layout}
        maxEm={ly.maxEm}
        notBefore={shot.start}
        mode={ly.mode}
        stretch={ly.stretch}
        charScale={out.charScale}
      />
    ) : null;

  return (
    <AbsoluteFill style={{background: PAPER, overflow: 'hidden'}}>
      <RisoCanvas state={state} />
      <InkFilter seed={seed} />
      <AbsoluteFill style={{mixBlendMode: 'multiply', filter: 'url(#inkRough)'}}>
        {out.ink}
        {ly?.mode !== 'paper' && lyricNode}
      </AbsoluteFill>
      <AbsoluteFill style={{filter: 'url(#paperRough)'}}>
        {out.paper}
        {ly?.mode === 'paper' && lyricNode}
        {out.top}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Roughens overlay edges and knocks pin-holes into the ink, re-seeded with the print boil. */
const InkFilter: React.FC<{seed: number}> = ({seed}) => (
  <svg width={0} height={0} style={{position: 'absolute'}}>
    <filter id="inkRough" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={seed} result="warp" />
      <feDisplacementMap in="SourceGraphic" in2="warp" scale={2.6} xChannelSelector="R" yChannelSelector="G" result="rough" />
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={1} seed={seed + 3} result="speck" />
      <feColorMatrix in="speck" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -9 6.2" result="holes" />
      <feComposite in="rough" in2="holes" operator="in" />
    </filter>
    {/* Opaque paper props and paper-coloured type: rough edges only, no pin-holes. */}
    <filter id="paperRough" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={seed} result="warp" />
      <feDisplacementMap in="SourceGraphic" in2="warp" scale={2.2} xChannelSelector="R" yChannelSelector="G" />
    </filter>
  </svg>
);
