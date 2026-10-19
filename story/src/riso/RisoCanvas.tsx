import React, {useLayoutEffect, useRef, useState} from 'react';
import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';
import * as THREE from 'three';
import {HEIGHT, WIDTH} from '../lib/time';
import {INK, INK_ORDER, PAPER, hexRgb, type InkName} from '../lib/theme';
import {makeCamera, PLATE_H, PLATE_W, type Cam} from './camera';
import {PLATE_FRAG, PLATE_VERT, SCREEN_FRAG, SCREEN_VERT} from './shaders';

export type PlateMeta = {id: string; size: [number, number]; depth_grid: number[][]};
export type Plate = {a: THREE.Texture; b: THREE.Texture; c: THREE.Texture; meta: PlateMeta};

// ---------------------------------------------------------------------------------------------
// Plate loading: lazy, with a small LRU so ~40 plates never sit on the GPU at once.

const pending = new Map<string, Promise<Plate>>();
const ready = new Map<string, Plate>();
const MAX_READY = 8;
const loader = new THREE.TextureLoader();
const loadTex = (url: string) =>
  loader.loadAsync(url).then((t) => {
    t.colorSpace = THREE.NoColorSpace;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    return t;
  });

const touch = (id: string, p: Plate) => {
  ready.delete(id);
  ready.set(id, p);
  while (ready.size > MAX_READY) {
    const [oldId, old] = ready.entries().next().value as [string, Plate];
    ready.delete(oldId);
    pending.delete(oldId);
    old.a.dispose();
    old.b.dispose();
    old.c.dispose();
  }
};

export const loadPlate = (id: string): Promise<Plate> => {
  const hit = ready.get(id);
  if (hit) {
    touch(id, hit);
    return Promise.resolve(hit);
  }
  if (!pending.has(id)) {
    const base = `plates/${id}/`;
    pending.set(
      id,
      Promise.all([
        loadTex(staticFile(base + 'inkA.png')),
        loadTex(staticFile(base + 'inkB.png')),
        loadTex(staticFile(base + 'inkC.png')),
        fetch(staticFile(base + 'plate.json')).then((r) => r.json() as Promise<PlateMeta>),
      ])
        .then(([a, b, c, meta]) => {
          const p = {a, b, c, meta};
          touch(id, p);
          return p;
        })
        .catch((e) => {
          pending.delete(id);
          throw e;
        }),
    );
  }
  return pending.get(id)!;
};

/** The plate for this frame; holds the render until its textures are on the GPU. */
export const usePlate = (id: string, prefetch?: string): Plate | null => {
  const [, force] = useState(0);
  useLayoutEffect(() => {
    if (prefetch) loadPlate(prefetch).catch(() => undefined);
    if (ready.has(id)) return;
    const h = delayRender(`plate ${id}`);
    loadPlate(id)
      .then(() => {
        force((n) => n + 1);
        continueRender(h);
      })
      .catch((e) => cancelRender(e));
  }, [id, prefetch]);
  return ready.get(id) ?? null;
};

// ---------------------------------------------------------------------------------------------

const srgbToLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lin = (hex: string) => hexRgb(hex).map(srgbToLin) as [number, number, number];
const PAPER_LIN = lin(PAPER);
const TRANS = INK_ORDER.map((k) => {
  const c = lin(INK[k]);
  return new THREE.Vector3(...c.map((v, i) => Math.min(1, v / PAPER_LIN[i])));
});
/** Screen angles per drum (rad), spread to keep moiré down. */
const ANGLES = [0, 15, 75, 45, 30].map((d) => (d * Math.PI) / 180);

export type RisoState = {
  plate: Plate | null;
  cam: Cam;
  /** 0..1 per ink: how far the drum has rolled ink onto the sheet. */
  reveal: Record<InkName, number>;
  offsets: Record<InkName, [number, number]>;
  seed: number;
  time: number;
  weather?: [number, number, number, number];
  sun?: [number, number];
  cell?: number;
  grain?: number;
  /** 0..1 collapse to a single teal drum; monoEdge = plate-x where it starts (for a wipe). */
  mono?: number;
  monoEdge?: number;
  /** Screen rect [x0, y0, x1, y1] (px, y down) where the halftone cell is multiplied. */
  cellRect?: [number, number, number, number];
  cellMul?: number;
  /** Right of splitX (px) the drums use offsetsRight. */
  splitX?: number;
  offsetsRight?: Record<InkName, [number, number]>;
};

type GL = {
  renderer: THREE.WebGLRenderer;
  rtA: THREE.WebGLRenderTarget;
  rtB: THREE.WebGLRenderTarget;
  plateScene: THREE.Scene;
  plateMat: THREE.ShaderMaterial;
  screenScene: THREE.Scene;
  screenMat: THREE.ShaderMaterial;
  ortho: THREE.Camera;
};

const setup = (canvas: HTMLCanvasElement): GL => {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true, alpha: false});
  renderer.setPixelRatio(1);
  renderer.setSize(WIDTH, HEIGHT, false);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const rtOpts = {minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true, samples: 4};
  const rtA = new THREE.WebGLRenderTarget(WIDTH, HEIGHT, rtOpts);
  const rtB = new THREE.WebGLRenderTarget(WIDTH, HEIGHT, rtOpts);

  const plateMat = new THREE.ShaderMaterial({
    vertexShader: PLATE_VERT,
    fragmentShader: PLATE_FRAG,
    uniforms: {
      uA: {value: null},
      uB: {value: null},
      uC: {value: null},
      uPass: {value: 0},
      uDepth: {value: 0},
      uTime: {value: 0},
      uWeather: {value: new THREE.Vector4(1, 0, 0, 0)},
      uWeatherOn: {value: 0},
      uSun: {value: new THREE.Vector2(0.3, 0.85)},
      uMono: {value: 0},
      uMonoEdge: {value: -1},
    },
  });
  const plateScene = new THREE.Scene();
  plateScene.background = new THREE.Color(0, 0, 0);
  plateScene.add(new THREE.Mesh(new THREE.PlaneGeometry(PLATE_W, PLATE_H, 320, 180), plateMat));

  const screenMat = new THREE.ShaderMaterial({
    vertexShader: SCREEN_VERT,
    fragmentShader: SCREEN_FRAG,
    depthTest: false,
    uniforms: {
      tA: {value: rtA.texture},
      tB: {value: rtB.texture},
      uRes: {value: new THREE.Vector2(WIDTH, HEIGHT)},
      uOff: {value: INK_ORDER.map(() => new THREE.Vector2())},
      uOffR: {value: INK_ORDER.map(() => new THREE.Vector2())},
      uReveal: {value: INK_ORDER.map(() => 1)},
      uAngle: {value: ANGLES},
      uTrans: {value: TRANS},
      uPaper: {value: new THREE.Vector3(...PAPER_LIN)},
      uCell: {value: 5},
      uSeed: {value: 0},
      uGrain: {value: 0.45},
      uCellRect: {value: new THREE.Vector4(0, 0, 0, 0)},
      uCellMul: {value: 1},
      uSplitX: {value: 0},
    },
  });
  const screenScene = new THREE.Scene();
  screenScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), screenMat));
  return {renderer, rtA, rtB, plateScene, plateMat, screenScene, screenMat, ortho: new THREE.Camera()};
};

/**
 * The printed scene. Rendering happens synchronously in a layout effect, so the canvas is final
 * before Remotion captures the frame. With no plate the sheet is blank paper.
 */
export const RisoCanvas: React.FC<{state: RisoState}> = ({state}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const gl = useRef<GL | null>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    gl.current ??= setup(ref.current);
    const g = gl.current;
    const u = g.plateMat.uniforms;
    const cam = makeCamera(state.cam);
    if (state.plate) {
      u.uA.value = state.plate.a;
      u.uB.value = state.plate.b;
      u.uC.value = state.plate.c;
    }
    u.uDepth.value = state.cam.depth;
    u.uTime.value = state.time;
    u.uWeatherOn.value = state.weather ? 1 : 0;
    if (state.weather) (u.uWeather.value as THREE.Vector4).set(...state.weather);
    if (state.sun) (u.uSun.value as THREE.Vector2).set(...state.sun);
    u.uMono.value = state.mono ?? 0;
    u.uMonoEdge.value = state.monoEdge ?? -1;

    for (const [rt, pass] of [
      [g.rtA, 0],
      [g.rtB, 1],
    ] as const) {
      g.renderer.setRenderTarget(rt);
      u.uPass.value = pass;
      if (state.plate) g.renderer.render(g.plateScene, cam);
      else g.renderer.clear();
    }

    const s = g.screenMat.uniforms;
    INK_ORDER.forEach((k, i) => {
      (s.uOff.value as THREE.Vector2[])[i].set(...state.offsets[k]);
      (s.uOffR.value as THREE.Vector2[])[i].set(...(state.offsetsRight ?? state.offsets)[k]);
      (s.uReveal.value as number[])[i] = state.plate ? state.reveal[k] : 0;
    });
    s.uSeed.value = state.seed;
    s.uCell.value = state.cell ?? 5;
    s.uGrain.value = state.grain ?? 0.45;
    const r = state.cellRect;
    // Shader rect is y-up.
    (s.uCellRect.value as THREE.Vector4).set(r ? r[0] : 0, r ? HEIGHT - r[3] : 0, r ? r[2] : 0, r ? HEIGHT - r[1] : 0);
    s.uCellMul.value = state.cellMul ?? 1;
    s.uSplitX.value = state.splitX ?? 0;
    g.renderer.setRenderTarget(null);
    g.renderer.render(g.screenScene, g.ortho);
  });

  return <canvas ref={ref} width={WIDTH} height={HEIGHT} style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}} />;
};
