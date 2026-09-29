// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Cameron Jago Lis Illustrates.
// Original inspiration: John Earnest (Internet Janitor), WigglyPaint and Decker.
'use strict';
const motionTypes = ['classic', 'sway', 'ripple', 'flutter', 'breathe', 'spring', 'drift', 'crawl'];
const motionNames = {
  classic: 'Classic line boil',
  sway: 'Sway',
  ripple: 'Ripple',
  flutter: 'Flutter',
  breathe: 'Breathe',
  spring: 'Spring',
  drift: 'Drift',
  crawl: 'Texture crawl'
};

function motionDefaults(type = 'classic') {
  return {
    type,
    amount: type === 'breathe' ? 8 : type === 'classic' ? 3 : 16,
    speed: 1,
    wavelength: 120,
    angle: 10,
    anchorX: 0.5,
    anchorY: 0.5,
    pin: 'start',
    reach: 1,
    gust: 0.25,
    balanceX: 1,
    balanceY: 1,
    direction: 1,
    path: 'ellipse',
    phase: 0,
    shared: true,
    stepped: false,
    loop: true,
    stiffness: 3,
    damping: 3
  };
}
let motionDraft = motionDefaults(),
  motionScope = 'new',
  motionPreview = false,
  motionPaused = false,
  motionPauseTick = 0;
const legacyPathPoints = pathPoints,
  legacyRenderLayer = renderLayer,
  legacyPaintCanvas = paintCanvas;
const motionBoundsCache = new Map();
let motionLayerActive = false,
  layerTextureMotion = null,
  motionPreviewActive = false,
  motionSampleActive = false;

function motionIsEnabled() {
  return project.wiggleEnabled || motionPreviewActive || motionSampleActive;
}

function enableAppliedMotion() {
  project.wiggleEnabled = true;
  motionPaused = false;
  lastTick = -1;
}
const originalJitterPoint = jitterPoint;
jitterPoint = function (p, index, op, tick) {
  return renderingStill || motionLayerActive ? p : originalJitterPoint(p, index, op, tick);
};

function motionDuration() {
  return project.frames.length > 1
    ? frameSequence().reduce((n, i) => n + project.frames[i].hold / project.fps, 0)
    : project.motionLoopSeconds || 3;
}

function motionPhase(m, tick, seed = 0) {
  let time = tick / project.boil;
  if (m.stepped) time = Math.floor(time * project.boil) / project.boil;
  const cycles = m.loop ? Math.max(1, Math.round(m.speed)) : m.speed;
  return (
    (time / (m.loop ? motionDuration() : 1)) * cycles + m.phase + (m.shared ? 0 : random(seed))
  );
}

function boundsForOps(ops) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const op of ops) {
    if (op.kind === 'group') {
      const b = op.outside
        ? boundsForOps(op.ops)
        : {
            x: Math.min(...op.clip.map((p) => p.x)),
            y: Math.min(...op.clip.map((p) => p.y)),
            w: Math.max(...op.clip.map((p) => p.x)) - Math.min(...op.clip.map((p) => p.x)),
            h: Math.max(...op.clip.map((p) => p.y)) - Math.min(...op.clip.map((p) => p.y))
          };
      const [a, c, d, e, tx, ty] = op.transform;
      for (const [x, y] of [
        [b.x, b.y],
        [b.x + b.w, b.y],
        [b.x, b.y + b.h],
        [b.x + b.w, b.y + b.h]
      ]) {
        const xx = a * x + d * y + tx,
          yy = c * x + e * y + ty;
        x0 = Math.min(x0, xx);
        y0 = Math.min(y0, yy);
        x1 = Math.max(x1, xx);
        y1 = Math.max(y1, yy);
      }
    } else if (op.kind === 'image') {
      x0 = Math.min(x0, op.x);
      y0 = Math.min(y0, op.y);
      x1 = Math.max(x1, op.x + op.w);
      y1 = Math.max(y1, op.y + op.h);
    } else {
      for (const p of op.points) {
        x0 = Math.min(x0, p.x - op.size / 2);
        y0 = Math.min(y0, p.y - op.size / 2);
        x1 = Math.max(x1, p.x + op.size / 2);
        y1 = Math.max(y1, p.y + op.size / 2);
      }
      if (op.mirror && op.symmetry) {
        const b = boundsForOps([{ ...op, mirror: false }]);
        for (const m of symmetryMatrices(op.symmetry))
          for (const p of [
            { x: b.x, y: b.y },
            { x: b.x + b.w, y: b.y },
            { x: b.x + b.w, y: b.y + b.h },
            { x: b.x, y: b.y + b.h }
          ]) {
            const q = matrixPoint(m, p);
            x0 = Math.min(x0, q.x);
            y0 = Math.min(y0, q.y);
            x1 = Math.max(x1, q.x);
            y1 = Math.max(y1, q.y);
          }
      }
    }
  }
  return Number.isFinite(x0)
    ? { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) }
    : { x: 0, y: 0, w: project.width, h: project.height };
}

function layerBounds(id) {
  const key = revision + ':' + id;
  if (motionBoundsCache.has(key)) return motionBoundsCache.get(key);
  const b = boundsForOps(project.frames.flatMap((f) => f.contents[id] || []));
  if (motionBoundsCache.size > 32) motionBoundsCache.clear();
  motionBoundsCache.set(key, b);
  return b;
}

function motionPoint(p, m, tick, b, seed = 0, along = 0.5) {
  if (!motionIsEnabled() || m.type === 'crawl') return { ...p };
  const u = motionPhase(m, tick, seed),
    t = u * Math.PI * 2,
    a = m.amount;
  const cx = b.x + b.w * m.anchorX,
    cy = b.y + b.h * m.anchorY,
    dx = p.x - cx,
    dy = p.y - cy;
  if (m.type === 'sway') {
    const r = (Math.sin(t) * m.angle * Math.PI) / 180;
    return {
      ...p,
      x: cx + dx * Math.cos(r) - dy * Math.sin(r),
      y: cy + dx * Math.sin(r) + dy * Math.cos(r)
    };
  }
  if (m.type === 'breathe') {
    const wave = (Math.sin(t) * a) / 100;
    return { ...p, x: cx + dx * (1 + wave * m.balanceX), y: cy + dy * (1 + wave * m.balanceY) };
  }
  if (m.type === 'drift') {
    const yy = m.path === 'line' ? 0 : m.path === 'figure8' ? Math.sin(t * 2) : Math.sin(t);
    return { ...p, x: p.x + Math.cos(t) * a * m.balanceX, y: p.y + yy * a * m.balanceY };
  }
  if (m.type === 'spring') {
    const f = ((u % 1) + 1) % 1,
      k =
        Math.sin(Math.PI * f) ** 2 *
        Math.sin(f * Math.PI * 2 * m.stiffness) *
        Math.exp(-m.damping * f);
    return { ...p, x: p.x + k * a * m.balanceX, y: p.y - k * a * m.balanceY };
  }
  if (m.type === 'ripple') {
    const wave = Math.sin(((p.x - b.x) / m.wavelength) * Math.PI * 2 - t * m.direction);
    return { ...p, y: p.y + wave * a };
  }
  if (m.type === 'flutter') {
    const distance = m.pin === 'end' ? 1 - along : along,
      e = Math.pow(clamp(distance / m.reach, 0, 1), 1.4);
    const gust = 1 + m.gust * Math.sin(t * 3 + seed * 0.001);
    return { ...p, y: p.y + Math.sin(t * m.direction + distance * 4) * a * e * gust };
  }
  if (m.type === 'classic') {
    const i = along * 40;
    return {
      ...p,
      x:
        p.x +
        a *
          (Math.sin(i * 0.39 + seed * 0.001 + t * 2) * 0.65 +
            Math.sin(i * 0.13 - seed * 0.03 + t) * 0.35),
      y:
        p.y +
        a *
          (Math.cos(i * 0.34 + seed * 0.003 + t * 3) * 0.65 +
            Math.cos(i * 0.17 + seed * 0.002 - t) * 0.35)
    };
  }
  return { ...p };
}
pathPoints = function (op, tick) {
  if (renderingStill || motionLayerActive || op === draft)
    return legacyPathPoints({ ...op, animate: false }, tick);
  if (!op.motion || !op.animate) {
    if (op.boilSpacing && op.animate && !isShapeTool(op.tool)) {
      const ps = legacyPathPoints({ ...op, animate: false }, tick);
      let distance = 0;
      return ps.map((p, i) => {
        if (i) distance += Math.hypot(p.x - ps[i - 1].x, p.y - ps[i - 1].y);
        return originalJitterPoint(p, distance / op.boilSpacing, op, tick);
      });
    }
    return legacyPathPoints(op, tick);
  }
  const ps = legacyPathPoints({ ...op, animate: false }, tick),
    b = boundsForOps([op]);
  return ps.map((p, i) =>
    motionPoint(p, op.motion, tick, b, op.seed, ps.length > 1 ? i / (ps.length - 1) : 0.5)
  );
};

function resolvedLayerMotion(layer, seen = new Set()) {
  if (seen.has(layer.id)) return null;
  seen.add(layer.id);
  if (motionPreview && layer.id === project.activeLayer)
    return { motion: motionDraft, bounds: layerBounds(layer.id), owner: layer.id };
  if (layer.clipTo && layer.followMotion !== false) {
    const base = project.layers.find((l) => l.id === layer.clipTo);
    if (base) return resolvedLayerMotion(base, seen);
  }
  return layer.motion
    ? { motion: layer.motion, bounds: layerBounds(layer.id), owner: layer.id }
    : null;
}

function warpLayerColumns(source, c, m, tick, b, style) {
  // These effects displace each vertical column. Map continuous source edges
  // back to destination pixel centres, then paint each destination column once.
  // Moving separate wide strips leaves gaps, overlaps and stair-step tears.
  const width = source.width,
    height = source.height,
    mid = b.y + b.h / 2;
  const sourceX = new Float64Array(width),
    shiftY = new Float64Array(width);
  sourceX.fill(NaN);
  const edge = (x) => motionPoint({ x, y: mid }, m, tick, b, 0, clamp((x - b.x) / b.w, 0, 1));
  let left = edge(0);
  for (let sx = 0; sx < width; sx++) {
    const right = edge(sx + 1),
      span = right.x - left.x;
    if (Math.abs(span) > 1e-9) {
      const start = Math.max(0, Math.ceil(Math.min(left.x, right.x) - 0.5)),
        end = Math.min(width, Math.ceil(Math.max(left.x, right.x) - 0.5));
      for (let x = start; x < end; x++) {
        const mix = (x + 0.5 - left.x) / span;
        sourceX[x] = sx + mix;
        shiftY[x] = left.y + (right.y - left.y) * mix - mid;
      }
    }
    left = right;
  }
  // Resample the pixels in one pass. Thousands of tiny canvas draw calls are
  // expensive on software renderers. Premultiplied interpolation preserves
  // soft transparent edges without introducing dark fringes.
  const input = source
    .getContext('2d', { willReadFrequently: true })
    .getImageData(0, 0, width, height).data;
  const image = c.createImageData(width, height),
    output = image.data,
    row = width * 4;
  for (let x = 0; x < width; x++) {
    if (!Number.isFinite(sourceX[x])) continue;
    if (style === 'pixel') {
      const sx = Math.floor(sourceX[x]);
      if (sx < 0 || sx >= width) continue;
      const offset = Math.floor(0.5 - shiftY[x]),
        start = Math.max(0, -offset),
        end = Math.min(height, height - offset);
      for (let y = start; y < end; y++) {
        const a = ((y + offset) * width + sx) * 4,
          o = (y * width + x) * 4;
        output[o] = input[a];
        output[o + 1] = input[a + 1];
        output[o + 2] = input[a + 2];
        output[o + 3] = input[a + 3];
      }
      continue;
    }
    const sx = sourceX[x] - 0.5,
      ix = Math.floor(sx),
      fx = sx - ix,
      iy = Math.floor(-shiftY[x]),
      fy = -shiftY[x] - iy;
    const w00 = (1 - fx) * (1 - fy),
      w10 = fx * (1 - fy),
      w01 = (1 - fx) * fy,
      w11 = fx * fy,
      left = ix >= 0,
      right = ix + 1 < width;
    const start = Math.max(0, -iy - 1),
      end = Math.min(height, height - iy);
    for (let y = start; y < end; y++) {
      const sy = y + iy,
        top = sy >= 0,
        bottom = sy + 1 < height,
        p = sy * row + ix * 4;
      const i00 = left && top ? p : 0,
        i10 = right && top ? p + 4 : 0,
        i01 = left && bottom ? p + row : 0,
        i11 = right && bottom ? p + row + 4 : 0;
      const a00 = left && top ? input[i00 + 3] * w00 : 0,
        a10 = right && top ? input[i10 + 3] * w10 : 0,
        a01 = left && bottom ? input[i01 + 3] * w01 : 0,
        a11 = right && bottom ? input[i11 + 3] * w11 : 0,
        alpha = a00 + a10 + a01 + a11;
      if (alpha < 0.5) continue;
      const o = (y * width + x) * 4;
      output[o + 3] = alpha;
      for (let k = 0; k < 3; k++)
        output[o + k] =
          (input[i00 + k] * a00 +
            input[i10 + k] * a10 +
            input[i01 + k] * a01 +
            input[i11 + k] * a11) /
          alpha;
    }
  }
  c.putImageData(image, 0, 0);
}

function warpLayer(source, m, tick, b, style, cell = project.pixelSize) {
  if (!motionIsEnabled() || m.type === 'crawl') return source;
  const out = makeCanvas(),
    c = out.getContext('2d');
  if (['sway', 'breathe', 'drift', 'spring'].includes(m.type)) {
    const a = motionPoint({ x: 0, y: 0 }, m, tick, b),
      x = motionPoint({ x: 1, y: 0 }, m, tick, b),
      y = motionPoint({ x: 0, y: 1 }, m, tick, b);
    c.imageSmoothingEnabled = style !== 'pixel';
    c.setTransform(x.x - a.x, x.y - a.y, y.x - a.x, y.y - a.y, a.x, a.y);
    c.drawImage(source, 0, 0);
    c.resetTransform();
  } else {
    warpLayerColumns(source, c, m, tick, b, style);
  }
  if (style === 'pixel') {
    const small = makeCanvas(Math.ceil(out.width / cell), Math.ceil(out.height / cell)),
      sc = small.getContext('2d');
    sc.imageSmoothingEnabled = false;
    sc.drawImage(out, 0, 0, small.width, small.height);
    c.clearRect(0, 0, out.width, out.height);
    c.imageSmoothingEnabled = false;
    c.drawImage(small, 0, 0, small.width * cell, small.height * cell);
  }
  return out;
}
renderLayer = function (
  fi,
  id,
  tick,
  includeDraft = false,
  style = project.renderStyle,
  cell = project.pixelSize
) {
  const layer = project.layers.find((l) => l.id === id),
    effect = resolvedLayerMotion(layer);
  const prior = motionLayerActive,
    priorTexture = layerTextureMotion,
    priorPreview = motionPreviewActive;
  motionLayerActive = !!effect;
  motionPreviewActive = motionPreview && effect?.owner === project.activeLayer;
  layerTextureMotion = effect?.motion.type === 'crawl' ? effect.motion : null;
  try {
    const out = cachedLayerArtwork(fi, id, tick, includeDraft, style, cell);
    return effect && !renderingStill
      ? warpLayer(out, effect.motion, tick, effect.bounds, style, cell)
      : out;
  } finally {
    motionLayerActive = prior;
    layerTextureMotion = priorTexture;
    motionPreviewActive = priorPreview;
  }
};
renderFrame = function (
  fi,
  tick,
  withPaper = true,
  includeDraft = false,
  style = project.renderStyle,
  cell = project.pixelSize
) {
  const key = `${revision}:${fi}:${tick}:${withPaper}:${style}:${cell}:${motionPreview}`;
  if (!includeDraft && !motionPreview && renderCache.has(key)) return renderCache.get(key);
  const c = makeCanvas(),
    cc = c.getContext('2d'),
    layers = new Map();
  if (withPaper && !project.transparent) {
    cc.fillStyle = project.paper;
    cc.fillRect(0, 0, c.width, c.height);
  }
  for (const l of project.layers) {
    if (!l.visible || l.opacity === 0) {
      layers.set(l.id, null);
      continue;
    }
    const raw = renderLayer(fi, l.id, tick, includeDraft, style, cell),
      paint = makeCanvas(),
      pc = paint.getContext('2d');
    pc.drawImage(raw, 0, 0);
    if (l.clipTo) {
      const base = layers.get(l.clipTo);
      if (!base) {
        layers.set(l.id, null);
        continue;
      }
      pc.globalCompositeOperation = 'destination-in';
      pc.drawImage(base, 0, 0);
      pc.globalCompositeOperation = 'source-over';
    }
    pc.globalCompositeOperation = 'destination-in';
    pc.fillStyle = `rgba(0,0,0,${l.opacity})`;
    pc.fillRect(0, 0, paint.width, paint.height);
    pc.globalCompositeOperation = 'source-over';
    layers.set(l.id, paint);
    cc.globalCompositeOperation = l.blend || 'source-over';
    cc.drawImage(paint, 0, 0);
  }
  cc.globalCompositeOperation = 'source-over';
  if (!includeDraft && !motionPreview) {
    if (renderCache.size >= 8) renderCache.delete(renderCache.keys().next().value);
    renderCache.set(key, c);
  }
  return c;
};
tick = function (now) {
  if (!exporting && !document.hidden) {
    const seconds = playing ? playBase / project.fps + (now - playStart) / 1000 : now / 1000;
    const hasNew = projectHasMotion(),
      motionRate = hasNew ? 24 : project.boil;
    const nextTick =
      !project.wiggleEnabled && !motionPreview
        ? 0
        : motionPaused
          ? motionPauseTick
          : (Math.floor(seconds * motionRate) / motionRate) * project.boil;
    if (nextTick !== lastTick) {
      phase = nextTick;
      lastTick = nextTick;
      renderNeeded = true;
    }
    if (playing) {
      const index = frameAtBeat(playBase + ((now - playStart) / 1000) * project.fps);
      if (index !== playIndex) {
        playIndex = index;
        renderNeeded = true;
        updateStatus();
      }
      Array.from($('frames').children).forEach((e, i) =>
        e.classList.toggle('playing', i === playIndex)
      );
    }
    if (renderNeeded) paintCanvas();
    if (typeof paintMotionPreview === 'function') paintMotionPreview(now);
  }
  requestAnimationFrame(tick);
};

function projectHasMotion() {
  return (
    motionPreview ||
    project.layers.some((l) => l.motion) ||
    project.frames.some((f) =>
      Object.values(f.contents).some((ops) => allOperations(ops).some((op) => op.motion))
    )
  );
}

function applyMotionToLayer() {
  if (!canDraw()) return;
  activeLayer().motion = copy(motionDraft);
  enableAppliedMotion();
  motionPreview = false;
  commit('Layer motion applied');
}

function applyMotionToStrokes() {
  if (!canDraw()) return;
  for (const frame of project.frames)
    for (const op of allOperations(frame.contents[project.activeLayer]))
      if (op.kind === 'stroke' && op.tool !== 'eraser') {
        op.motion = copy(motionDraft);
        op.animate = true;
      }
  enableAppliedMotion();
  motionPreview = false;
  commit('Motion applied to strokes in this layer');
}
