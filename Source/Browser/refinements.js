// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Cameron Jago Lis Illustrates.
'use strict';

// Pattern tiles stay the same physical size as the brush footprint changes.
const individualPatternCache = new Map();

function individualPatternTip(settings, color, size, cell) {
  const side = Math.max(1, Math.ceil(size)),
    key = [
      settings.tip,
      color,
      side,
      settings.patternScale,
      settings.density,
      settings.patternAngle || 0,
      cell,
      project.canvasMode
    ].join(':');
  if (individualPatternCache.has(key)) return individualPatternCache.get(key);
  const tip = makeCanvas(side, side),
    c = tip.getContext('2d');
  c.fillStyle = color;
  if (settings.tip === 'chalk') c.fillRect(side * 0.094, side * 0.102, side * 0.812, side * 0.797);
  else if (project.canvasMode === 'pixel')
    pixelDisk(c, Math.floor(side / 2), Math.floor(side / 2), side);
  else {
    c.beginPath();
    c.arc(side / 2, side / 2, side / 2, 0, Math.PI * 2);
    c.fill();
  }
  c.globalCompositeOperation = 'destination-in';
  c.drawImage(patternMask(settings, side, side, cell), 0, 0);
  if (individualPatternCache.size >= 64)
    individualPatternCache.delete(individualPatternCache.keys().next().value);
  individualPatternCache.set(key, tip);
  return tip;
}

const sprayDefaults = Object.freeze({
  density: 45,
  dotSize: 2,
  spread: 100,
  focus: 25,
  shape: 'round'
});
let spraySettings = { ...sprayDefaults };

function validateSpray(s) {
  if (!s || typeof s !== 'object') throw Error('Invalid spray settings');
  const out = { ...sprayDefaults, ...s };
  for (const [key, a, b] of [
    ['density', 5, 100],
    ['dotSize', 1, 12],
    ['spread', 10, 150],
    ['focus', 0, 100]
  ])
    if (!Number.isInteger(out[key]) || !finite(out[key], a, b))
      throw Error('Invalid spray setting: ' + key);
  if (!['round', 'horizontal', 'vertical'].includes(out.shape)) throw Error('Invalid spray shape');
  return out;
}

function drawSpray(c, op, tick, cell = 1) {
  const s = op.spray,
    points = stampPositions(
      { ...op, brush: { mode: 'continuous', spacing: 0.25 } },
      pathPoints(op, tick)
    );
  const paint = () => {
    for (const p of points) {
      const count = Math.max(2, Math.round(s.density * 0.35)),
        radius = (((op.size / 2) * s.spread) / 100) * (op.pressure ? 0.3 + p.p * 1.4 : 1);
      for (let i = 0; i < count; i++) {
        const seed = op.seed + p.index * 239 + i * 31,
          angle = random(seed) * Math.PI * 2,
          r = Math.pow(random(seed + 1), 0.5 + s.focus / 50) * radius;
        const x = (p.x + Math.cos(angle) * r * (s.shape === 'vertical' ? 0.28 : 1)) / cell,
          y = (p.y + Math.sin(angle) * r * (s.shape === 'horizontal' ? 0.28 : 1)) / cell,
          d = (s.dotSize * (0.5 + random(seed + 3))) / cell;
        c.globalAlpha = 0.25 + random(seed + 2) * 0.65;
        c.fillStyle = op.color;
        if (cell !== 1 || project.canvasMode === 'pixel')
          pixelDisk(c, Math.floor(x), Math.floor(y), d);
        else {
          c.beginPath();
          c.arc(x, y, d / 2, 0, Math.PI * 2);
          c.fill();
        }
      }
    }
  };
  c.save();
  paint();
  if (op.mirror) {
    c.translate(project.width / cell, 0);
    c.scale(-1, 1);
    paint();
  }
  c.restore();
}

function syncSprayUI() {
  $('sprayControls').classList.toggle('hidden', tool !== 'spray');
  for (const [id, key] of [
    ['sprayDensity', 'density'],
    ['sprayDotSize', 'dotSize'],
    ['spraySpread', 'spread'],
    ['sprayFocus', 'focus']
  ])
    setRange(id, spraySettings[key]);
  $('sprayShape').value = spraySettings.shape;
  if (tool === 'spray') paintSprayPreview();
}

function paintSprayPreview() {
  const c = $('sprayPreview'),
    cx = c.getContext('2d');
  cx.clearRect(0, 0, c.width, c.height);
  cx.fillStyle = project.paper;
  cx.fillRect(0, 0, c.width, c.height);
  const before = renderingStill;
  renderingStill = true;
  cx.save();
  cx.globalAlpha = opacity;
  try {
    drawSpray(
      cx,
      {
        kind: 'stroke',
        tool: 'spray',
        size: Math.min(brushSize, 48),
        color: colour,
        seed: 82,
        pressure: false,
        animate: false,
        mirror: false,
        spray: spraySettings,
        points: [
          { x: 45, y: 45, p: 0.5 },
          { x: 195, y: 45, p: 0.5 }
        ]
      },
      0
    );
  } finally {
    cx.restore();
    renderingStill = before;
  }
}

const guideDescriptions = {
  none: '',
  grid: 'A drawing guide with adjustable spacing and stronger major lines.',
  thirds:
    'Place a focal point near an intersection, or line up a horizon with either horizontal line.',
  centre: 'Find the middle of your composition with a simple cross.',
  isometric:
    'A 30-degree grid for drawing little rooms, boxes and isometric scenes. Cell width sets the spacing.',
  perspective:
    'Lines meet at the vanishing point. Move the point and horizon with the controls below.',
  pixels:
    'Each square is one artwork pixel on a pixel art canvas, or one Pixel-style block. Zoom in to see it.',
  arc: 'Use the dots as equally spaced moments along an arc, for example when planning a bouncing ball.'
};

function perspectiveSettings() {
  return { ...{ x: 50, y: 45 }, ...project.perspectiveSettings };
}

function paintExtraGuides() {
  const w = project.width,
    h = project.height,
    line = (x, y, xx, yy) => {
      ctx.moveTo(x, y);
      ctx.lineTo(xx, yy);
    };
  ctx.save();
  ctx.strokeStyle = '#7976a0';
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1 / zoom;
  ctx.beginPath();
  if (guides === 'thirds') {
    for (const f of [1 / 3, 2 / 3]) {
      line(w * f, 0, w * f, h);
      line(0, h * f, w, h * f);
    }
  }
  if (guides === 'centre') {
    line(w / 2, 0, w / 2, h);
    line(0, h / 2, w, h / 2);
  }
  if (guides === 'isometric') {
    const step = gridSettings().width,
      slope = Math.tan(Math.PI / 6);
    for (let x = 0; x <= w; x += step) line(x, 0, x, h);
    for (let y = -w * slope; y <= h + w * slope; y += step * slope) {
      line(0, y, w, y + w * slope);
      line(0, y, w, y - w * slope);
    }
  }
  if (guides === 'perspective') {
    const g = perspectiveSettings(),
      x = (w * g.x) / 100,
      y = (h * g.y) / 100;
    line(0, y, w, y);
    for (let i = 0; i <= 8; i++) {
      line(x, y, (w * i) / 8, 0);
      line(x, y, (w * i) / 8, h);
    }
    for (let i = 1; i < 6; i++) {
      line(x, y, 0, (h * i) / 6);
      line(x, y, w, (h * i) / 6);
    }
  }
  if (guides === 'pixels') {
    const cell = project.renderStyle === 'pixel' ? project.pixelSize : 1;
    if (cell * zoom >= 6) {
      ctx.globalAlpha = 0.25;
      for (let x = 0; x <= w; x += cell) line(x, 0, x, h);
      for (let y = 0; y <= h; y += cell) line(0, y, w, y);
    }
  }
  ctx.stroke();
  ctx.restore();
}

let placingPivot = false,
  pivotDrag = null,
  showMotionPivot = true,
  pivotLayerId = null;

function pivotGeometry() {
  const bounds = layerBounds(project.activeLayer);
  return {
    bounds,
    x: bounds.x + bounds.w * motionDraft.anchorX,
    y: bounds.y + bounds.h * motionDraft.anchorY
  };
}

function pivotVisible() {
  return (
    currentPanel === 'motion' && showMotionPivot && ['sway', 'breathe'].includes(motionDraft.type)
  );
}

function syncPivotUI() {
  $('placePivot').textContent = placingPivot
    ? 'Click canvas to place pivot'
    : 'Place pivot on canvas';
  $('pivotHint').textContent = placingPivot
    ? 'Click where you want the fixed point. Escape cancels.'
    : `Editing ${activeLayer().name}. Drag the cross to preview a new pivot, then Apply to layer to save it.`;
  $('showPivot').checked = showMotionPivot;
  renderNeeded = true;
}

function paintPivot() {
  if (!pivotVisible()) return;
  const p = pivotGeometry(),
    r = 8 / zoom;
  ctx.save();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.lineWidth = 2 / zoom;
  ctx.strokeStyle = '#f0658c';
  ctx.fillStyle = '#fffdf9';
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(p.x - r * 1.6, p.y);
  ctx.lineTo(p.x + r * 1.6, p.y);
  ctx.moveTo(p.x, p.y - r * 1.6);
  ctx.lineTo(p.x, p.y + r * 1.6);
  ctx.stroke();
  ctx.restore();
}

function movePivotTo(p) {
  const b = pivotDrag?.bounds || layerBounds(project.activeLayer);
  motionDraft.anchorX = clamp((p.x - b.x) / b.w, -2, 3);
  motionDraft.anchorY = clamp((p.y - b.y) / b.h, -2, 3);
  motionPreview = true;
  syncMotionUI();
  invalidate();
}

function installPivotControls() {
  $('placePivot').onclick = () => {
    if (!canDraw()) return;
    placingPivot = !placingPivot;
    showMotionPivot = true;
    syncPivotUI();
  };
  $('showPivot').onchange = (e) => {
    showMotionPivot = e.target.checked;
    placingPivot = false;
    syncPivotUI();
  };
  $('centrePivot').onclick = () => {
    motionDraft.anchorX = motionDraft.anchorY = 0.5;
    motionPreview = true;
    syncMotionUI();
    invalidate();
  };
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      if (
        !pivotVisible() ||
        exporting ||
        e.button !== 0 ||
        drawing ||
        moving ||
        panning ||
        selectionDrag ||
        !canDraw()
      )
        return;
      const p = pointFrom(e),
        g = pivotGeometry();
      if (!placingPivot && Math.hypot(p.x - g.x, p.y - g.y) > 14 / zoom) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      canvas.setPointerCapture(e.pointerId);
      pause();
      pivotDrag = {
        pointer: e.pointerId,
        bounds: g.bounds,
        draft: copy(motionDraft),
        preview: motionPreview
      };
      placingPivot = false;
      movePivotTo(p);
    },
    true
  );
  canvas.addEventListener(
    'pointermove',
    (e) => {
      if (!pivotDrag || pivotDrag.pointer !== e.pointerId) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      movePivotTo(pointFrom(e));
    },
    true
  );
  for (const type of ['pointerup', 'pointercancel'])
    canvas.addEventListener(
      type,
      (e) => {
        if (!pivotDrag || pivotDrag.pointer !== e.pointerId) return;
        e.stopImmediatePropagation();
        if (type === 'pointercancel') {
          motionDraft = pivotDrag.draft;
          motionPreview = pivotDrag.preview;
        }
        pivotDrag = null;
        syncMotionUI();
        invalidate();
      },
      true
    );
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape' || (!placingPivot && !pivotDrag)) return;
      if (pivotDrag) {
        motionDraft = pivotDrag.draft;
        motionPreview = pivotDrag.preview;
        pivotDrag = null;
      }
      placingPivot = false;
      syncMotionUI();
      invalidate();
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    true
  );
}

const refinementValidate = validateProject;
validateProject = function (v) {
  if (v?.canvasMode !== undefined && !['drawing', 'pixel'].includes(v.canvasMode))
    throw Error('Invalid canvas mode');
  if (v?.canvasMode === 'pixel' && (v.renderStyle !== 'pixel' || v.pixelSize !== 1))
    throw Error('Pixel art canvases need a 1 px grid');
  if (v?.perspectiveSettings) {
    for (const key of ['x', 'y'])
      if (!finite(v.perspectiveSettings[key], 0, 100)) throw Error('Invalid perspective guide');
  }
  const result = refinementValidate(v);
  for (const f of result.frames)
    for (const ops of Object.values(f.contents))
      for (const op of allOperations(ops)) if (op.spray) op.spray = validateSpray(op.spray);
  return result;
};
const refinedStyleControls = updateStyleControls;
updateStyleControls = function () {
  refinedStyleControls();
  const native = project.canvasMode === 'pixel';
  $('smoothStyle').disabled = native;
  $('pixelSize').disabled = native;
  $('pixelStyle').textContent = native ? 'Pixel art' : 'Pixel';
  if (native) $('pixelGridSize').textContent = `${project.width} × ${project.height} real pixels`;
};
const refinedRenderStyle = setRenderStyle;
setRenderStyle = function (style) {
  if (project.canvasMode === 'pixel') {
    toast(
      'This is a pixel art canvas. Create a drawing canvas to use Smooth or larger pixel blocks.'
    );
    return;
  }
  refinedRenderStyle(style);
};
const refinedPointFrom = pointFrom;
pointFrom = function (e) {
  const p = refinedPointFrom(e);
  if (
    project.canvasMode === 'pixel' &&
    !pivotVisible() &&
    !['hand', 'move', 'select', 'lasso', 'polygon'].includes(tool)
  ) {
    p.x = Math.min(project.width - 0.5, Math.floor(p.x) + 0.5);
    p.y = Math.min(project.height - 0.5, Math.floor(p.y) + 0.5);
  }
  return p;
};

function syncNewCanvas() {
  const native = $('newStyle').value === 'nativePixel';
  if (native) $('starter').value = 'blank';
  $('starter').disabled = native;
  const demo = $('starter').value === 'demo';
  if (demo) $('canvasSize').value = '960,640';
  $('canvasSize').disabled = demo;
  $('newPixelField').classList.toggle('hidden', $('newStyle').value !== 'pixel');
  $('newCanvasHint').textContent = native
    ? 'One canvas pixel is one artwork pixel. Start with a 1 px pen and steady ink. Enable Wiggle new marks or add layer motion when you want movement. Motion and exports stay on the pixel grid.'
    : 'Smooth and Pixel look use the same editable drawing strokes. Pixel art canvas is a separate small canvas for drawing directly on a 1 px grid.';
}

function createRefinedProject() {
  const [w, h] = $('canvasSize').value.split(',').map(Number),
    native = $('newStyle').value === 'nativePixel';
  if (
    !Number.isInteger(w) ||
    !Number.isInteger(h) ||
    w < 16 ||
    h < 16 ||
    w > 2048 ||
    h > 2048 ||
    w * h > 2097152
  ) {
    toast('Choose a canvas size from the list');
    return;
  }
  clearSelection();
  pause();
  project = fresh(w, h);
  project.canvasMode = native ? 'pixel' : 'drawing';
  project.renderStyle = $('newStyle').value === 'smooth' ? 'smooth' : 'pixel';
  project.pixelSize = native ? 1 : readPixelSize(+$('newPixelSize').value);
  if (native) {
    project.name = 'Untitled pixel loop';
    project.wiggle = 1;
    project.guideMode = 'pixels';
    brushSize = 1;
    pressure = false;
    smoothing = 0;
    animateStroke = false;
    setTool('pen');
  } else {
    brushSize = 8;
    smoothing = 0.45;
    pressure = true;
    animateStroke = true;
  }
  motionPreview = false;
  motionDraft = motionDefaults();
  motionPaused = false;
  imageCache.clear();
  tipCache.clear();
  individualPatternCache.clear();
  if (!native && $('starter').value === 'demo') makeDemo();
  resizeBuffers();
  invalidate();
  resetHistory();
  updateUI();
  fit();
  scheduleSave();
  $('newDialog').close();
  if (!native && $('starter').value === 'demo') togglePlay();
}

async function openExample(kind) {
  confirmAction(
    'Open ' + (kind === 'brush' ? 'brush and line' : 'shape') + ' examples?',
    'Save your current drawing first if you want to keep it.',
    async () => {
      const old = project;
      try {
        const next = validateProject(copy(exampleProjects[kind]));
        pause();
        clearSelection();
        project = next;
        await preloadImages();
        motionPreview = false;
        motionPaused = false;
        resizeBuffers();
        invalidate();
        resetHistory();
        updateUI();
        fit();
        scheduleSave();
        $('helpDialog').close();
        showPanel('draw');
      } catch (e) {
        project = old;
        afterRestore();
        toast('The examples could not be opened. Your drawing has been kept.');
      }
    }
  );
}

function makeLineStudy() {
  project = fresh(960, 640);
  project.name = 'A few lively lines';
  project.wiggle = 1;
  project.layers = [];
  const contents = {};
  for (const [index, kind] of ['pen', 'pencil', 'marker', 'spray'].entries()) {
    const id = uid(),
      x = (index % 2) * 430 + 115,
      y = Math.floor(index / 2) * 270 + 175,
      name = { pen: 'Studio pen', pencil: 'Pencil', marker: 'Marker', spray: 'Spray' }[kind];
    project.layers.push({ id, name, visible: true, locked: false, opacity: 1 });
    const points = Array.from({ length: 55 }, (_, i) => ({
      x: x + (i / 54) * 300,
      y: y + Math.sin((i / 54) * Math.PI * 2) * 35,
      p: 0.5
    }));
    const mark = {
      kind: 'stroke',
      tool: kind,
      color: ['#dc7958', '#57515d', '#819b86', '#9380ad'][index],
      size: [8, 7, 18, 35][index],
      opacity: 1,
      pressure: false,
      animate: true,
      mirror: false,
      seed: 100 + index,
      boilSpacing: 12,
      points
    };
    if (kind === 'spray') mark.spray = { ...sprayDefaults, density: 35, dotSize: 3 };
    contents[id] = [mark];
  }
  project.frames = [{ id: uid(), hold: 1, contents }];
  project.activeLayer = project.layers[0].id;
  motionPreview = false;
  motionPaused = false;
}

// Keep the still artwork of a moving layer between motion steps. Cache complete
// pixels, not motion output, so each step still uses exactly the same renderer.
const stillLayerCache = new Map();
let stillLayerCacheBytes = 0,
  stillCacheRevision = -1;
const stillCacheLimit = 24 * 1024 * 1024;
let layerCacheEnabled = true;

function cachedLayerArtwork(fi, id, tick, includeDraft, style, cell = project.pixelSize) {
  const independentOfTick =
    (motionLayerActive && !layerTextureMotion) ||
    renderingStill ||
    (!layerTextureMotion &&
      (!motionIsEnabled() ||
        !allOperations(project.frames[fi].contents[id]).some((op) => op.animate)));
  if (!layerCacheEnabled || includeDraft || !independentOfTick)
    return legacyRenderLayer(fi, id, tick, includeDraft, style, cell);
  if (stillCacheRevision !== revision) {
    stillLayerCache.clear();
    stillLayerCacheBytes = 0;
    stillCacheRevision = revision;
  }
  const key = [fi, id, style, cell, project.canvasMode, renderingStill, motionLayerActive].join(
      ':'
    ),
    cached = stillLayerCache.get(key);
  if (cached) return cached;
  const raw = legacyRenderLayer(fi, id, tick, false, style, cell),
    bytes = raw.width * raw.height * 4;
  if (bytes > stillCacheLimit) return raw;
  while (stillLayerCache.size && stillLayerCacheBytes + bytes > stillCacheLimit) {
    const key = stillLayerCache.keys().next().value,
      c = stillLayerCache.get(key);
    stillLayerCacheBytes -= c.width * c.height * 4;
    stillLayerCache.delete(key);
  }
  const saved = makeCanvas(raw.width, raw.height);
  saved.getContext('2d').drawImage(raw, 0, 0);
  stillLayerCache.set(key, saved);
  stillLayerCacheBytes += bytes;
  return saved;
}
let motionCheckRevision = -1,
  motionCheckResult = false;
projectHasMotion = function () {
  if (motionPreview) return true;
  if (motionCheckRevision !== revision) {
    motionCheckRevision = revision;
    motionCheckResult =
      project.layers.some((l) => l.motion) ||
      project.frames.some((f) =>
        Object.values(f.contents).some((ops) => allOperations(ops).some((op) => op.motion))
      );
  }
  return motionCheckResult;
};

const refinedOverlays = paintOverlays;
paintOverlays = function () {
  refinedOverlays();
  paintExtraGuides();
  paintPivot();
};
const refinedShowPanel = showPanel;
showPanel = function (panel) {
  refinedShowPanel(panel);
  placingPivot = false;
  if (uiReady) syncPivotUI();
};
const refinedSyncMotion = syncMotionUI;
syncMotionUI = function () {
  refinedSyncMotion();
  if (uiReady) syncPivotUI();
};
const refinedSyncBrush = syncBrushUI;
syncBrushUI = function () {
  refinedSyncBrush();
  if (uiReady) syncSprayUI();
};
const refinedSyncGrid = syncGridUI;
syncGridUI = function () {
  refinedSyncGrid();
  $('gridControls').classList.toggle('hidden', !['grid', 'isometric'].includes(guides));
  $('guideHint').textContent = guideDescriptions[guides] || '';
  $('perspectiveControls').classList.toggle('hidden', guides !== 'perspective');
  const p = perspectiveSettings();
  setRange('vanishX', p.x);
  setRange('vanishY', p.y);
  for (const id of ['gridHeight', 'gridX', 'gridY', 'gridMajor'])
    $(id).parentElement?.classList.toggle('hidden', guides === 'isometric');
};
const refinedSyncStudio = syncStudioUI;
syncStudioUI = function () {
  if (pivotLayerId !== project.activeLayer) {
    pivotLayerId = project.activeLayer;
    placingPivot = false;
    pivotDrag = null;
    motionPreview = false;
    if (motionScope === 'layer') motionDraft = copy(activeLayer().motion || motionDefaults());
  }
  refinedSyncStudio();
};
const refinedSetTool = setTool;
setTool = function (id) {
  refinedSetTool(id);
  if (uiReady) {
    syncSprayUI();
    if (id === 'spray') showPanel('draw');
  }
};
const refinedSetColour = setColour;
setColour = function (value) {
  refinedSetColour(value);
  if (uiReady && tool === 'spray') paintSprayPreview();
};
const refinedResetBrush = resetBrushDefaults;
resetBrushDefaults = function () {
  refinedResetBrush();
  if (project.canvasMode === 'pixel') {
    brushSize = 1;
    smoothing = 0;
    pressure = false;
    animateStroke = false;
    syncBrushUI();
    updateStatus();
  }
};
const refinedMakeStudy = makeStudy;
makeStudy = function (kind) {
  refinedMakeStudy(kind);
  motionPaused = false;
  motionPreview = false;
  motionScope = 'layer';
  motionDraft = copy(activeLayer().motion || motionDefaults());
};
const refinedInitialise = initialiseStudio;
initialiseStudio = function () {
  refinedInitialise();
  installPivotControls();
  $('brushSampler').onclick = () => openExample('brush');
  $('shapeSampler').onclick = () => openExample('shape');
  $('lineExamples').onclick = () =>
    confirmAction(
      'Open line examples?',
      'Save your current drawing first if you want to keep it.',
      () => {
        pause();
        clearSelection();
        makeLineStudy();
        resizeBuffers();
        invalidate();
        resetHistory();
        updateUI();
        fit();
        scheduleSave();
        $('helpDialog').close();
        showPanel('draw');
      }
    );
  $('createProject').onclick = createRefinedProject;
  $('starter').onchange = () => {
    if ($('starter').value === 'demo' && $('newStyle').value === 'nativePixel')
      $('newStyle').value = 'smooth';
    syncNewCanvas();
  };
  $('canvasSize').onchange = () => {
    const dims = $('canvasSize').value.split(',').map(Number);
    if (Math.max(...dims) <= 256) $('newStyle').value = 'nativePixel';
    else if ($('newStyle').value === 'nativePixel') $('newStyle').value = 'smooth';
    syncNewCanvas();
  };
  $('newStyle').onchange = () => {
    if (
      $('newStyle').value === 'nativePixel' &&
      Math.max(...$('canvasSize').value.split(',').map(Number)) > 256
    )
      $('canvasSize').value = '128,128';
    else if (
      $('newStyle').value !== 'nativePixel' &&
      Math.max(...$('canvasSize').value.split(',').map(Number)) <= 256
    )
      $('canvasSize').value = '960,640';
    syncNewCanvas();
  };
  syncNewCanvas();
  $('resetPerspective').onclick = () => {
    project.perspectiveSettings = { x: 50, y: 45 };
    commit();
  };
  for (const [id, key] of [
    ['vanishX', 'x'],
    ['vanishY', 'y']
  ]) {
    $(id).oninput = (e) => {
      project.perspectiveSettings = { ...perspectiveSettings(), [key]: Number(e.target.value) };
      $(id + 'Value').textContent = e.target.value;
      renderNeeded = true;
    };
    $(id).onchange = () => commit();
  }
  for (const [id, key] of [
    ['sprayDensity', 'density'],
    ['sprayDotSize', 'dotSize'],
    ['spraySpread', 'spread'],
    ['sprayFocus', 'focus']
  ])
    $(id).oninput = (e) => {
      spraySettings[key] = Number(e.target.value);
      setRange(id, spraySettings[key]);
      paintSprayPreview();
    };
  $('sprayShape').onchange = (e) => {
    spraySettings.shape = e.target.value;
    paintSprayPreview();
  };
  $('resetSpray').onclick = () => {
    spraySettings = { ...sprayDefaults };
    syncSprayUI();
    toast('Spray defaults restored');
  };
  $('sprayFine').onclick = () => {
    spraySettings = { density: 65, dotSize: 1, spread: 110, focus: 50, shape: 'round' };
    syncSprayUI();
  };
  $('sprayGrain').onclick = () => {
    spraySettings = { density: 25, dotSize: 5, spread: 100, focus: 10, shape: 'round' };
    syncSprayUI();
  };
  for (const id of ['size', 'opacity']) {
    const prev = $(id).oninput;
    $(id).oninput = (e) => {
      prev(e);
      if (tool === 'spray') paintSprayPreview();
    };
  }
  const changeTip = $('stampTip').onchange;
  $('stampTip').onchange = (e) => {
    stampSettings.sizedPattern = true;
    stampSettings.chalkPattern = true;
    changeTip(e);
  };
  const changePattern = $('stampPatternMode').onchange;
  $('stampPatternMode').onchange = (e) => {
    stampSettings.sizedPattern = true;
    stampSettings.chalkPattern = true;
    changePattern(e);
  };
  const changeAngle = $('stampPatternAngle').oninput;
  $('stampPatternAngle').oninput = (e) => {
    stampSettings.sizedPattern = true;
    stampSettings.chalkPattern = true;
    changeAngle(e);
  };
  const changeScale = $('stampPatternScale').oninput;
  $('stampPatternScale').oninput = (e) => {
    stampSettings.sizedPattern = true;
    stampSettings.chalkPattern = true;
    changeScale(e);
  };
  syncStudioUI();
};

// Keep instructional text at screen size even when a tiny canvas is enlarged.

function syncEmptyCanvasHint() {
  const hint = $('emptyHint'),
    pixel = project.canvasMode === 'pixel',
    w = project.width * zoom,
    h = project.height * zoom;
  hint.classList.toggle('pixel-hint', pixel);
  hint.style.width = Math.min(pixel ? 260 : 340, w * 0.82) + 'px';
  hint.style.transform = 'translate(-50%,-50%) scale(' + 1 / zoom + ')';
  hint.style.visibility = w < 170 || h < (pixel ? 95 : 220) ? 'hidden' : 'visible';
  $('emptyHintTitle').textContent = pixel
    ? 'Draw your first pixel'
    : 'A little line. A lot of life.';
  $('emptyHintText').textContent = pixel
    ? 'Use the 1 px pen. Zoom in to see the grid.'
    : 'Draw your first stroke. Choose a brush. Give your lines some life.';
}
const hintApplyView = applyView;
applyView = function () {
  hintApplyView();
  syncEmptyCanvasHint();
};
const hintUpdateUI = updateUI;
updateUI = function () {
  hintUpdateUI();
  syncEmptyCanvasHint();
};
