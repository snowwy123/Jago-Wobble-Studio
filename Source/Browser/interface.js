// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Cameron Jago Lis Illustrates.
// Original inspiration: John Earnest (Internet Janitor), WigglyPaint and Decker.
'use strict';
const motionDescriptions = {
  classic: 'A contour redrawn with small irregular changes.',
  sway: 'Rock around an anchor without stretching the drawing.',
  ripple: 'A travelling wave passes through the line.',
  flutter: 'Hold one end still while the other catches the breeze.',
  breathe: 'Gently expand and contract around a centre.',
  spring: 'A small elastic impulse settles, once per motion cycle.',
  drift: 'Move the whole mark around a small path.',
  crawl:
    'Moving grain inside existing stamp ink. It gently changes the texture, keeping the outline and dither grid fixed. Amount sets contrast. Ordinary pen brushes stay still.'
};
const motionFields = {
  mAmount: ['amount', 1],
  mSpeed: ['speed', 1],
  mAngle: ['angle', 1],
  mWavelength: ['wavelength', 1],
  mReach: ['reach', 100],
  mGust: ['gust', 100],
  mStiffness: ['stiffness', 1],
  mDamping: ['damping', 1],
  mAnchorX: ['anchorX', 100],
  mAnchorY: ['anchorY', 100],
  mBalanceX: ['balanceX', 100],
  mBalanceY: ['balanceY', 100],
  mPhase: ['phase', 100]
};
const brushFields = {
  stampSpacing: ['spacing', 100],
  stampRotation: ['rotation', 1],
  stampScatter: ['scatter', 100],
  stampVariation: ['variation', 100],
  stampDensity: ['density', 100],
  stampPatternScale: ['patternScale', 1],
  stampPatternAngle: ['patternAngle', 1]
};
let currentPanel = 'draw',
  lastMotionPreview = -1;

function showPanel(panel) {
  currentPanel = panel;
  document
    .querySelectorAll('[data-panel]')
    .forEach((e) => e.classList.toggle('panel-hidden', e.dataset.panel !== panel));
  document
    .querySelectorAll('[data-panel-tab]')
    .forEach((e) => e.setAttribute('aria-selected', String(e.dataset.panelTab === panel)));
}

function setRange(id, value) {
  $(id).value = value;
  $(id + 'Value').textContent = Number(value.toFixed ? value.toFixed(2) : value);
}

function syncMotionUI() {
  $('motionType').value = motionDraft.type;
  $('motionScope').value = motionScope;
  $('motionDescription').textContent = motionDescriptions[motionDraft.type];
  $('classicControls').classList.toggle('hidden', motionDraft.type !== 'classic');
  $('modernMotionControls').classList.toggle('hidden', motionDraft.type === 'classic');
  document
    .querySelectorAll('[data-motion-types]')
    .forEach((e) =>
      e.classList.toggle('hidden', !e.dataset.motionTypes.split(' ').includes(motionDraft.type))
    );
  for (const [id, [key, factor]] of Object.entries(motionFields))
    setRange(id, motionDraft[key] * factor);
  $('mLoop').checked = motionDraft.loop;
  $('mShared').checked = motionDraft.shared;
  $('mStepped').checked = motionDraft.stepped;
  $('mPin').value = motionDraft.pin;
  $('mDirection').value = motionDraft.direction;
  $('mPath').value = motionDraft.path;
  $('mSpeed').min = motionDraft.loop ? '1' : '.1';
  $('mSpeed').step = motionDraft.loop ? '1' : '.1';
  $('mSpeed').previousElementSibling?.firstChild &&
    ($('mSpeed').previousElementSibling.firstChild.textContent = motionDraft.loop
      ? 'Cycles per loop'
      : 'Cycles per second');
  $('motionPreviewToggle').checked = motionPreview;
  setRange('motionLoopSeconds', project.motionLoopSeconds || 3);
  $('pauseMotion').textContent = motionPaused ? 'Resume live motion' : 'Pause live motion';
}

function syncBrushUI() {
  const list = $('stampTip'),
    current = stampSettings.tip;
  list.replaceChildren();
  for (const id of builtinTips) {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = tipNames[id];
    list.append(o);
  }
  for (const [id, tip] of Object.entries(project.brushTips || {})) {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = tip.name;
    list.append(o);
  }
  if (!builtinTips.includes(current) && !project.brushTips?.[current]) stampSettings.tip = 'dab';
  list.value = stampSettings.tip;
  for (const [id, [key, factor]] of Object.entries(brushFields))
    setRange(id, (stampSettings[key] ?? 0) * factor);
  const patterned = patternTips.includes(stampSettings.tip),
    individual = patterned && stampSettings.patternMode !== 'aligned';
  $('stampPatternMode').value = stampSettings.patternMode || 'stamps';
  $('patternControls').classList.toggle('hidden', !patterned);
  $('patternModeField').classList.toggle('hidden', !patterned);
  $('densityControl').classList.toggle('hidden', stampSettings.tip !== 'dither');
  $('stampPatternScale').disabled = false;
  const custom = !!project.brushTips?.[stampSettings.tip],
    rotatable = custom || ['chalk', 'flecks', 'stipple'].includes(stampSettings.tip) || individual;
  $('stampSpacingControl').classList.toggle('hidden', stampSettings.mode === 'single');
  $('stampRotationControl').classList.toggle('hidden', !rotatable);
  $('stampFollowControl').classList.toggle('hidden', stampSettings.mode === 'single');
  $('stampColourControl').classList.toggle('hidden', !custom);
  $('patternHint').textContent = individual
    ? 'Each dab carries its own pattern. Pattern size controls its dots or lines separately from brush width. Pattern angle turns the texture inside each dab. Stamp rotation and Follow stroke turn the whole dab.'
    : 'Pattern size changes the dots, lines or squares independently of brush width. Continuous patterns join across strokes. Pattern angle turns the texture while keeping it aligned across the canvas. Stamp rotation turns the outer shape. Pixel mode rounds texture details to the pixel grid.';
  $('stampMode').value = stampSettings.mode;
  $('stampFollow').checked = stampSettings.follow;
  $('stampColour').checked = stampSettings.keepColour;
  $('stampPressureOpacity').checked = stampSettings.pressureOpacity;
  $('stampMotionPlacement').value = stampSettings.motionPlacement;
  $('size').value = brushSize;
  $('sizeValue').textContent = brushSize + ' px';
  $('opacity').value = Math.round(opacity * 100);
  $('opacityValue').textContent = Math.round(opacity * 100) + '%';
  $('smoothing').value = Math.round(smoothing * 100);
  $('smoothingValue').textContent = Math.round(smoothing * 100) + '%';
  $('pressure').checked = pressure;
  $('symmetry').checked = symmetry;
  $('shapeFill').checked = shapeFilled;
  $('drawAnimate').checked = $('animateStroke').checked = animateStroke;
  paintBrushPreview();
}

function syncWorkflowUI() {
  if (!uiReady) return;
  const b = selectionBounds();
  $('selectionStatus').textContent = b
    ? Math.round(b.w) +
      ' × ' +
      Math.round(b.h) +
      ' selected pixels. Dashed edge = clipping boundary. Corners resize; round handle rotates. Shift keeps proportions or snaps rotation. Move (V) drags the area.'
    : 'Draw around part of the active layer.';
  for (const id of [
    'selectionCopy',
    'selectionCut',
    'selectionDelete',
    'selectionClear',
    'selectionTransform',
    'selectionTip'
  ])
    $(id).disabled = !selection;
  $('selectionPaste').disabled = !artClipboard;
  $('pasteFrameArt').disabled = !frameClipboard;
}

function syncStudioUI() {
  syncMotionUI();
  syncBrushUI();
  syncWorkflowUI();
  $('drawAnimate').checked = $('animateStroke').checked = animateStroke;
  $('symmetry').checked = symmetry;
  const l = activeLayer();
  $('alphaLock').checked = !!l.alphaLock;
  $('layerBlend').value = l.blend || 'source-over';
  $('followMotion').checked = l.followMotion !== false;
  const select = $('clipBase');
  select.replaceChildren();
  const none = document.createElement('option');
  none.value = '';
  none.textContent = 'No clipping';
  select.append(none);
  for (const layer of project.layers.slice(0, project.layers.indexOf(l))) {
    const o = document.createElement('option');
    o.value = layer.id;
    o.textContent = layer.name;
    select.append(o);
  }
  select.value = l.clipTo || '';
  const palette = project.shadePalette || ['#e6a372', '#805c73', '#ffebae'];
  ['shadeBase', 'shadeShadow', 'shadeLight'].forEach((id, i) => ($(id).value = palette[i]));
  guides = project.guideMode || 'none';
  $('guideMode').value = guides;
  syncArcUI();
  syncGridUI();
  $('touchDraw').checked = touchDrawing;
  $('fillReference').value = fillReference;
}

function syncGridUI() {
  const g = gridSettings();
  $('gridControls').classList.toggle('hidden', guides !== 'grid');
  for (const [id, key] of [
    ['gridWidth', 'width'],
    ['gridHeight', 'height'],
    ['gridX', 'x'],
    ['gridY', 'y'],
    ['gridMajor', 'major']
  ])
    setRange(id, g[key]);
}

function syncArcUI() {
  const a = arcSettings();
  $('arcControls').classList.toggle('hidden', guides !== 'arc');
  for (const [id, key] of [
    ['arcX', 'x'],
    ['arcY', 'y'],
    ['arcWidth', 'width'],
    ['arcHeight', 'height'],
    ['arcSteps', 'steps']
  ])
    setRange(id, a[key]);
}

function paintMotionPreview(now) {
  const previous = motionSampleActive;
  motionSampleActive = true;
  try {
    drawMotionPreview(now);
  } finally {
    motionSampleActive = previous;
  }
}

function drawMotionPreview(now) {
  if (!uiReady || currentPanel !== 'motion' || Math.floor(now / 80) === lastMotionPreview) return;
  lastMotionPreview = Math.floor(now / 80);
  const previewTick = motionPaused ? motionPauseTick : (now / 1000) * project.boil;
  const c = $('motionPreviewCanvas'),
    cx = c.getContext('2d');
  cx.clearRect(0, 0, c.width, c.height);
  if (motionDraft.type === 'crawl') {
    drawStamp(
      cx,
      {
        kind: 'stroke',
        tool: 'stamp',
        color: '#dcff72',
        size: 32,
        opacity: 1,
        pressure: false,
        animate: true,
        mirror: false,
        seed: 42,
        brush: { ...stampSettings, tip: 'chalk' },
        motion: copy(motionDraft),
        points: [
          { x: 35, y: 40, p: 0.5 },
          { x: 205, y: 40, p: 0.5 }
        ]
      },
      previewTick
    );
    return;
  }
  cx.strokeStyle = document.documentElement.dataset.theme === 'sketchbook' ? '#ebbc53' : '#dcff72';
  cx.lineWidth = 2.2;
  cx.lineCap = 'round';
  cx.beginPath();
  const m = copy(motionDraft);
  m.amount = Math.min(m.amount, 20);
  m.wavelength = Math.min(m.wavelength, 90);
  const b = { x: 35, y: 24, w: 170, h: 30 };
  for (let i = 0; i <= 40; i++) {
    const p = { x: 35 + (i / 40) * 170, y: 40 + Math.sin((i / 40) * Math.PI * 2) * 12 },
      q = motionPoint(p, m, previewTick, b, 3, i / 40);
    i ? cx.lineTo(q.x, q.y) : cx.moveTo(q.x, q.y);
  }
  cx.stroke();
  if (m.type === 'crawl') {
    cx.fillStyle = '#b1a0ff';
    for (let i = 0; i < 25; i++) {
      cx.globalAlpha = 0.3 + 0.7 * random(i + Math.floor(now / 100));
      cx.fillRect(35 + random(i * 7) * 170, 24 + random(i * 19) * 32, 2, 2);
    }
    cx.globalAlpha = 1;
  }
}

function paintBrushPreview() {
  const c = $('brushPreviewCanvas'),
    cx = c.getContext('2d'),
    cell = project.renderStyle === 'pixel' ? project.pixelSize : 1;
  // Reserve room for the 160 px maximum instead of zooming out as Size increases.
  const extent = 160 * (1 + stampSettings.scatter) * 1.6,
    w = Math.ceil(Math.max(240, extent * 2.6) / cell) * cell,
    h = Math.ceil(Math.max(100, extent) / cell) * cell;
  const sample = makeCanvas(Math.ceil(w / cell), Math.ceil(h / cell)),
    sc = sample.getContext('2d'),
    single = stampSettings.mode === 'single';
  const points = single
    ? [{ x: w / 2, y: h / 2, p: 0.5 }]
    : Array.from({ length: 32 }, (_, i) => ({
        x: w * 0.22 + (i / 31) * w * 0.56,
        y: h / 2 + Math.sin((i / 31) * Math.PI * 2) * h * 0.1,
        p: 0.5
      }));
  const before = renderingStill;
  renderingStill = true;
  try {
    drawWithExtras(
      sc,
      {
        kind: 'stroke',
        tool: 'stamp',
        points,
        brush: copy(stampSettings),
        color: colour,
        size: brushSize,
        opacity,
        pressure: false,
        animate: false,
        mirror: false,
        seed: 42
      },
      0,
      cell
    );
  } finally {
    renderingStill = before;
  }
  cx.clearRect(0, 0, c.width, c.height);
  if (project.transparent) {
    for (let y = 0; y < c.height; y += 16)
      for (let x = 0; x < c.width; x += 16) {
        cx.fillStyle = (x / 16 + y / 16) % 2 ? '#dddde1' : '#f8f8fa';
        cx.fillRect(x, y, 16, 16);
      }
  } else {
    cx.fillStyle = project.paper;
    cx.fillRect(0, 0, c.width, c.height);
  }
  const scale = Math.min(c.width / w, c.height / h);
  cx.imageSmoothingEnabled = cell === 1;
  cx.drawImage(sample, (c.width - w * scale) / 2, (c.height - h * scale) / 2, w * scale, h * scale);
  $('brushPreviewLabel').textContent =
    brushSize +
    ' px brush · ' +
    Math.round(opacity * 100) +
    '% opacity · ' +
    (cell === 1 ? 'Smooth' : 'Pixel ' + cell + ' px') +
    ' · preview scale stays fixed as Size changes';
}

function resetBrushDefaults() {
  brushSize = 8;
  opacity = 1;
  smoothing = 0.45;
  pressure = true;
  symmetry = false;
  animateStroke = true;
  shapeFilled = false;
  syncBrushUI();
  updateStatus();
  renderNeeded = true;
  toast('Brush defaults restored');
}

function resetStampDefaults() {
  stampSettings = { ...stampDefaults, tip: stampSettings.tip };
  syncBrushUI();
  toast('Stamp defaults restored');
}

function setAppTheme(theme) {
  theme = ['sketchbook', 'charcoal', 'paper', 'plum', 'candy'].includes(theme)
    ? theme
    : 'sketchbook';
  document.documentElement.dataset.theme = theme;
  $('appTheme').value = theme;
  try {
    localStorage.setItem('jago-wobble-theme', theme);
  } catch (e) {}
}
const previewSetColour = setColour;
setColour = function (c) {
  previewSetColour(c);
  if (uiReady) paintBrushPreview();
};

function saveLibrary() {
  try {
    localStorage.setItem(libraryKey, JSON.stringify(studioLibrary));
  } catch (e) {
    toast('Preset storage is full. Export the library to keep it.');
  }
}

function showLibrary() {
  const tip =
    tipNames[stampSettings.tip] || project.brushTips?.[stampSettings.tip]?.name || 'Pencil dab';
  $('stampPresetSummary').textContent =
    'Stamp setup to save: ' +
    tip +
    ' · ' +
    brushSize +
    ' px · ' +
    Math.round(opacity * 100) +
    '% opacity · ' +
    colour;
  renderLibrary();
  $('libraryDialog').showModal();
}

function renderLibrary() {
  const list = $('presetList');
  list.replaceChildren();
  for (const kind of ['brushes', 'motions'])
    studioLibrary[kind].forEach((preset, index) => {
      const row = document.createElement('div');
      row.className = 'preset-row';
      const apply = document.createElement('button');
      apply.textContent =
        (kind === 'brushes' ? 'Use brush: ' : 'Use saved settings: ') +
        presetDisplayName(kind, preset);
      apply.onclick = async () => {
        if (await useSavedPreset(kind, index)) $('libraryDialog').close();
      };
      const remove = document.createElement('button');
      remove.textContent = '×';
      remove.setAttribute('aria-label', 'Delete preset ' + preset.name);
      remove.onclick = () => deleteLibraryPresets(new Set([preset]));
      const select = document.createElement('input');
      select.type = 'checkbox';
      select.checked = librarySelection.has(preset);
      select.setAttribute('aria-label', 'Select ' + preset.name + ' for removal');
      select.onchange = () => {
        if (select.checked) librarySelection.add(preset);
        else librarySelection.delete(preset);
        $('deleteSelectedPresets').disabled = !librarySelection.size;
      };
      row.append(select, apply, remove);
      list.append(row);
    });
  if (!list.children.length)
    list.textContent = 'No saved presets yet. Import a pack to get started.';
  $('deleteSelectedPresets').disabled = !librarySelection.size;
  $('undoPresetRemoval').disabled = !lastPresetRemoval;
  refreshSavedPresetChoices();
}

function validateLibrary(v) {
  if (
    !v ||
    v.format !== 'jago-presets' ||
    !Array.isArray(v.brushes) ||
    !Array.isArray(v.motions) ||
    v.brushes.length > 30 ||
    v.motions.length > 30
  )
    throw Error('Not a Jago preset library');
  const result = { brushes: [], motions: [] };
  for (const p of v.motions) {
    if (typeof p.name !== 'string' || p.name.length > 50) throw Error('Invalid preset name');
    result.motions.push({
      name: p.name,
      origin: ['imported', 'saved'].includes(p.origin) ? p.origin : undefined,
      motion: validateMotion(p.motion)
    });
  }
  for (const p of v.brushes) {
    if (
      typeof p.name !== 'string' ||
      p.name.length > 50 ||
      !finite(p.size, 1, 160) ||
      !finite(p.opacity, 0, 1) ||
      !/^#[0-9a-f]{6}$/i.test(p.colour)
    )
      throw Error('Invalid brush preset');
    const brush = validateBrush(p.brush);
    if (!builtinTips.includes(brush.tip)) {
      if (
        !p.tip ||
        typeof p.tip.name !== 'string' ||
        p.tip.name.length > 50 ||
        typeof p.tip.src !== 'string' ||
        !/^data:image\/png;base64,/.test(p.tip.src) ||
        p.tip.src.length > 2e6
      )
        throw Error('Custom brush data missing');
    }
    result.brushes.push({
      ...p,
      origin: ['imported', 'saved'].includes(p.origin) ? p.origin : undefined,
      brush
    });
  }
  return result;
}

function readDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(Error('The image could not be read'));
    reader.readAsDataURL(file);
  });
}

function initialiseStudio() {
  uiReady = true;
  let theme = 'sketchbook';
  try {
    theme = localStorage.getItem('jago-wobble-theme') || theme;
  } catch (e) {}
  setAppTheme(theme);
  $('appTheme').onchange = (e) => setAppTheme(e.target.value);
  $('resetBrush').onclick = resetBrushDefaults;
  $('resetStamp').onclick = resetStampDefaults;
  for (const id of ['size', 'opacity']) {
    const change = $(id).oninput;
    $(id).oninput = (e) => {
      change(e);
      paintBrushPreview();
    };
  }
  $('drawAnimate').onchange = (e) => {
    animateStroke = e.target.checked;
    $('animateStroke').checked = animateStroke;
  };
  $('animateStroke').onchange = (e) => {
    animateStroke = e.target.checked;
    $('drawAnimate').checked = animateStroke;
  };
  $('closeInspector').onclick = () => $('inspector').classList.remove('open');
  try {
    studioLibrary = validateLibrary({
      format: 'jago-presets',
      ...JSON.parse(localStorage.getItem(libraryKey) || '{"brushes":[],"motions":[]}')
    });
  } catch (e) {
    studioLibrary = { brushes: [], motions: [] };
  }
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    motionPaused = true;
    motionPauseTick = 0;
  }
  document
    .querySelectorAll('[data-panel-tab]')
    .forEach((b) => (b.onclick = () => showPanel(b.dataset.panelTab)));
  showPanel('draw');
  $('motionType').onchange = (e) => {
    motionDraft = motionDefaults(e.target.value);
    if (e.target.value === 'classic') motionDraft.amount = project.wiggle;
    syncMotionUI();
    invalidate();
  };
  $('motionScope').onchange = (e) => {
    motionScope = e.target.value;
    if (motionScope === 'layer' && activeLayer().motion) motionDraft = copy(activeLayer().motion);
    syncMotionUI();
    invalidate();
  };
  for (const [id, [key, factor]] of Object.entries(motionFields))
    $(id).oninput = (e) => {
      motionDraft[key] = Number(e.target.value) / factor;
      $(id + 'Value').textContent = e.target.value;
      invalidate();
    };
  for (const [id, key] of [
    ['mLoop', 'loop'],
    ['mShared', 'shared'],
    ['mStepped', 'stepped']
  ])
    $(id).onchange = (e) => {
      motionDraft[key] = e.target.checked;
      if (key === 'loop' && e.target.checked)
        motionDraft.speed = Math.max(1, Math.round(motionDraft.speed));
      syncMotionUI();
      invalidate();
    };
  for (const [id, key] of [
    ['mPin', 'pin'],
    ['mDirection', 'direction'],
    ['mPath', 'path']
  ])
    $(id).onchange = (e) => {
      motionDraft[key] = key === 'direction' ? Number(e.target.value) : e.target.value;
      invalidate();
    };
  $('motionLoopSeconds').oninput = (e) => {
    project.motionLoopSeconds = Number(e.target.value);
    $('motionLoopSecondsValue').textContent = e.target.value;
    invalidate();
  };
  $('motionLoopSeconds').onchange = () => commit();
  $('motionPreviewToggle').onchange = (e) => {
    motionPreview = e.target.checked;
    if (motionPreview) {
      motionPaused = false;
      lastTick = -1;
    }
    syncMotionUI();
    updateStatus();
    invalidate();
  };
  $('applyLayerMotion').onclick = applyMotionToLayer;
  $('applyStrokeMotion').onclick = applyMotionToStrokes;
  $('clearLayerMotion').onclick = () => {
    if (!canDraw()) return;
    delete activeLayer().motion;
    motionPreview = false;
    commit('Layer motion cleared');
  };
  $('resetMotion').onclick = () => {
    motionDraft = motionDefaults(motionDraft.type);
    syncMotionUI();
    invalidate();
  };
  $('pauseMotion').onclick = () => {
    motionPaused = !motionPaused;
    motionPauseTick = phase;
    syncMotionUI();
    updateStatus();
    renderNeeded = true;
  };
  for (const [id, [key, factor]] of Object.entries(brushFields))
    $(id).oninput = (e) => {
      stampSettings[key] = Number(e.target.value) / factor;
      $(id + 'Value').textContent = e.target.value;
      paintBrushPreview();
    };
  $('stampTip').onchange = (e) => {
    stampSettings.tip = e.target.value;
    setTool('stamp');
    syncBrushUI();
  };
  $('stampPatternMode').onchange = (e) => {
    stampSettings.patternMode = e.target.value;
    syncBrushUI();
  };
  $('stampMode').onchange = (e) => {
    stampSettings.mode = e.target.value;
    syncBrushUI();
  };
  $('stampMotionPlacement').onchange = (e) => (stampSettings.motionPlacement = e.target.value);
  for (const [id, key] of [
    ['stampFollow', 'follow'],
    ['stampColour', 'keepColour'],
    ['stampPressureOpacity', 'pressureOpacity']
  ])
    $(id).onchange = (e) => {
      stampSettings[key] = e.target.checked;
      paintBrushPreview();
    };
  $('brushPackHelp').onclick = () => $('brushPackDialog').showModal();
  $('duplicateLayer').onclick = duplicateActiveLayer;
  $('useStamp').onclick = () => setTool('stamp');
  $('importTip').onclick = () => $('tipInput').click();
  $('tipInput').onchange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      if (file.size > 4e6 || file.type !== 'image/png') throw Error('Choose a PNG under 4 MB.');
      await addCustomTip(await readDataURL(file), file.name.replace(/\.png$/i, ''));
    } catch (e) {
      toast(e.message);
    }
  };
  $('selectionTip').onclick = async () => {
    try {
      const image = await selectionImage();
      await addCustomTip(image.src, 'My drawn tip');
    } catch (e) {
      toast(e.message);
    }
  };
  $('openBrushLibrary').onclick = $('openMotionLibrary').onclick = showLibrary;
  $('saveMotionPreset').onclick = () => {
    const name = $('presetName').value.trim();
    if (!name) {
      toast('Give this preset a name');
      return;
    }
    if (studioLibrary.motions.length >= 30) {
      toast('Delete a preset before adding another');
      return;
    }
    studioLibrary.motions.push({ name, origin: 'saved', motion: copy(motionDraft) });
    saveLibrary();
    renderLibrary();
  };
  $('saveBrushPreset').onclick = () => {
    const name = $('presetName').value.trim();
    if (!name) {
      toast('Give this preset a name');
      return;
    }
    if (studioLibrary.brushes.length >= 30) {
      toast('Delete a preset before adding another');
      return;
    }
    studioLibrary.brushes.push({
      name,
      origin: 'saved',
      brush: copy(stampSettings),
      size: brushSize,
      opacity,
      colour,
      tip: project.brushTips?.[stampSettings.tip]
        ? copy(project.brushTips[stampSettings.tip])
        : undefined
    });
    saveLibrary();
    renderLibrary();
  };
  $('exportPresets').onclick = () =>
    download(
      new Blob([JSON.stringify({ format: 'jago-presets', version: 1, ...studioLibrary })], {
        type: 'application/json'
      }),
      'Jago-brush-and-motion-presets.jagopresets'
    );
  $('importPresets').onclick = () => $('presetInput').click();
  $('presetInput').onchange = importPresetLibrary;
  $('alphaLock').onchange = (e) => {
    activeLayer().alphaLock = e.target.checked;
    commit();
  };
  $('layerBlend').onchange = (e) => {
    activeLayer().blend = e.target.value;
    commit();
  };
  $('clipBase').onchange = (e) => {
    if (e.target.value) activeLayer().clipTo = e.target.value;
    else delete activeLayer().clipTo;
    commit();
  };
  $('followMotion').onchange = (e) => {
    activeLayer().followMotion = e.target.checked;
    commit();
  };
  $('newClipLayer').onclick = addClippingLayer;
  $('fillReference').onchange = (e) => (fillReference = e.target.value);
  for (const id of ['shadeBase', 'shadeShadow', 'shadeLight'])
    $(id).onchange = () => {
      project.shadePalette = ['shadeBase', 'shadeShadow', 'shadeLight'].map((x) => $(x).value);
      commit();
    };
  for (const [id, color] of [
    ['pickBase', 'shadeBase'],
    ['pickShadow', 'shadeShadow'],
    ['pickLight', 'shadeLight']
  ])
    $(id).onclick = () => setColour($(color).value);
  for (const [id, tip] of [
    ['celBrush', 'solid'],
    ['hatchBrush', 'hatch'],
    ['ditherBrush', 'dither']
  ])
    $(id).onclick = () => {
      stampSettings.tip = tip;
      stampSettings.spacing = tip === 'solid' ? 0.15 : 0.35;
      brushSize = 32;
      setTool('stamp');
      syncBrushUI();
    };
  $('selectRectangle').onclick = () => setTool('select');
  $('selectLasso').onclick = () => setTool('lasso');
  $('selectionCopy').onclick = () => copySelection();
  $('selectionCut').onclick = () => copySelection(true);
  $('selectionPaste').onclick = pasteSelection;
  $('selectionDelete').onclick = deleteSelection;
  $('selectionClear').onclick = clearSelection;
  $('selectionTransform').onclick = transformSelection;
  $('guideMode').onchange = (e) => {
    project.guideMode = guides = e.target.value;
    commit();
  };
  for (const [id, key] of [
    ['arcX', 'x'],
    ['arcY', 'y'],
    ['arcWidth', 'width'],
    ['arcHeight', 'height'],
    ['arcSteps', 'steps']
  ]) {
    $(id).oninput = (e) => {
      project.guideSettings = { ...arcSettings(), [key]: Number(e.target.value) };
      $(id + 'Value').textContent = e.target.value;
      renderNeeded = true;
    };
    $(id).onchange = () => commit();
  }
  for (const [id, key] of [
    ['gridWidth', 'width'],
    ['gridHeight', 'height'],
    ['gridX', 'x'],
    ['gridY', 'y'],
    ['gridMajor', 'major']
  ]) {
    $(id).oninput = (e) => {
      project.gridSettings = { ...gridSettings(), [key]: Number(e.target.value) };
      $(id + 'Value').textContent = e.target.value;
      renderNeeded = true;
    };
    $(id).onchange = () => commit();
  }
  $('resetGrid').onclick = () => {
    project.gridSettings = { ...gridDefaults };
    commit();
  };
  $('resetArc').onclick = () => {
    project.guideSettings = { ...arcDefaults };
    commit();
  };
  $('touchDraw').onchange = (e) => (touchDrawing = e.target.checked);
  $('copyFrameArt').onclick = () => {
    copyFrameArtwork();
    syncWorkflowUI();
  };
  $('pasteFrameArt').onclick = pasteFrameArtwork;
  $('saveCheckpoint').onclick = checkpoint;
  $('openRecovery').onclick = showRecovery;
  $('motionStudy').onclick = () => startStudy('motion');
  $('shadingStudy').onclick = () => startStudy('shading');
  syncStudioUI();
  initialiseOnion();
  initialiseSymmetry();
  installTouchGestures();
}
const baseSetTool = setTool;
setTool = function (id) {
  baseSetTool(id);
  if (uiReady) {
    if (id === 'stamp') {
      $('stampDetails').open = true;
      showPanel('draw');
      syncBrushUI();
    }
    if (id === 'select' || id === 'lasso') showPanel('edit');
  }
};

function installTouchGestures() {
  const points = new Map();
  let pinch = null;
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType !== 'touch') return;
      if (drawing && draft?.pressure) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (points.size === 2) {
        finishStroke(true);
        const [a, b] = [...points.values()];
        pinch = {
          distance: Math.hypot(a.x - b.x, a.y - b.y),
          zoom,
          pan: { ...pan },
          cx: (a.x + b.x) / 2,
          cy: (a.y + b.y) / 2
        };
        e.preventDefault();
        e.stopImmediatePropagation();
      } else if (!touchDrawing) {
        pointerId = e.pointerId;
        panning = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
        canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true
  );
  canvas.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'touch' || !points.has(e.pointerId)) return;
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && points.size >= 2) {
        const [a, b] = [...points.values()];
        zoom = clamp(
          (pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / Math.max(1, pinch.distance),
          0.08,
          project.canvasMode === 'pixel' ? 40 : 5
        );
        pan = {
          x: pinch.pan.x + (a.x + b.x) / 2 - pinch.cx,
          y: pinch.pan.y + (a.y + b.y) / 2 - pinch.cy
        };
        applyView();
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true
  );
  for (const type of ['pointerup', 'pointercancel'])
    canvas.addEventListener(
      type,
      (e) => {
        points.delete(e.pointerId);
        if (pinch) {
          pinch = null;
          panning = null;
          pointerId = null;
          e.stopImmediatePropagation();
        }
      },
      true
    );
}

function makeStudy(kind) {
  project = fresh(960, 640);
  project.name = kind === 'motion' ? 'Pencil motion practice' : 'Pencil shading practice';
  project.wiggle = 0;
  project.motionLoopSeconds = 3;
  const base = project.activeLayer;
  const ink = '#49443e',
    pale = '#f1ece2';
  const stroke = (tool, color, size, points, extra = {}) => ({
    kind: 'stroke',
    tool,
    color,
    size,
    points: points.map(([x, y]) => ({ x, y, p: 0.5 })),
    opacity: 1,
    pressure: false,
    animate: false,
    mirror: false,
    seed: 42,
    ...extra
  });
  if (kind === 'motion') {
    project.layers[0].name = 'Pendulum';
    project.layers[0].motion = { ...motionDefaults('sway'), angle: 24, anchorY: 0 };
    currentOps().push(
      stroke('pencil', ink, 3, [
        [300, 176],
        [299, 205],
        [301, 245],
        [300, 291],
        [298, 333],
        [300, 361]
      ]),
      stroke('pencil', ink, 3, [
        [301, 360],
        [280, 363],
        [265, 379],
        [259, 398],
        [263, 420],
        [277, 436],
        [299, 441],
        [321, 435],
        [338, 419],
        [342, 397],
        [335, 377],
        [319, 364],
        [301, 360]
      ]),
      stroke('pencil', ink, 1, [
        [264, 412],
        [270, 432],
        [293, 444],
        [316, 440]
      ]),
      stroke('pencil', ink, 2, [
        [282, 378],
        [275, 389],
        [273, 400]
      ])
    );
    // A few pencil details travel with the bob, so the layer movement is easy to read.
    for (let i = 0; i < 5; i++)
      currentOps().push(
        stroke(
          'pencil',
          ink,
          1.5,
          [
            [306 + i * 5, 411 - i * 6],
            [295 + i * 5, 432 - i * 4]
          ],
          { opacity: 0.55 }
        )
      );
    const guide = uid(),
      shadow = uid(),
      id = uid(),
      thread = uid();
    project.layers.unshift({
      id: guide,
      name: 'Swing guide',
      visible: true,
      locked: false,
      opacity: 1
    });
    currentFrame().contents[guide] = [
      stroke(
        'pencil',
        ink,
        2.5,
        [
          [258, 172],
          [282, 174],
          [310, 173],
          [339, 174]
        ],
        { opacity: 0.7 }
      ),
      stroke('pencil', ink, 2, [
        [297, 169],
        [302, 168],
        [305, 173],
        [301, 178],
        [296, 175],
        [297, 169]
      ]),
      stroke(
        'pencil',
        ink,
        1.5,
        [
          [195, 408],
          [211, 429],
          [235, 448],
          [266, 460],
          [299, 465],
          [333, 459],
          [364, 447],
          [389, 428],
          [405, 407]
        ],
        { opacity: 0.22 }
      ),
      stroke(
        'pencil',
        ink,
        1.5,
        [
          [190, 423],
          [195, 408],
          [209, 415]
        ],
        { opacity: 0.3 }
      ),
      stroke(
        'pencil',
        ink,
        1.5,
        [
          [391, 414],
          [405, 407],
          [410, 422]
        ],
        { opacity: 0.3 }
      )
    ];
    project.layers.splice(1, 0, {
      id: shadow,
      name: 'Soft shadow',
      visible: true,
      locked: false,
      opacity: 1,
      motion: {
        ...motionDefaults('breathe'),
        amount: 28,
        speed: 2,
        phase: 0.25,
        balanceX: 1,
        balanceY: 0.25
      }
    });
    currentFrame().contents[shadow] = [
      stroke(
        'stamp',
        '#aaa093',
        13,
        [
          [260, 488],
          [280, 490],
          [300, 491],
          [322, 490],
          [340, 488]
        ],
        {
          opacity: 0.48,
          brush: { ...stampDefaults, tip: 'stipple', spacing: 0.2, scatter: 0.1, variation: 0.1 }
        }
      )
    ];
    project.layers.push({
      id,
      name: 'Rippling ribbon',
      visible: true,
      locked: false,
      opacity: 1,
      motion: { ...motionDefaults('ripple'), amount: 20, wavelength: 220, speed: 2 }
    });
    currentFrame().contents[id] = [
      stroke('pencil', ink, 3, [
        [558, 276],
        [590, 274],
        [627, 277],
        [668, 275],
        [711, 276],
        [751, 274],
        [796, 277]
      ]),
      stroke('pencil', ink, 3, [
        [558, 315],
        [590, 317],
        [627, 314],
        [668, 316],
        [711, 315],
        [751, 317],
        [796, 314]
      ]),
      stroke('pencil', ink, 2, [
        [558, 276],
        [564, 296],
        [558, 315]
      ]),
      stroke('pencil', ink, 2, [
        [796, 277],
        [782, 296],
        [796, 314]
      ]),
      stroke(
        'pencil',
        ink,
        1,
        [
          [581, 306],
          [630, 307],
          [675, 305],
          [728, 307],
          [771, 306]
        ],
        { opacity: 0.35 }
      )
    ];
    for (let i = 0; i < 10; i++)
      currentFrame().contents[id].push(
        stroke(
          'pencil',
          ink,
          1.3,
          [
            [578 + i * 20, 303],
            [568 + i * 20, 313]
          ],
          { opacity: 0.45 }
        )
      );
    project.layers.push({
      id: thread,
      name: 'Loose thread',
      visible: true,
      locked: false,
      opacity: 1,
      motion: { ...motionDefaults('flutter'), amount: 24, speed: 2, gust: 0.15, pin: 'start' }
    });
    currentFrame().contents[thread] = [
      stroke(
        'pencil',
        ink,
        2,
        [
          [559, 394],
          [584, 384],
          [611, 387],
          [639, 401],
          [667, 411],
          [696, 404],
          [725, 384],
          [753, 377],
          [780, 381]
        ],
        { opacity: 0.75 }
      ),
      stroke(
        'pencil',
        ink,
        1,
        [
          [559, 398],
          [584, 389],
          [611, 392],
          [639, 406],
          [667, 416],
          [696, 409],
          [725, 389],
          [753, 382],
          [780, 386]
        ],
        { opacity: 0.4 }
      )
    ];
  } else {
    project.shadePalette = ['#e9e2d6', '#665d51', '#fffdf9'];
    project.layers[0].name = 'Pencil ball';
    project.layers[0].motion = { ...motionDefaults('sway'), angle: 3, anchorY: 1 };
    currentOps().push(
      stroke(
        'ellipse',
        '#e9e2d6',
        1,
        [
          [322, 159],
          [642, 479]
        ],
        { filled: true }
      ),
      stroke(
        'pencil',
        ink,
        4.5,
        [
          [480, 160],
          [440, 164],
          [400, 181],
          [367, 209],
          [340, 248],
          [324, 292],
          [323, 335],
          [337, 383],
          [365, 423],
          [400, 453],
          [444, 473],
          [484, 479],
          [530, 472],
          [574, 451],
          [606, 418],
          [629, 374],
          [642, 329],
          [638, 282],
          [620, 238],
          [591, 202],
          [554, 177],
          [516, 163],
          [480, 160]
        ],
        { opacity: 0.85 }
      ),
      stroke(
        'pencil',
        ink,
        2,
        [
          [322, 286],
          [319, 321],
          [325, 357],
          [341, 393],
          [364, 427],
          [397, 455],
          [430, 472]
        ],
        { opacity: 0.55 }
      ),
      stroke(
        'pencil',
        ink,
        1.5,
        [
          [526, 163],
          [559, 174],
          [591, 199],
          [612, 225]
        ],
        { opacity: 0.45 }
      )
    );
    const ground = uid(),
      grain = uid(),
      shade = uid(),
      light = uid();
    project.layers.unshift({
      id: ground,
      name: 'Light and cast shadow',
      visible: true,
      locked: false,
      opacity: 1
    });
    project.layers.push(
      {
        id: grain,
        name: 'Soft speckles',
        visible: true,
        locked: false,
        opacity: 1,
        clipTo: base,
        followMotion: true,
        blend: 'multiply'
      },
      {
        id: shade,
        name: 'Pencil shading',
        visible: true,
        locked: false,
        opacity: 1,
        clipTo: base,
        followMotion: true,
        blend: 'multiply'
      },
      {
        id: light,
        name: 'Little highlight',
        visible: true,
        locked: false,
        opacity: 1,
        clipTo: base,
        followMotion: true
      }
    );
    currentFrame().contents[ground] = [
      stroke(
        'ellipse',
        '#d8d1c7',
        1,
        [
          [392, 459],
          [750, 501]
        ],
        { filled: true, opacity: 0.55 }
      ),
      stroke(
        'stamp',
        '#6d655a',
        25,
        [
          [439, 479],
          [495, 485],
          [548, 485],
          [611, 482],
          [660, 479]
        ],
        {
          opacity: 0.4,
          brush: { ...stampDefaults, tip: 'stipple', spacing: 0.18, scatter: 0.12, rotation: 24 }
        }
      ),
      stroke(
        'pencil',
        ink,
        2,
        [
          [289, 487],
          [365, 490],
          [452, 489],
          [539, 494],
          [633, 491],
          [697, 488],
          [763, 490]
        ],
        { opacity: 0.35 }
      ),
      stroke(
        'pencil',
        ink,
        2.5,
        [
          [246, 144],
          [270, 161],
          [299, 183],
          [318, 201]
        ],
        { opacity: 0.7 }
      ),
      stroke(
        'pencil',
        ink,
        2,
        [
          [298, 195],
          [319, 203],
          [313, 182]
        ],
        { opacity: 0.7 }
      )
    ];
    const band = [
      [571, 236],
      [596, 280],
      [596, 323],
      [578, 368],
      [546, 407],
      [505, 432],
      [461, 446],
      [420, 446]
    ];
    currentFrame().contents[grain] = [
      stroke('stamp', '#a0988c', 117, band, {
        opacity: 0.15,
        brush: { ...stampDefaults, tip: 'solid', spacing: 0.12, variation: 0 }
      }),
      stroke('stamp', '#766d61', 105, band, {
        opacity: 0.7,
        brush: {
          ...stampDefaults,
          tip: 'stipple',
          spacing: 0.22,
          scatter: 0.1,
          variation: 0.12,
          rotation: 37
        }
      })
    ];
    currentFrame().contents[shade] = [
      stroke(
        'stamp',
        '#665d51',
        113,
        [
          [639, 251],
          [634, 308],
          [616, 367],
          [578, 418],
          [531, 451],
          [482, 476],
          [443, 483]
        ],
        {
          opacity: 0.8,
          brush: {
            ...stampDefaults,
            tip: 'hatch',
            spacing: 0.12,
            variation: 0,
            patternScale: 2,
            patternMode: 'aligned'
          }
        }
      ),
      stroke(
        'stamp',
        '#766b5d',
        52,
        [
          [646, 326],
          [628, 384],
          [597, 430],
          [554, 463],
          [508, 485]
        ],
        {
          opacity: 0.6,
          brush: {
            ...stampDefaults,
            tip: 'crosshatch',
            spacing: 0.12,
            variation: 0,
            patternScale: 2,
            patternMode: 'aligned'
          }
        }
      )
    ];
    currentFrame().contents[light] = [
      stroke(
        'pencil',
        '#fffdf9',
        19,
        [
          [410, 221],
          [392, 236],
          [377, 257],
          [367, 281],
          [363, 300]
        ],
        { opacity: 0.92 }
      ),
      stroke(
        'pencil',
        '#fffdf9',
        7,
        [
          [423, 213],
          [413, 220],
          [404, 230]
        ],
        { opacity: 0.85 }
      )
    ];
    project.activeLayer = shade;
  }
}

function startStudy(kind) {
  confirmAction(
    'Open drawing study?',
    'Save your current drawing first if you want to keep it.',
    () => {
      pause();
      clearSelection();
      makeStudy(kind);
      resizeBuffers();
      invalidate();
      resetHistory();
      updateUI();
      fit();
      scheduleSave();
      $('helpDialog').close();
      showPanel(kind === 'motion' ? 'motion' : 'layers');
    }
  );
}
