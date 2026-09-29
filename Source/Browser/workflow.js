// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Cameron Jago Lis Illustrates.
// Original inspiration: John Earnest (Internet Janitor), WigglyPaint and Decker.
'use strict';
let selection = null,
  selectionDrag = null,
  artClipboard = null,
  artClipboardTips = {},
  frameClipboard = null,
  fillReference = 'layer',
  touchDrawing = true,
  guides = 'none',
  renderingStill = false;
const recoveryKey = 'jago-loop-recovery-v2',
  libraryKey = 'jago-loop-library-v2';
const gridDefaults = { width: 40, height: 40, x: 0, y: 0, major: 4 };

function gridSettings() {
  return { ...gridDefaults, ...project.gridSettings };
}
const arcDefaults = { x: 50, y: 80, width: 76, height: 50, steps: 12 };

function arcSettings() {
  return { ...arcDefaults, ...project.guideSettings };
}

function arcGeometry() {
  const a = arcSettings(),
    cx = (project.width * a.x) / 100,
    y = (project.height * a.y) / 100,
    half = (project.width * a.width) / 200;
  return {
    start: { x: cx - half, y },
    end: { x: cx + half, y },
    control: { x: cx, y: y - (project.height * a.height) / 50 },
    steps: a.steps
  };
}
let studioLibrary = { brushes: [], motions: [] },
  lastRecovery = 0,
  uiReady = false;
const baseValidateProject = validateProject,
  baseUpdateUI = updateUI,
  baseAfterRestore = afterRestore,
  baseSaveLocal = saveLocal,
  baseSelectFrame = selectFrame;
const finite = (n, a, b) => typeof n === 'number' && Number.isFinite(n) && n >= a && n <= b;

function validateMotion(m) {
  if (!m || !motionTypes.includes(m.type)) throw Error('Unknown motion type');
  const ranges = {
    amount: [0, 80],
    speed: [0.1, 8],
    wavelength: [10, 1000],
    angle: [0, 60],
    anchorX: [-2, 3],
    anchorY: [-2, 3],
    reach: [0.1, 1],
    gust: [0, 1],
    balanceX: [0, 2],
    balanceY: [0, 2],
    direction: [-1, 1],
    phase: [0, 1],
    stiffness: [1, 8],
    damping: [0, 10]
  };
  const clean = motionDefaults(m.type);
  for (const [k, [a, b]] of Object.entries(ranges)) {
    if (m[k] !== undefined) {
      if (!finite(m[k], a, b)) throw Error('Invalid motion setting: ' + k);
      clean[k] = m[k];
    }
  }
  for (const k of ['shared', 'stepped', 'loop'])
    if (m[k] !== undefined) {
      if (typeof m[k] !== 'boolean') throw Error('Invalid motion setting');
      clean[k] = m[k];
    }
  if (m.pin !== undefined && !['start', 'end'].includes(m.pin))
    throw Error('Invalid motion anchor');
  if (m.path !== undefined && !['ellipse', 'line', 'figure8'].includes(m.path))
    throw Error('Invalid drift path');
  clean.pin = m.pin || clean.pin;
  clean.path = m.path || clean.path;
  return clean;
}

function validateBrush(b) {
  if (!b || typeof b.tip !== 'string' || b.tip.length > 40) throw Error('Invalid brush tip');
  const result = {
    ...stampDefaults,
    ...b,
    patternScale: b.patternScale ?? 1,
    patternMode: b.patternMode ?? 'stamps',
    sizedPattern: b.sizedPattern ?? false,
    chalkPattern: b.chalkPattern ?? false,
    patternAngle: b.patternAngle ?? 0
  };
  for (const [key, a, z] of [
    ['spacing', 0.05, 3],
    ['rotation', -180, 180],
    ['scatter', 0, 2],
    ['variation', 0, 1],
    ['density', 0.05, 1]
  ])
    if (!finite(result[key], a, z)) throw Error('Invalid brush setting: ' + key);
  if (b.tip === 'chalk' && !b.chalkPattern) result.patternMode = 'stamps';
  if (!finite(result.patternAngle, -180, 180)) throw Error('Invalid pattern angle');
  if (!b.sizedPattern && ['dither', 'dots', 'stripes', 'checker'].includes(b.tip))
    result.patternMode = 'aligned';
  if (
    !Number.isInteger(result.patternScale) ||
    !finite(result.patternScale, 1, 24) ||
    !['aligned', 'stamps'].includes(result.patternMode)
  )
    throw Error('Invalid pattern settings');
  for (const key of ['follow', 'keepColour', 'pressureOpacity', 'sizedPattern', 'chalkPattern'])
    if (typeof result[key] !== 'boolean') throw Error('Invalid brush option');
  if (
    !['single', 'continuous'].includes(result.mode) ||
    !['stroke', 'individual', 'layer'].includes(result.motionPlacement)
  )
    throw Error('Invalid stamp mode');
  return result;
}

function allOperations(ops) {
  return ops.flatMap((op) => (op.kind === 'group' ? [op, ...allOperations(op.ops)] : [op]));
}
validateProject = function (v) {
  let nodes = 0,
    groupMasks = 0;
  function flatten(ops, depth = 0) {
    if (!Array.isArray(ops) || depth > 10) throw Error('Selection groups are too deeply nested');
    return ops.flatMap((op) => {
      if (!op || ++nodes > 10000) throw Error('Project has too many drawing operations');
      if (op.kind !== 'group') return [op];
      if (
        !Array.isArray(op.transform) ||
        op.transform.length !== 6 ||
        op.transform.some((n) => !finite(n, -1e6, 1e6)) ||
        Math.abs(op.transform[0] * op.transform[3] - op.transform[1] * op.transform[2]) < 1e-8 ||
        typeof op.outside !== 'boolean' ||
        !Array.isArray(op.clip) ||
        op.clip.length < 3 ||
        op.clip.length > 1200
      )
        throw Error('Invalid live selection group');
      groupMasks += op.clip.length;
      if (groupMasks > 100000) throw Error('Too many selection points');
      for (const p of op.clip)
        if (!finite(p.x, -1e6, 1e6) || !finite(p.y, -1e6, 1e6)) throw Error('Invalid group clip');
      return flatten(op.ops, depth + 1);
    });
  }
  if (!v || !Array.isArray(v.frames)) throw Error('Invalid project');
  const flat = {
    ...v,
    frames: v.frames.map((f) => ({
      ...f,
      contents: Object.fromEntries(
        Object.entries(f.contents || {}).map(([id, ops]) => [id, flatten(ops)])
      )
    }))
  };
  baseValidateProject(flat);
  v.renderStyle = flat.renderStyle;
  v.pixelSize = flat.pixelSize;
  v.format = 'jago-loop-studio';
  v.version = 5;
  if (
    v.guideMode !== undefined &&
    !['none', 'grid', 'arc', 'thirds', 'centre', 'isometric', 'perspective', 'pixels'].includes(
      v.guideMode
    )
  )
    throw Error('Invalid guide mode');
  if (v.gridSettings !== undefined) {
    if (!v.gridSettings || typeof v.gridSettings !== 'object' || Array.isArray(v.gridSettings))
      throw Error('Invalid grid guide');
    for (const [k, a, b] of [
      ['width', 8, 256],
      ['height', 8, 256],
      ['x', 0, 256],
      ['y', 0, 256],
      ['major', 1, 10]
    ])
      if (!Number.isInteger(v.gridSettings[k]) || !finite(v.gridSettings[k], a, b))
        throw Error('Invalid grid setting');
  }
  if (v.guideSettings !== undefined) {
    if (!v.guideSettings || typeof v.guideSettings !== 'object' || Array.isArray(v.guideSettings))
      throw Error('Invalid arc guide');
    for (const [k, a, b] of [
      ['x', 0, 100],
      ['y', 0, 100],
      ['width', 10, 180],
      ['height', -80, 80],
      ['steps', 2, 24]
    ])
      if (!Number.isInteger(v.guideSettings[k]) || !finite(v.guideSettings[k], a, b))
        throw Error('Invalid arc guide setting');
  }
  if (v.motionLoopSeconds !== undefined && !finite(v.motionLoopSeconds, 1, 12))
    throw Error('Invalid loop duration');
  if (
    v.shadePalette !== undefined &&
    (!Array.isArray(v.shadePalette) ||
      v.shadePalette.length !== 3 ||
      v.shadePalette.some((c) => typeof c !== 'string' || !/^#[0-9a-f]{6}$/i.test(c)))
  )
    throw Error('Invalid shading palette');
  if (v.brushTips !== undefined) {
    if (
      !v.brushTips ||
      Array.isArray(v.brushTips) ||
      typeof v.brushTips !== 'object' ||
      Object.keys(v.brushTips).length > 24
    )
      throw Error('Invalid brush library');
    for (const [id, tip] of Object.entries(v.brushTips)) {
      if (
        !/^tip[a-z0-9]+$/i.test(id) ||
        !tip ||
        typeof tip.name !== 'string' ||
        tip.name.length > 50 ||
        typeof tip.src !== 'string' ||
        !/^data:image\/png;base64,/.test(tip.src) ||
        tip.src.length > 2e6
      )
        throw Error('Invalid custom brush');
    }
  }
  const ids = new Set(v.layers.map((l) => l.id));
  for (let i = 0; i < v.layers.length; i++) {
    const l = v.layers[i];
    if (l.motion) l.motion = validateMotion(l.motion);
    if (l.alphaLock !== undefined && typeof l.alphaLock !== 'boolean')
      throw Error('Invalid alpha lock');
    if (l.followMotion !== undefined && typeof l.followMotion !== 'boolean')
      throw Error('Invalid clipping motion');
    if (
      l.blend &&
      !['source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten'].includes(l.blend)
    )
      throw Error('Invalid blend mode');
    if (l.clipTo && (!ids.has(l.clipTo) || !v.layers.slice(0, i).some((b) => b.id === l.clipTo)))
      throw Error('A clipping layer must be above its base');
  }
  let masks = groupMasks;
  for (const f of v.frames)
    for (const ops of Object.values(f.contents))
      for (const op of allOperations(ops)) {
        if (op.symmetry) {
          const m = op.symmetry;
          if (
            !['vertical', 'horizontal', 'both', 'radial'].includes(m.mode) ||
            !finite(m.centerX, -1e6, 1e6) ||
            !finite(m.centerY, -1e6, 1e6) ||
            !Number.isInteger(m.segments) ||
            !finite(m.segments, 2, 12)
          )
            throw Error('Invalid symmetry settings');
        }
        if (op.boilSpacing !== undefined && !finite(op.boilSpacing, 1, 100))
          throw Error('Invalid line-boil spacing');
        if (op.motion) op.motion = validateMotion(op.motion);
        if (op.tool === 'stamp') {
          op.brush = validateBrush(op.brush);
          if (!builtinTips.includes(op.brush.tip) && !v.brushTips?.[op.brush.tip])
            throw Error('A custom brush tip is missing');
        }
        if (op.alphaLock !== undefined && typeof op.alphaLock !== 'boolean')
          throw Error('Invalid alpha lock');
        if (op.composite !== undefined && op.composite !== 'erase')
          throw Error('Invalid image operation');
        if (op.selection) {
          if (!Array.isArray(op.selection) || op.selection.length < 3 || op.selection.length > 1200)
            throw Error('Invalid selection mask');
          masks += op.selection.length;
          if (masks > 100000) throw Error('Too many selection points');
          for (const p of op.selection)
            if (!finite(p.x, -1e6, 1e6) || !finite(p.y, -1e6, 1e6))
              throw Error('Invalid selection point');
        }
      }
  return v;
};

function selectionBounds(points = selection?.points) {
  if (!points?.length) return null;
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  return {
    x: Math.max(0, Math.floor(Math.min(...xs))),
    y: Math.max(0, Math.floor(Math.min(...ys))),
    w:
      Math.min(project.width, Math.ceil(Math.max(...xs))) -
      Math.max(0, Math.floor(Math.min(...xs))),
    h:
      Math.min(project.height, Math.ceil(Math.max(...ys))) -
      Math.max(0, Math.floor(Math.min(...ys)))
  };
}

function addPolygonCorner(p) {
  if (!selectionDrag) {
    beginSelection(null, p);
    toast('Click corners. Enter or double-click closes; Backspace removes a corner.');
    return;
  }
  const points = selectionDrag.points;
  if (points.length >= 3 && Math.hypot(p.x - points[0].x, p.y - points[0].y) < 8 / zoom) {
    finishSelection(false);
    return;
  }
  const last = points.at(-1);
  if (points.length < 1000 && Math.hypot(p.x - last.x, p.y - last.y) > 1 / zoom) points.push(p);
  selectionDrag.hover = p;
  renderNeeded = true;
}

function beginSelection(e, p) {
  selection = null;
  selectionDrag = { tool, points: [p] };
  renderNeeded = true;
}

function extendSelection(e) {
  const p = pointFrom(e),
    a = selectionDrag.points[0];
  if (selectionDrag.tool === 'select') {
    selectionDrag.points = [a, p];
  } else if (
    Math.hypot(p.x - selectionDrag.points.at(-1).x, p.y - selectionDrag.points.at(-1).y) > 3 &&
    selectionDrag.points.length < 1000
  )
    selectionDrag.points.push(p);
  renderNeeded = true;
}

function finishSelection(cancel) {
  if (!cancel) {
    const ps = selectionDrag.points;
    if (selectionDrag.tool === 'select' && ps.length === 2) {
      const [a, b] = ps;
      selection = { points: [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }] };
    } else if (ps.length >= 3) selection = { points: ps };
    const bounds = selectionBounds();
    if (
      !bounds ||
      bounds.w < (project.canvasMode === 'pixel' ? 1 : 2) ||
      bounds.h < (project.canvasMode === 'pixel' ? 1 : 2)
    )
      selection = null;
  }
  selectionDrag = null;
  renderCache.clear();
  renderNeeded = true;
  syncWorkflowUI();
}

function clearSelection() {
  selection = null;
  selectionDrag = null;
  renderCache.clear();
  renderNeeded = true;
  syncWorkflowUI();
}

function drawSelectionPath(c, points) {
  c.beginPath();
  points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  c.closePath();
}

function stillLayer() {
  const before = renderingStill;
  renderingStill = true;
  try {
    const raw = renderLayer(project.current, project.activeLayer, 0),
      c = makeCanvas();
    c.getContext('2d').drawImage(raw, 0, 0);
    return c;
  } finally {
    renderingStill = before;
  }
}

function selectionPixels() {
  if (!selection) throw Error('Make a selection first.');
  const b = selectionBounds(),
    raw = stillLayer(),
    mask = makeCanvas(),
    mc = mask.getContext('2d');
  drawSelectionPath(mc, selection.points);
  mc.fill();
  mc.globalCompositeOperation = 'source-in';
  mc.drawImage(raw, 0, 0);
  const c = makeCanvas(b.w, b.h);
  c.getContext('2d').drawImage(mask, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
  const src = c.toDataURL('image/png');
  imageCache.set(src, c);
  return { kind: 'image', src, x: b.x, y: b.y, w: b.w, h: b.h, opacity: 1 };
}

async function selectionImage() {
  return selectionPixels();
}

function selectionMask() {
  const b = selectionBounds(),
    c = makeCanvas(b.w, b.h),
    cx = c.getContext('2d');
  cx.translate(-b.x, -b.y);
  drawSelectionPath(cx, selection.points);
  cx.fill();
  const src = c.toDataURL('image/png');
  imageCache.set(src, c);
  return { kind: 'image', src, x: b.x, y: b.y, w: b.w, h: b.h, opacity: 1, composite: 'erase' };
}

async function selectionEraser() {
  return selectionMask();
}

function liveSelection(ops, points, outside = false, transform = [1, 0, 0, 1, 0, 0]) {
  return { kind: 'group', ops, clip: copy(points), outside, transform: [...transform] };
}

function checkedSelectionOps(ops, tips = project.brushTips) {
  const candidate = copy(project);
  candidate.brushTips = tips;
  candidate.frames[candidate.current].contents[candidate.activeLayer] = ops;
  validateProject(candidate);
  return ops;
}

function selectionParts() {
  if (!selection) throw Error('Make a selection first.');
  const original = copy(currentOps());
  return {
    outside: liveSelection(original, selection.points, true),
    inside: liveSelection(original, selection.points)
  };
}

function insideSelection(p) {
  if (!selection) return false;
  // Test the actual lasso polygon, including concave shapes and rotated selections.
  let winding = 0;
  const points = selection.points;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i],
      b = points[j];
    const cross = (b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y);
    if (
      Math.abs(cross) < 1e-7 &&
      p.x >= Math.min(a.x, b.x) &&
      p.x <= Math.max(a.x, b.x) &&
      p.y >= Math.min(a.y, b.y) &&
      p.y <= Math.max(a.y, b.y)
    )
      return true;
    if (a.y <= p.y && b.y > p.y && cross > 0) winding++;
    if (a.y > p.y && b.y <= p.y && cross < 0) winding--;
  }
  return winding !== 0;
}

function beginSelectionMove(e) {
  try {
    const ops = copy(currentOps()),
      index =
        selection.liveOpsCount === ops.length && ops[selection.liveGroupIndex]?.kind === 'group'
          ? selection.liveGroupIndex
          : null;
    const parts = index === null ? selectionParts() : null;
    if (parts) checkedSelectionOps([parts.outside, parts.inside]);
    moving = {
      selection: true,
      x: e.clientX,
      y: e.clientY,
      ops,
      points: copy(selection.points),
      savedSelection: copy(selection),
      parts,
      index,
      changed: false
    };
  } catch (err) {
    toast(err.message);
  }
}

function updateSelectionMove(dx, dy) {
  if (project.renderStyle === 'pixel') {
    dx = Math.round(dx / project.pixelSize) * project.pixelSize;
    dy = Math.round(dy / project.pixelSize) * project.pixelSize;
  }
  moving.changed = dx !== 0 || dy !== 0;
  let index = moving.index,
    ops;
  if (!moving.changed) ops = moving.ops;
  else if (index !== null) {
    ops = moving.ops.slice();
    const group = copy(ops[index]);
    group.transform[4] += dx;
    group.transform[5] += dy;
    ops[index] = group;
  } else {
    const group = { ...moving.parts.inside, transform: [1, 0, 0, 1, dx, dy] };
    ops = [moving.parts.outside, group];
    index = 1;
  }
  currentFrame().contents[project.activeLayer] = ops;
  selection = {
    points: moving.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
    liveGroupIndex: index,
    liveOpsCount: ops.length,
    previewLive: false,
    box: moving.savedSelection.box?.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }))
  };
  invalidate();
  syncWorkflowUI();
}

function selectionBox() {
  if (selection?.box) return copy(selection.box);
  if (!selection) return null;
  const xs = selection.points.map((p) => p.x),
    ys = selection.points.map((p) => p.y),
    x = Math.min(...xs),
    y = Math.min(...ys),
    r = Math.max(...xs),
    b = Math.max(...ys);
  return [
    { x, y },
    { x: r, y },
    { x: r, y: b },
    { x, y: b }
  ];
}

function selectionHandles() {
  const box = selectionBox();
  if (!box) return null;
  const centre = { x: (box[0].x + box[2].x) / 2, y: (box[0].y + box[2].y) / 2 },
    top = { x: (box[0].x + box[1].x) / 2, y: (box[0].y + box[1].y) / 2 },
    length = Math.hypot(top.x - centre.x, top.y - centre.y) || 1;
  const rotation = {
    x: clamp(
      top.x + (((top.x - centre.x) / length) * 28) / zoom,
      10 / zoom,
      project.width - 10 / zoom
    ),
    y: clamp(
      top.y + (((top.y - centre.y) / length) * 28) / zoom,
      10 / zoom,
      project.height - 10 / zoom
    )
  };
  return { box, centre, top, rotation };
}

function hitSelectionHandle(p) {
  if (!selection || !['move', 'select', 'lasso', 'polygon'].includes(tool)) return null;
  const h = selectionHandles(),
    radius = 11 / zoom;
  if (Math.hypot(p.x - h.rotation.x, p.y - h.rotation.y) < radius) return 'rotate';
  for (let i = 0; i < 4; i++) if (Math.hypot(p.x - h.box[i].x, p.y - h.box[i].y) < radius) return i;
  return null;
}

function matrixPoint(m, p) {
  return { ...p, x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

function multiplyMatrices(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5]
  ];
}

function beginSelectionHandle(e, handle) {
  if (!canDraw()) return;
  const geometry = selectionHandles();
  beginSelectionMove(e);
  if (!moving) return;
  moving.handle = handle;
  moving.geometry = geometry;
  const p = pointFrom(e);
  moving.angle = Math.atan2(p.y - geometry.centre.y, p.x - geometry.centre.x);
}

function updateSelectionHandle(e) {
  const m = moving,
    h = m.geometry,
    r = canvas.getBoundingClientRect(),
    p = { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom };
  let matrix;
  if (m.handle === 'rotate') {
    let angle = Math.atan2(p.y - h.centre.y, p.x - h.centre.x) - m.angle;
    if (e.shiftKey) angle = (Math.round(angle / (Math.PI / 12)) * Math.PI) / 12;
    const c = Math.cos(angle),
      s = Math.sin(angle),
      { x, y } = h.centre;
    matrix = [c, s, -s, c, x - c * x + s * y, y - s * x - c * y];
  } else {
    const corner = h.box[m.handle],
      anchor = h.box[(m.handle + 2) % 4],
      width = Math.hypot(h.box[1].x - h.box[0].x, h.box[1].y - h.box[0].y),
      height = Math.hypot(h.box[3].x - h.box[0].x, h.box[3].y - h.box[0].y);
    const u = { x: (h.box[1].x - h.box[0].x) / width, y: (h.box[1].y - h.box[0].y) / width },
      v = { x: (h.box[3].x - h.box[0].x) / height, y: (h.box[3].y - h.box[0].y) / height },
      dx = p.x - anchor.x,
      dy = p.y - anchor.y;
    let sx = clamp(
        (dx * u.x + dy * u.y) / ((corner.x - anchor.x) * u.x + (corner.y - anchor.y) * u.y),
        0.05,
        8
      ),
      sy = clamp(
        (dx * v.x + dy * v.y) / ((corner.x - anchor.x) * v.x + (corner.y - anchor.y) * v.y),
        0.05,
        8
      );
    if (e.shiftKey) sx = sy = Math.max(sx, sy);
    const a = sx * u.x * u.x + sy * v.x * v.x,
      b = sx * u.x * u.y + sy * v.x * v.y,
      d = sx * u.y * u.y + sy * v.y * v.y;
    matrix = [
      a,
      b,
      b,
      d,
      anchor.x - a * anchor.x - b * anchor.y,
      anchor.y - b * anchor.x - d * anchor.y
    ];
  }
  const index = m.index === null ? 1 : m.index,
    ops = m.index === null ? [m.parts.outside, copy(m.parts.inside)] : m.ops.slice(),
    group = copy(ops[index]);
  group.transform = multiplyMatrices(matrix, group.transform);
  ops[index] = group;
  currentFrame().contents[project.activeLayer] = ops;
  selection = {
    points: m.points.map((p) => matrixPoint(matrix, p)),
    box: h.box.map((p) => matrixPoint(matrix, p)),
    liveGroupIndex: index,
    liveOpsCount: ops.length,
    previewLive: false
  };
  m.changed = true;
  invalidate();
  syncWorkflowUI();
}

function paintSelectionHandles() {
  if (!selection || selectionDrag || !['move', 'select', 'lasso', 'polygon'].includes(tool)) return;
  const h = selectionHandles(),
    size = 8 / zoom;
  ctx.setLineDash([]);
  ctx.strokeStyle = '#6251bd';
  ctx.fillStyle = '#fffdf9';
  ctx.lineWidth = 1.5 / zoom;
  if (!selection.points.every((p) => h.box.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < 0.01))) {
    ctx.strokeStyle = '#9d97b0';
    drawSelectionPath(ctx, h.box);
    ctx.stroke();
    ctx.strokeStyle = '#6251bd';
  }
  ctx.beginPath();
  ctx.moveTo(h.top.x, h.top.y);
  ctx.lineTo(h.rotation.x, h.rotation.y);
  ctx.stroke();
  for (const p of h.box) {
    ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
    ctx.strokeRect(p.x - size / 2, p.y - size / 2, size, size);
  }
  ctx.beginPath();
  ctx.arc(h.rotation.x, h.rotation.y, 5 / zoom, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

async function copySelection(cut = false) {
  try {
    if (cut && !canDraw()) return;
    const parts = selectionParts();
    checkedSelectionOps(cut ? [parts.outside] : [...currentOps(), parts.inside]);
    artClipboard = parts.inside;
    artClipboardTips = copy(project.brushTips || {});
    if (cut) {
      currentFrame().contents[project.activeLayer] = [parts.outside];
      clearSelection();
      commit('Selection cut with motion preserved');
    } else toast('Selection copied with motion preserved');
    syncWorkflowUI();
  } catch (e) {
    toast(e.message);
  }
}

async function deleteSelection() {
  if (!canDraw()) return;
  try {
    const parts = selectionParts();
    currentFrame().contents[project.activeLayer] = checkedSelectionOps([parts.outside]);
    clearSelection();
    commit('Selected artwork removed');
  } catch (e) {
    toast(e.message);
  }
}

async function pasteSelection() {
  if (!artClipboard || !canDraw()) return;
  try {
    const op = copy(artClipboard),
      tips = copy(project.brushTips || {}),
      remap = {};
    for (const [id, tip] of Object.entries(artClipboardTips)) {
      const next = tips[id] && tips[id].src !== tip.src ? 'tip' + uid() : id;
      remap[id] = next;
      tips[next] = tip;
    }
    const nodes = allOperations([op]);
    for (const item of nodes)
      if (item.brush && remap[item.brush.tip]) item.brush.tip = remap[item.brush.tip];
    await Promise.all(
      [
        ...nodes.filter((item) => item.kind === 'image').map((item) => item.src),
        ...Object.values(tips).map((t) => t.src)
      ].map(cacheImage)
    );
    const next = checkedSelectionOps([...currentOps(), op], tips);
    project.brushTips = tips;
    currentFrame().contents[project.activeLayer] = next;
    clearSelection();
    commit('Selection pasted with motion preserved');
  } catch (e) {
    toast(e.message);
  }
}

async function transformSelection() {
  if (!canDraw()) return;
  try {
    const b = selectionBounds(),
      parts = selectionParts(),
      scale = clamp(Number($('selectionScale').value) || 100, 10, 400) / 100,
      angle = (clamp(Number($('selectionAngle').value) || 0, -180, 180) * Math.PI) / 180,
      dx = clamp(Number($('selectionX').value) || 0, -2048, 2048),
      dy = clamp(Number($('selectionY').value) || 0, -2048, 2048),
      cx = b.x + b.w / 2,
      cy = b.y + b.h / 2,
      a = Math.cos(angle) * scale,
      d = Math.sin(angle) * scale;
    parts.inside.transform = [a, d, -d, a, cx + dx - a * cx + d * cy, cy + dy - d * cx - a * cy];
    currentFrame().contents[project.activeLayer] = checkedSelectionOps([
      parts.outside,
      parts.inside
    ]);
    clearSelection();
    commit('Selection transformed with motion preserved');
  } catch (e) {
    toast(e.message);
  }
}

function copyFrameArtwork() {
  frameClipboard = {
    layers: copy(project.layers),
    contents: copy(currentFrame().contents),
    tips: copy(project.brushTips || {})
  };
  toast('Frame artwork copied');
}

function pasteFrameArtwork() {
  if (!frameClipboard || !canDraw()) return;
  const missing = frameClipboard.layers.filter((l) => !project.layers.some((p) => p.id === l.id));
  if (project.layers.length + missing.length > 12) {
    toast('Pasting would exceed 12 layers');
    return;
  }
  const tips = { ...(project.brushTips || {}), ...copy(frameClipboard.tips) };
  if (Object.keys(tips).length > 24) {
    toast('Pasting would exceed 24 custom brush tips');
    return;
  }
  project.brushTips = tips;
  for (const layer of missing) {
    const next = { ...copy(layer), locked: false };
    if (next.clipTo && !project.layers.some((l) => l.id === next.clipTo)) delete next.clipTo;
    project.layers.push(next);
    for (const frame of project.frames) frame.contents[next.id] = [];
  }
  for (const layer of frameClipboard.layers) {
    const target = project.layers.find((l) => l.id === layer.id);
    if (target.locked) continue;
    currentFrame().contents[target.id].push(...copy(frameClipboard.contents[layer.id] || []));
  }
  preloadImages()
    .then(() => commit('Frame artwork pasted'))
    .catch(() => toast('A brush image could not load'));
}

function addClippingLayer() {
  if (project.layers.length >= 12) {
    toast('This project has reached 12 layers');
    return;
  }
  const base = activeLayer(),
    index = project.layers.indexOf(base),
    id = uid();
  project.layers.splice(index + 1, 0, {
    id,
    name: base.name + ' shading',
    visible: true,
    locked: false,
    opacity: 1,
    clipTo: base.id,
    followMotion: true,
    blend: 'multiply'
  });
  project.frames.forEach((f) => (f.contents[id] = []));
  project.activeLayer = id;
  stampSettings.tip = 'solid';
  setTool('stamp');
  brushSize = 30;
  syncBrushUI();
  commit('Clipping layer added');
}

function repairClipping() {
  const before = new Set();
  for (const l of project.layers) {
    if (l.clipTo && !before.has(l.clipTo)) delete l.clipTo;
    before.add(l.id);
  }
}
moveLayer = function (d) {
  const i = project.layers.indexOf(activeLayer()),
    j = i + d;
  if (j < 0 || j >= project.layers.length) return;
  [project.layers[i], project.layers[j]] = [project.layers[j], project.layers[i]];
  repairClipping();
  commit();
};
selectFrame = function (i) {
  clearSelection();
  baseSelectFrame(i);
};
afterRestore = function () {
  clearSelection();
  motionPreview = false;
  baseAfterRestore();
};
updateUI = function () {
  repairClipping();
  baseUpdateUI();
  if (uiReady) syncStudioUI();
};
saveLocal = function () {
  const previous = localStorage.getItem(JAGO_KEY);
  baseSaveLocal();
  if (autosaveFailed || !previous || previous === snapshot()) return;
  if (Date.now() - lastRecovery < 30000) return;
  try {
    let items = JSON.parse(localStorage.getItem(recoveryKey) || '[]');
    if (previous.length < 1500000) {
      items.unshift({ time: Date.now(), data: previous });
      items = items.slice(0, 3);
      while (JSON.stringify(items).length > 2000000) items.pop();
      localStorage.setItem(recoveryKey, JSON.stringify(items));
      lastRecovery = Date.now();
    }
  } catch (e) {
    /* The main autosave remains valid if recovery storage is full. */
  }
};

function checkpoint() {
  try {
    const data = snapshot();
    if (data.length > 1500000) {
      toast('This project is large. Save a .jago file for a backup.');
      return;
    }
    let items = JSON.parse(localStorage.getItem(recoveryKey) || '[]');
    items.unshift({ time: Date.now(), data });
    items = items.slice(0, 3);
    while (JSON.stringify(items).length > 2000000) items.pop();
    localStorage.setItem(recoveryKey, JSON.stringify(items));
    toast('Recovery snapshot saved');
  } catch (e) {
    toast('Recovery storage is full. Save a project file.');
  }
}

function showRecovery() {
  const list = $('recoveryList');
  list.replaceChildren();
  let items = [];
  try {
    items = JSON.parse(localStorage.getItem(recoveryKey) || '[]');
  } catch (e) {}
  for (const item of items) {
    try {
      const saved = validateProject(JSON.parse(item.data)),
        button = document.createElement('button');
      button.textContent = saved.name + ' · ' + new Date(item.time).toLocaleString();
      button.onclick = () =>
        confirmAction(
          'Open recovery snapshot?',
          'Save your current project first if you want to keep it.',
          async () => {
            project = validateProject(JSON.parse(item.data));
            await preloadImages();
            clearSelection();
            resizeBuffers();
            invalidate();
            resetHistory();
            updateUI();
            fit();
            scheduleSave();
            $('recoveryDialog').close();
          }
        );
      list.append(button);
    } catch (e) {}
  }
  if (!list.children.length)
    list.textContent = 'No recovery snapshots yet. Use Save snapshot to make one.';
  $('recoveryDialog').showModal();
}

function handleStudioShortcut(e, input, modal) {
  if (input || modal || exporting) return false;
  const k = e.key.toLowerCase();
  if (selectionDrag?.tool === 'polygon' && ['enter', 'backspace'].includes(k)) {
    e.preventDefault();
    if (k === 'enter') finishSelection(false);
    else if (selectionDrag.points.length > 1) selectionDrag.points.pop();
    else finishSelection(true);
    renderNeeded = true;
    return true;
  }
  if (k === 'escape' && (moving || drawing || selectionDrag)) {
    finishStroke(true);
    return true;
  }
  if (k === 'escape' && selection) {
    clearSelection();
    return true;
  }
  if ((e.ctrlKey || e.metaKey) && ['c', 'x', 'v'].includes(k)) {
    if (k === 'v' && artClipboard) {
      e.preventDefault();
      pasteSelection();
      return true;
    }
    if (selection) {
      e.preventDefault();
      copySelection(k === 'x');
      return true;
    }
  }
  if ((k === 'delete' || k === 'backspace') && selection) {
    e.preventDefault();
    deleteSelection();
    return true;
  }
  return false;
}

function paintOverlays() {
  ctx.save();
  ctx.lineWidth = 1 / zoom;
  ctx.strokeStyle = '#7976a0';
  ctx.globalAlpha = 0.65;
  if (guides === 'grid') {
    const g = gridSettings();
    for (const strong of [false, true]) {
      ctx.globalAlpha = strong ? 0.65 : 0.28;
      ctx.beginPath();
      for (
        let n = Math.ceil(-g.x / g.width), x = g.x + n * g.width;
        x <= project.width;
        n++, x = g.x + n * g.width
      )
        if ((n % g.major === 0) === strong) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, project.height);
        }
      for (
        let n = Math.ceil(-g.y / g.height), y = g.y + n * g.height;
        y <= project.height;
        n++, y = g.y + n * g.height
      )
        if ((n % g.major === 0) === strong) {
          ctx.moveTo(0, y);
          ctx.lineTo(project.width, y);
        }
      ctx.stroke();
    }
    ctx.globalAlpha = 0.65;
  }
  if (guides === 'arc') {
    const { start: a, end: b, control: c, steps } = arcGeometry();
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(c.x, c.y, b.x, b.y);
    ctx.stroke();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps,
        u = 1 - t,
        x = u * u * a.x + 2 * u * t * c.x + t * t * b.x,
        y = u * u * a.y + 2 * u * t * c.y + t * t * b.y;
      ctx.beginPath();
      ctx.arc(x, y, 3 / zoom, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  if (symmetry) paintSymmetryGuides();

  const points =
    selection?.points ||
    (selectionDrag?.tool === 'select' && selectionDrag.points.length === 2
      ? (() => {
          const [a, b] = selectionDrag.points;
          return [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }];
        })()
      : selectionDrag?.tool === 'polygon' && selectionDrag.hover
        ? [...selectionDrag.points, selectionDrag.hover]
        : selectionDrag?.points);
  if (points?.length > 1) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#7966d00d';
    drawSelectionPath(ctx, points);
    ctx.fill();
    ctx.strokeStyle = '#7970da';
    ctx.setLineDash([5 / zoom, 4 / zoom]);
    drawSelectionPath(ctx, points);
    ctx.stroke();
  }
  paintSelectionHandles();
  ctx.restore();
}
paintCanvas = function () {
  const still = !!(
      selectionDrag ||
      drawing ||
      moving?.selection ||
      (selection && !selection.previewLive)
    ),
    before = renderingStill;
  renderingStill = still;
  try {
    if (still) {
      const fi = playing ? playIndex : project.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(renderFrame(fi, 0, true, true), 0, 0);
      renderNeeded = false;
    } else legacyPaintCanvas();
    paintOverlays();
  } finally {
    renderingStill = before;
  }
};

function layerThumbnail(layer) {
  const c = makeCanvas(64, 44);
  c.className = 'layer-thumbnail';
  c.setAttribute('role', 'img');
  c.setAttribute('aria-label', layer.name + ' preview, current frame');
  c.title = 'Current-frame artwork';
  const cc = c.getContext('2d'),
    s = Math.min(64 / project.width, 44 / project.height);
  cc.imageSmoothingEnabled = project.renderStyle !== 'pixel';
  cc.drawImage(
    renderLayer(project.current, layer.id, 0),
    (64 - project.width * s) / 2,
    (44 - project.height * s) / 2,
    project.width * s,
    project.height * s
  );
  return c;
}

function duplicateActiveLayer() {
  if (project.layers.length >= 12) {
    toast('This project has reached 12 layers');
    return;
  }
  const source = activeLayer(),
    layer = {
      ...copy(source),
      id: uid(),
      name: (source.name + ' copy').slice(0, 100),
      locked: false
    };
  const candidate = copy(project),
    index = candidate.layers.findIndex((l) => l.id === source.id);
  candidate.layers.splice(index + 1, 0, layer);
  candidate.frames.forEach((f) => (f.contents[layer.id] = copy(f.contents[source.id] || [])));
  candidate.activeLayer = layer.id;
  try {
    validateProject(candidate);
    project = candidate;
    clearSelection();
    commit('Layer duplicated across all frames');
  } catch (e) {
    toast(e.message);
  }
}

const onionDefaults = { before: 1, after: 1, opacity: 0.2, fade: true, original: false };
let onionSettings = { ...onionDefaults };

function paintOnionFrames(fi) {
  for (
    let distance = Math.max(onionSettings.before, onionSettings.after);
    distance >= 1;
    distance--
  ) {
    const alpha = onionSettings.opacity / (onionSettings.fade ? distance : 1);
    if (distance <= onionSettings.before && fi - distance >= 0)
      drawOnion(fi - distance, onionSettings.original ? null : '#ea5c86', alpha);
    if (distance <= onionSettings.after && fi + distance < project.frames.length)
      drawOnion(fi + distance, onionSettings.original ? null : '#53aacf', alpha);
  }
}

function syncOnionUI() {
  for (const [id, key, factor] of [
    ['onionBefore', 'before', 1],
    ['onionAfter', 'after', 1],
    ['onionOpacity', 'opacity', 100]
  ])
    setRange(id, onionSettings[key] * factor);
  $('onionEnabled').checked = onion;
  $('onionFade').checked = onionSettings.fade;
  $('onionOriginal').checked = onionSettings.original;
  $('onionBtn').setAttribute('aria-pressed', String(onion));
  renderNeeded = true;
}

function saveOnionSettings() {
  try {
    localStorage.setItem('jago-loop-onion', JSON.stringify(onionSettings));
  } catch (e) {}
  syncOnionUI();
}

function initialiseOnion() {
  try {
    const s = JSON.parse(localStorage.getItem('jago-loop-onion') || '{}');
    for (const [key, a, b] of [
      ['before', 0, 8],
      ['after', 0, 8],
      ['opacity', 0.05, 0.8]
    ])
      if (finite(s[key], a, b) && (key === 'opacity' || Number.isInteger(s[key])))
        onionSettings[key] = s[key];
    for (const key of ['fade', 'original'])
      if (typeof s[key] === 'boolean') onionSettings[key] = s[key];
  } catch (e) {}
  $('onionSettingsBtn').onclick = () => {
    syncOnionUI();
    $('onionDialog').showModal();
  };
  $('onionEnabled').onchange = (e) => {
    onion = e.target.checked;
    syncOnionUI();
  };
  for (const [id, key, factor] of [
    ['onionBefore', 'before', 1],
    ['onionAfter', 'after', 1],
    ['onionOpacity', 'opacity', 100]
  ])
    $(id).oninput = (e) => {
      onionSettings[key] = +e.target.value / factor;
      onion = true;
      saveOnionSettings();
    };
  for (const [id, key] of [
    ['onionFade', 'fade'],
    ['onionOriginal', 'original']
  ])
    $(id).onchange = (e) => {
      onionSettings[key] = e.target.checked;
      saveOnionSettings();
    };
  $('resetOnion').onclick = () => {
    onionSettings = { ...onionDefaults };
    saveOnionSettings();
  };
  syncOnionUI();
}

function syncSymmetryUI() {
  $('mirrorMode').value = symmetrySettings.mode;
  for (const [id, key] of [
    ['mirrorX', 'x'],
    ['mirrorY', 'y'],
    ['mirrorSegments', 'segments']
  ])
    setRange(id, symmetrySettings[key]);
  $('mirrorSegmentsControl').classList.toggle('hidden', symmetrySettings.mode !== 'radial');
  renderNeeded = true;
}

function initialiseSymmetry() {
  $('mirrorMode').onchange = (e) => {
    symmetrySettings.mode = e.target.value;
    syncSymmetryUI();
  };
  for (const [id, key] of [
    ['mirrorX', 'x'],
    ['mirrorY', 'y'],
    ['mirrorSegments', 'segments']
  ])
    $(id).oninput = (e) => {
      symmetrySettings[key] = +e.target.value;
      syncSymmetryUI();
    };
  $('resetMirror').onclick = () => {
    symmetrySettings = { ...symmetryDefaults };
    syncSymmetryUI();
  };
  syncSymmetryUI();
}

function paintSymmetryGuides() {
  const x = (project.width * symmetrySettings.x) / 100,
    y = (project.height * symmetrySettings.y) / 100,
    mode = symmetrySettings.mode;
  ctx.save();
  ctx.strokeStyle = '#a46da7';
  ctx.setLineDash([5 / zoom, 5 / zoom]);
  ctx.beginPath();
  if (mode === 'vertical' || mode === 'both') {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, project.height);
  }
  if (mode === 'horizontal' || mode === 'both') {
    ctx.moveTo(0, y);
    ctx.lineTo(project.width, y);
  }
  if (mode === 'radial') {
    const length = Math.hypot(project.width, project.height);
    for (let i = 0; i < symmetrySettings.segments; i++) {
      const a = (i * Math.PI * 2) / symmetrySettings.segments;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * length, y + Math.sin(a) * length);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(x, y, 4 / zoom, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
