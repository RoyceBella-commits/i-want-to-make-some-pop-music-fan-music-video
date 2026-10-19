"""Turn a generated keyframe into Riso plates for the shader.

For each shot it writes art/plates/<id>/ (and copies into story/public/plates/<id>/):
  inkA.png   RGB = coverage of yellow, teal, cornflower (0..255)
  inkB.png   RGB = coverage of pink, brown, depth (255 = near)
  inkC.png   R   = optional region mask (e.g. the sky inside a window)
  (RGB only: browsers premultiply alpha on decode, which would destroy a 4th channel.)
  flat.png   the plates recombined without texture (to check the separation)
  compare.jpg  original | separated, side by side

Separation: every pixel is matched (in Lab) to the nearest colour that the five inks can
produce when overprinted on paper (subtractive model: paper * prod(1 - d_i * (1 - ink_i / paper))),
over a small set of single / double / triple-ink coverage levels.

usage: art/.venv/bin/python -I art/plate.py <image.png> <id> [--mask x0,y0,x1,y1:#hex|#hex:tol]
"""
import itertools
import json
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage
from skimage import color

ART = Path(__file__).resolve().parent
STORY = ART.parent / 'story' / 'public' / 'plates'
PAPER = '#F3ECDD'
INKS = {'yellow': '#FFB511', 'teal': '#00838A', 'cornflower': '#62A8E5', 'pink': '#FF48B0', 'brown': '#925F52'}
ORDER = ['yellow', 'teal', 'cornflower', 'pink', 'brown']


def hex_lin(h: str) -> np.ndarray:
    c = np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)]) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_srgb(x: np.ndarray) -> np.ndarray:
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * x ** (1 / 2.4) - 0.055)


def candidates() -> np.ndarray:
    n = len(ORDER)
    out = [np.zeros(n)]
    for i in range(n):
        for d in (0.15, 0.3, 0.45, 0.6, 0.8, 1.0):
            v = np.zeros(n); v[i] = d; out.append(v)
    for i, j in itertools.combinations(range(n), 2):
        for a, b in itertools.product((0.15, 0.3, 0.6, 1.0), repeat=2):
            v = np.zeros(n); v[i] = a; v[j] = b; out.append(v)
    for i, j, k in itertools.combinations(range(n), 3):
        for a, b, c in itertools.product((0.5, 1.0), repeat=3):
            v = np.zeros(n); v[i] = a; v[j] = b; v[k] = c; out.append(v)
    return np.array(out)


def mix(d: np.ndarray) -> np.ndarray:
    """Coverage vectors (..., 5) -> linear RGB via the subtractive overprint model."""
    paper = hex_lin(PAPER)
    trans = np.stack([np.clip(hex_lin(INKS[k]) / paper, 0, 1) for k in ORDER])  # (5, 3)
    out = np.ones(d.shape[:-1] + (3,)) * paper
    for i in range(len(ORDER)):
        out = out * (1 - d[..., i:i + 1] * (1 - trans[i]))
    return out


def separate(rgb: np.ndarray) -> np.ndarray:
    cand = candidates()
    cand_lab = color.rgb2lab(lin_srgb(mix(cand))[None])[0]
    # Prefer fewer inks when two candidates are about equally close.
    penalty = (cand > 0).sum(1) * 1.5
    # Flatten generator noise / fabric texture before matching so flat areas stay flat.
    rgb = ndimage.gaussian_filter(rgb, sigma=(1.2, 1.2, 0))
    img_lab = color.rgb2lab(rgb).reshape(-1, 3)
    labels = np.empty(len(img_lab), np.int32)
    for s in range(0, len(img_lab), 150_000):
        chunk = img_lab[s:s + 150_000]
        dist = ((chunk[:, None, :] - cand_lab[None]) ** 2).sum(-1) ** 0.5 + penalty[None]
        labels[s:s + 150_000] = dist.argmin(1)
    labels = labels.reshape(rgb.shape[:2])
    # Remove isolated speckles: majority filter on the label map.
    labels = ndimage.median_filter(labels, size=5)
    dens = cand[labels]
    return ndimage.gaussian_filter(dens, sigma=(0.6, 0.6, 0))


def depth_map(img: Image.Image) -> np.ndarray:
    import torch
    from transformers import pipeline
    dev = 'mps' if torch.backends.mps.is_available() else 'cpu'
    pipe = pipeline('depth-estimation', model='depth-anything/Depth-Anything-V2-Large-hf', device=dev)
    d = np.array(pipe(img)['predicted_depth'].squeeze().float().cpu())
    d = np.array(Image.fromarray(d).resize(img.size, Image.BICUBIC))
    lo, hi = np.percentile(d, 1), np.percentile(d, 99)
    return np.clip((d - lo) / (hi - lo), 0, 1)  # 1 = near


def region_mask(rgb8: np.ndarray, spec: str) -> np.ndarray:
    rect, hexcols, tol = spec.split(':')
    x0, y0, x1, y1 = (int(v) for v in rect.split(','))
    near = np.zeros(rgb8.shape[:2], bool)
    for hexcol in hexcols.split('|'):
        target = np.array([int(hexcol[i:i + 2], 16) for i in (1, 3, 5)])
        near |= np.abs(rgb8.astype(int) - target).max(-1) <= int(tol)
    m = np.zeros(rgb8.shape[:2], bool)
    m[y0:y1, x0:x1] = True
    m &= near
    m = ndimage.binary_opening(m, iterations=2)
    m = ndimage.binary_fill_holes(m)
    return ndimage.gaussian_filter(m.astype(float), 1.0)


def main() -> None:
    src, sid = Path(sys.argv[1]), sys.argv[2]
    args = sys.argv[3:]
    out = ART / 'plates' / sid
    out.mkdir(parents=True, exist_ok=True)
    img = Image.open(src).convert('RGB')
    w, h = img.size
    # Centre-crop to exactly 16:9.
    tw, th = (w, round(w * 9 / 16)) if w / h < 16 / 9 else (round(h * 16 / 9), h)
    img = img.crop(((w - tw) // 2, (h - th) // 2, (w - tw) // 2 + tw, (h - th) // 2 + th))
    rgb8 = np.array(img)
    rgb = rgb8 / 255.0

    dens = separate(rgb)
    depth = depth_map(img)
    mask = region_mask(rgb8, args[args.index('--mask') + 1]) if '--mask' in args else np.zeros(depth.shape)

    to8 = lambda a: (np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)
    Image.fromarray(to8(dens[..., :3]), 'RGB').save(out / 'inkA.png')
    Image.fromarray(to8(np.dstack([dens[..., 3], dens[..., 4], depth])), 'RGB').save(out / 'inkB.png')
    Image.fromarray(to8(np.dstack([mask, mask * 0, mask * 0])), 'RGB').save(out / 'inkC.png')
    flat = to8(lin_srgb(mix(dens)))
    Image.fromarray(flat).save(out / 'flat.png')
    Image.fromarray(to8(depth)).save(out / 'depth.png')
    cmp_ = np.concatenate([rgb8, flat], 1)
    Image.fromarray(cmp_).save(out / 'compare.jpg', quality=90)
    meta = dict(id=sid, source=str(src), size=[tw, th], inks=ORDER, paper=PAPER, ink_hex=INKS,
                coverage_mean={k: round(float(dens[..., i].mean()), 3) for i, k in enumerate(ORDER)},
                # Coarse depth grid (rows top->bottom) so overlays can sit at the right parallax depth.
                depth_grid=np.round(np.array(Image.fromarray(depth.astype(np.float32)).resize((64, 36), Image.BILINEAR)), 3).tolist())
    (out / 'plate.json').write_text(json.dumps(meta, indent=2))
    dst = STORY / sid
    dst.mkdir(parents=True, exist_ok=True)
    for f in ('inkA.png', 'inkB.png', 'inkC.png', 'plate.json'):
        shutil.copy(out / f, dst / f)
    print(json.dumps(meta))


if __name__ == '__main__':
    main()
