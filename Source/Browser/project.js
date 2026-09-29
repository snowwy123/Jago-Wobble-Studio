// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Cameron Jago Lis Illustrates.
'use strict';
/*
Inspiration: WigglyPaint and Decker by John Earnest (Internet Janitor).
Created by Cameron Jago Lis Illustrates.
A separate drawing app, not affiliated with or endorsed by John Earnest.
*/
const JAGO_KEY = 'jago-loop-studio-v2';
const uid = () => Math.random().toString(36).slice(2, 11);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const copy = (o) => JSON.parse(JSON.stringify(o));

function fresh(w = 960, h = 640) {
  const id = uid();
  return {
    format: 'jago-loop-studio',
    version: 5,
    name: 'Untitled loop',
    width: w,
    height: h,
    paper: '#fffdf9',
    transparent: false,
    renderStyle: 'smooth',
    pixelSize: 4,
    wiggle: 3,
    boil: 8,
    wiggleEnabled: true,
    fps: 8,
    loop: 'loop',
    layers: [{ id, name: 'Ink', visible: true, locked: false, opacity: 1 }],
    frames: [{ id: uid(), hold: 1, contents: { [id]: [] } }],
    current: 0,
    activeLayer: id
  };
}
let project = fresh(),
  tool = 'pen',
  brushSize = 8,
  opacity = 1,
  smoothing = 0.45,
  colour = '#252338',
  previousColour = '#ef6461',
  pressure = true,
  symmetry = false,
  animateStroke = true,
  shapeFilled = false,
  onion = false,
  playing = false,
  playStart = 0,
  playBase = 0,
  playIndex = 0,
  phase = 0,
  draft = null,
  drawing = false,
  panning = null,
  moving = null,
  zoom = 1,
  pan = { x: 0, y: 0 },
  fitScale = 1,
  history = [],
  historyIndex = -1,
  revision = 0,
  saveTimer,
  toastTimer,
  renderNeeded = true,
  lastTick = -1,
  exporting = false,
  cancelExport = false,
  pointerId = null,
  dirty = false,
  autosaveFailed = false;
const canvas = $('canvas'),
  ctx = canvas.getContext('2d', { willReadFrequently: true }),
  imageCache = new Map(),
  renderCache = new Map();
const makeCanvas = (w = project.width, h = project.height) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
let layerCanvas = makeCanvas(),
  strokeCanvas = makeCanvas(),
  onionCanvas = makeCanvas(),
  pixelLayerCanvas = makeCanvas(1, 1),
  pixelStrokeCanvas = makeCanvas(1, 1);

function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3000);
}

function invalidate() {
  revision++;
  renderCache.clear();
  renderNeeded = true;
}

function snapshot() {
  return JSON.stringify(project);
}

function resetHistory() {
  history = [snapshot()];
  historyIndex = 0;
  updateHistory();
}

function commit(message) {
  invalidate();
  const s = snapshot();
  if (s !== history[historyIndex]) {
    history.splice(historyIndex + 1);
    history.push(s);
    while (
      history.length > 60 ||
      (history.length > 2 && history.reduce((a, b) => a + b.length, 0) > 28e6)
    )
      history.shift();
    historyIndex = history.length - 1;
  }
  updateUI();
  scheduleSave();
  if (message) toast(message);
}

function updateHistory() {
  $('undoBtn').disabled = historyIndex <= 0;
  $('redoBtn').disabled = historyIndex >= history.length - 1;
}

function undo() {
  if (drawing || moving || exporting || historyIndex < 1) return;
  pause();
  project = JSON.parse(history[--historyIndex]);
  afterRestore();
  toast('Undone');
}

function redo() {
  if (drawing || moving || exporting || historyIndex >= history.length - 1) return;
  pause();
  project = JSON.parse(history[++historyIndex]);
  afterRestore();
  toast('Redone');
}

function scheduleSave() {
  dirty = true;
  $('saveState').textContent = 'Saving…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveLocal, 600);
}

function saveLocal() {
  try {
    localStorage.setItem(JAGO_KEY, snapshot());
    dirty = false;
    autosaveFailed = false;
    $('saveState').textContent = 'Saved on this device';
  } catch (e) {
    if (!autosaveFailed)
      toast('Browser storage is full or unavailable. Use Save to keep a project file.');
    autosaveFailed = true;
    $('saveState').textContent = 'Save a project file';
  }
}

function afterRestore() {
  resizeBuffers();
  preloadImages().then(() => {
    invalidate();
    updateUI();
  });
  invalidate();
  updateUI();
  scheduleSave();
}

function activeLayer() {
  return project.layers.find((l) => l.id === project.activeLayer);
}

function currentFrame() {
  return project.frames[project.current];
}

function currentOps() {
  return currentFrame().contents[project.activeLayer];
}

function canDraw() {
  const l = activeLayer();
  if (l.locked) {
    toast('This layer is locked');
    return false;
  }
  if (!l.visible) {
    toast('Show this layer before drawing');
    return false;
  }
  return true;
}
