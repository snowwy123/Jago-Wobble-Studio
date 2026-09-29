// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Cameron Jago Lis Illustrates.
// Project files, validation and image import.

$('createProject').onclick = () => {
  clearSelection();
  pause();
  const [w, h] = $('canvasSize').value.split(',').map(Number);
  project = fresh(w, h);
  project.renderStyle = $('newStyle').value === 'pixel' ? 'pixel' : 'smooth';
  imageCache.clear();
  if ($('starter').value === 'demo') makeDemo();
  resizeBuffers();
  invalidate();
  resetHistory();
  updateUI();
  fit();
  scheduleSave();
  $('newDialog').close();
  if ($('starter').value === 'demo') togglePlay();
};

function filename(ext) {
  return (project.name.replace(/[^\p{L}\p{N}_ -]/gu, '').trim() || 'Jago drawing') + ext;
}

function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
$('saveBtn').onclick = () => {
  download(new Blob([snapshot()], { type: 'application/json' }), filename('.jago'));
  dirty = false;
  toast('Editable project downloaded');
};
$('openBtn').onclick = () => $('fileInput').click();

function validateProject(v) {
  const fail = () => {
      throw Error('That is not a valid Jago Wobble Studio project. Open a saved .jago project.');
    },
    num = (n, a, b) => typeof n === 'number' && Number.isFinite(n) && n >= a && n <= b,
    int = (n, a, b) => Number.isInteger(n) && num(n, a, b),
    hex = (s) => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s);
  if (
    !v ||
    !(v.format === 'jago-loop-studio' && [2, 3, 4, 5].includes(v.version)) ||
    !int(v.width, 16, 2048) ||
    !int(v.height, 16, 2048) ||
    v.width * v.height > 2097152 ||
    typeof v.name !== 'string' ||
    v.name.length > 100 ||
    !hex(v.paper) ||
    !num(v.wiggle, 0, 12) ||
    !int(v.boil, 1, 24) ||
    !int(v.fps, 1, 24) ||
    !['loop', 'pingpong'].includes(v.loop) ||
    typeof v.transparent !== 'boolean' ||
    typeof v.wiggleEnabled !== 'boolean' ||
    !Array.isArray(v.layers) ||
    v.layers.length < 1 ||
    v.layers.length > 12 ||
    !Array.isArray(v.frames) ||
    v.frames.length < 1 ||
    v.frames.length > 48
  )
    fail();
  if (v.renderStyle === undefined) v.renderStyle = 'smooth';
  if (v.pixelSize === undefined) v.pixelSize = 4;
  if (!['smooth', 'pixel'].includes(v.renderStyle) || ![1, 2, 3, 4, 6, 8, 12].includes(v.pixelSize))
    fail();
  const ids = new Set();
  for (const l of v.layers) {
    if (
      !l ||
      typeof l.id !== 'string' ||
      !/^[a-z0-9]{1,30}$/i.test(l.id) ||
      ['__proto__', 'constructor', 'prototype'].includes(l.id) ||
      ids.has(l.id) ||
      typeof l.name !== 'string' ||
      l.name.length > 100 ||
      !num(l.opacity, 0, 1) ||
      typeof l.visible !== 'boolean' ||
      typeof l.locked !== 'boolean'
    )
      fail();
    ids.add(l.id);
  }
  if (!int(v.current, 0, v.frames.length - 1) || !ids.has(v.activeLayer)) fail();
  let count = 0,
    points = 0;
  for (const f of v.frames) {
    if (!f || !int(f.hold, 1, 24) || !f.contents || typeof f.contents !== 'object') fail();
    for (const id of ids) {
      const ops = f.contents[id];
      if (!Array.isArray(ops)) fail();
      for (const op of ops) {
        if (++count > 10000 || !op) fail();
        if (op.kind === 'image') {
          if (
            typeof op.src !== 'string' ||
            !/^data:image\/(png|jpeg|webp);base64,/.test(op.src) ||
            op.src.length > 16e6 ||
            !num(op.x, -1e6, 1e6) ||
            !num(op.y, -1e6, 1e6) ||
            (op.flipX !== undefined && typeof op.flipX !== 'boolean') ||
            (op.flipY !== undefined && typeof op.flipY !== 'boolean') ||
            !num(op.w, 1, 4096) ||
            !num(op.h, 1, 4096) ||
            !num(op.opacity, 0, 1)
          )
            fail();
        } else if (op.kind === 'stroke') {
          if (
            ![
              'pen',
              'pencil',
              'marker',
              'spray',
              'stamp',
              'eraser',
              'line',
              'rect',
              'ellipse',
              ...extraShapes
            ].includes(op.tool) ||
            !hex(op.color) ||
            !num(op.size, 1, 160) ||
            !num(op.opacity, 0, 1) ||
            !int(op.seed, 0, 1e9) ||
            typeof op.pressure !== 'boolean' ||
            typeof op.animate !== 'boolean' ||
            typeof op.mirror !== 'boolean' ||
            (op.filled !== undefined && typeof op.filled !== 'boolean') ||
            !Array.isArray(op.points) ||
            op.points.length < 1 ||
            op.points.length > 20000
          )
            fail();
          points += op.points.length;
          if (points > 500000) fail();
          for (const p of op.points)
            if (!p || !num(p.x, -1e6, 1e6) || !num(p.y, -1e6, 1e6) || !num(p.p, 0, 1)) fail();
        } else fail();
      }
    }
  }
  return v;
}
$('fileInput').onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    if (file.size > 25e6) throw Error('Project files must be under 25 MB.');
    const next = validateProject(JSON.parse(await file.text()));
    const accept = async () => {
      const old = project;
      try {
        pause();
        clearSelection();
        project = next;
        await preloadImages();
        resizeBuffers();
        invalidate();
        resetHistory();
        updateUI();
        fit();
        scheduleSave();
        toast('Project opened');
      } catch (err) {
        project = old;
        afterRestore();
        toast('An image in the project could not be opened');
      }
    };
    confirmAction(
      'Open this project?',
      'This replaces the current drawing. Save a project file first if you want to keep it.',
      accept
    );
  } catch (err) {
    toast(err instanceof SyntaxError ? 'This file is not a Studio project' : err.message);
  }
};

async function importImageData(
  src,
  name,
  destination = 'new',
  expected = { project, frame: currentFrame(), layer: project.activeLayer }
) {
  if (destination === 'new' && project.layers.length >= 12)
    throw Error(
      'This project has reached 12 layers. Choose the active layer or remove a layer first.'
    );
  if (destination === 'active' && !canDraw()) return false;
  const im = await cacheImage(src),
    scale = Math.min(1, project.width / im.width, project.height / im.height),
    fitted = makeCanvas(
      Math.max(1, Math.round(im.width * scale)),
      Math.max(1, Math.round(im.height * scale))
    );
  fitted.getContext('2d').drawImage(im, 0, 0, fitted.width, fitted.height);
  const png = fitted.toDataURL('image/png');
  await cacheImage(png);
  if (
    project !== expected.project ||
    currentFrame() !== expected.frame ||
    project.activeLayer !== expected.layer
  )
    throw Error('The drawing changed during import. Please choose the image again.');
  if (destination === 'new' && project.layers.length >= 12)
    throw Error('This project has reached 12 layers.');
  if (destination === 'active' && !canDraw()) return false;
  pause();
  if (destination === 'new') {
    const id = uid();
    project.layers.push({
      id,
      name: (name.replace(/\.[^.]+$/, '') || 'Imported image').slice(0, 60),
      visible: true,
      locked: false,
      opacity: 1
    });
    project.frames.forEach((f) => (f.contents[id] = []));
    project.activeLayer = id;
    clearSelection();
  }
  currentOps().push({
    kind: 'image',
    src: png,
    x: (project.width - fitted.width) / 2,
    y: (project.height - fitted.height) / 2,
    w: fitted.width,
    h: fitted.height,
    opacity: 1
  });
  commit(
    destination === 'new' ? 'Image imported on its own layer' : 'Image added to the active layer'
  );
  showPanel('layers');
  return true;
}
$('importImage').onclick = () => {
  $('imageDestination').value = 'new';
  $('importImageDialog').showModal();
};
$('chooseImage').onclick = () => $('imageInput').click();
$('imageInput').onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const destination = $('imageDestination').value,
    expected = { project, frame: currentFrame(), layer: project.activeLayer };
  try {
    if (file.size > 15e6) throw Error('Choose an image under 15 MB');
    const src = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(Error('That image could not be read'));
      r.readAsDataURL(file);
    });
    if (await importImageData(src, file.name, destination, expected))
      $('importImageDialog').close();
  } catch (err) {
    toast(err.message || 'That image could not be opened');
  }
};
