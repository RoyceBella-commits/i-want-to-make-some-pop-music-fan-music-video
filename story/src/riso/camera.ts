import * as THREE from 'three';
import {HEIGHT, WIDTH} from '../lib/time';

/** World units of the plate: a 16 x 9 plane centred on the origin. */
export const PLATE_W = 16;
export const PLATE_H = 9;
export const FOV = 30;
/** Camera distance at which the plate exactly fills the frame. */
export const FILL_DIST = PLATE_H / 2 / Math.tan(((FOV / 2) * Math.PI) / 180);

export type Cam = {
  /** Pan in world units (x right, y up). */
  x: number;
  y: number;
  /** Zoom: 1 = plate fills the frame; >1 pushes in. */
  zoom: number;
  /** Small roll in degrees. */
  roll: number;
  /** How far the nearest pixel is pushed toward the camera (world units). */
  depth: number;
};

export const makeCamera = (c: Cam) => {
  const cam = new THREE.PerspectiveCamera(FOV, WIDTH / HEIGHT, 0.1, 100);
  cam.position.set(c.x, c.y, FILL_DIST / c.zoom);
  cam.lookAt(c.x, c.y, 0);
  cam.rotateZ((c.roll * Math.PI) / 180);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return cam;
};

/** Bilinear lookup in a plate's coarse depth grid (rows top -> bottom, 1 = near). */
export const depthAt = (grid: number[][], u: number, v: number) => {
  const rows = grid.length;
  const cols = grid[0].length;
  const x = Math.min(cols - 1.001, Math.max(0, u * (cols - 1)));
  const y = Math.min(rows - 1.001, Math.max(0, v * (rows - 1)));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const a = grid[y0][x0] * (1 - fx) + grid[y0][x0 + 1] * fx;
  const b = grid[y0 + 1][x0] * (1 - fx) + grid[y0 + 1][x0 + 1] * fx;
  return a * (1 - fy) + b * fy;
};

/**
 * Screen position (px) of an image point (u, v from the top-left, 0..1) after parallax, so code
 * overlays stay glued to the painted scene. `scale` is how much 1 image px is magnified.
 */
export const project = (c: Cam, grid: number[][], u: number, v: number, depthOverride?: number) => {
  const cam = makeCamera(c);
  const d = depthOverride ?? depthAt(grid, u, v);
  const p = new THREE.Vector3((u - 0.5) * PLATE_W, (0.5 - v) * PLATE_H, d * c.depth).project(cam);
  const q = new THREE.Vector3((u - 0.5) * PLATE_W + 0.1, (0.5 - v) * PLATE_H, d * c.depth).project(cam);
  const x = ((p.x + 1) / 2) * WIDTH;
  const y = ((1 - p.y) / 2) * HEIGHT;
  const scale = ((((q.x - p.x) / 2) * WIDTH) / 0.1) * (PLATE_W / WIDTH);
  return {x, y, scale};
};
