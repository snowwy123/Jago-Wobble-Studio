// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Cameron Jago Lis Illustrates.
// Toolbar, layers and timeline cards.

function setTool(id) {
  if (selectionDrag?.tool === 'polygon' && id !== 'polygon') finishSelection(true);
  tool = id;
  $('shapeFillRow').classList.toggle('hidden', !closedShapes.includes(id));
  $('moreShapes').classList.toggle('active', extraShapes.includes(id));
  $('moreShapes').innerHTML = icon(extraShapes.includes(id) ? id : 'star');
  if ($('shapesDialog').open) $('shapesDialog').close();
  document.querySelectorAll('[data-tool]').forEach((b) => {
    const on = b.dataset.tool === id;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
  $('brushName').textContent = toolDefs.find((t) => t[0] === id)?.[1] || 'Studio pen';
  canvas.style.cursor =
    id === 'hand' ? 'grab' : id === 'move' ? 'move' : id === 'picker' ? 'copy' : 'crosshair';
  updateStatus();
}

function setColour(c) {
  if (!/^#[\da-f]{6}$/i.test(c)) return;
  previousColour = colour;
  colour = c.toLowerCase();
  $('color').value = colour;
  $('hexColor').value = colour;
  $('toolColor').value = colour;
  document
    .querySelectorAll('.swatch')
    .forEach((e) => e.classList.toggle('selected', e.dataset.color === colour));
}

function updateStatus() {
  $('quickMotion').checked = project.wiggleEnabled;
  $('toolStatus').textContent = `${toolDefs.find((t) => t[0] === tool)[1]} · ${brushSize} px`;
  $('layerStatus').textContent = activeLayer().name;
  $('activityStatus').textContent = playing
    ? `Playing · frame ${playIndex + 1} / ${project.frames.length}`
    : motionPaused
      ? 'Live motion paused'
      : motionPreview
        ? 'Layer motion preview'
        : project.wiggleEnabled && (project.wiggle > 0 || projectHasMotion())
          ? 'Live motion on'
          : 'Still lines';
}

function updateUI() {
  $('projectName').value = project.name;
  $('dimensions').textContent = `${project.width} × ${project.height}`;
  $('wiggle').value = project.wiggle;
  $('wiggleValue').textContent = `${project.wiggle} px`;
  $('boil').value = project.boil;
  $('boilValue').textContent = project.boil;
  $('wiggleEnabled').checked = project.wiggleEnabled;
  updateStyleControls();
  $('fps').value = project.fps;
  $('loopMode').value = project.loop;
  $('paperColor').value = project.paper;
  $('transparent').checked = project.transparent;
  $('layerOpacity').value = Math.round(activeLayer().opacity * 100);
  $('layerOpacityValue').textContent = `${Math.round(activeLayer().opacity * 100)}%`;
  $('deleteLayer').disabled = project.layers.length === 1;
  $('deleteFrame').disabled = project.frames.length === 1;
  $('layerUp').disabled = project.layers.indexOf(activeLayer()) === project.layers.length - 1;
  $('layerDown').disabled = project.layers.indexOf(activeLayer()) === 0;
  const amount = project.wiggle;
  document
    .querySelectorAll('[data-motion]')
    .forEach((b) =>
      b.classList.toggle(
        'active',
        b.dataset.motion ===
          (amount === 1 ? 'gentle' : amount === 3 ? 'lively' : amount === 7 ? 'wild' : '')
      )
    );
  $('emptyHint').classList.toggle(
    'hidden',
    project.frames.some((f) => Object.values(f.contents).some((ops) => ops.length)) ||
      project.transparent
  );
  renderLayers();
  renderFrames();
  updateHistory();
  updateStatus();
  renderNeeded = true;
}

function renderLayers() {
  const list = $('layers');
  list.replaceChildren();
  [...project.layers].reverse().forEach((l) => {
    const row = document.createElement('div');
    row.className = 'layer' + (l.id === project.activeLayer ? ' selected' : '');
    const eye = document.createElement('button');
    eye.className = 'icon';
    eye.innerHTML = icon(l.visible ? 'eye' : 'hidden');
    eye.title = (l.visible ? 'Hide ' : 'Show ') + l.name;
    eye.setAttribute('aria-label', eye.title);
    eye.onclick = () => {
      l.visible = !l.visible;
      commit();
    };
    const name = document.createElement('button');
    name.className = 'layer-name';
    name.textContent = l.name;
    name.title = 'Select ' + l.name;
    name.onclick = () => {
      clearSelection();
      project.activeLayer = l.id;
      updateUI();
    };
    const lock = document.createElement('button');
    lock.className = 'icon' + (l.locked ? ' locked' : '');
    lock.innerHTML = icon(l.locked ? 'lock' : 'unlock');
    lock.title = (l.locked ? 'Unlock ' : 'Lock ') + l.name;
    lock.setAttribute('aria-label', lock.title);
    lock.onclick = () => {
      l.locked = !l.locked;
      commit();
    };
    const thumb = layerThumbnail(l);
    thumb.onclick = name.onclick;
    row.append(eye, thumb, name, lock);
    list.append(row);
  });
}

function renderFrames() {
  const list = $('frames'),
    scroll = list.scrollLeft;
  list.replaceChildren();
  project.frames.forEach((f, i) => {
    const b = document.createElement('button');
    b.className = 'frame-card' + (i === project.current ? ' active' : '');
    b.title = `Frame ${i + 1} · ${f.hold} beat${f.hold === 1 ? '' : 's'}`;
    b.setAttribute('aria-label', b.title);
    b.setAttribute('aria-pressed', String(i === project.current));
    const thumb = makeCanvas(174, 108);
    const tc = thumb.getContext('2d');
    tc.fillStyle = project.transparent ? '#eeedf0' : project.paper;
    tc.fillRect(0, 0, 174, 108);
    const scale = Math.min(174 / project.width, 108 / project.height);
    tc.save();
    tc.translate((174 - project.width * scale) / 2, (108 - project.height * scale) / 2);
    tc.scale(scale, scale);
    tc.imageSmoothingEnabled = project.renderStyle !== 'pixel';
    tc.drawImage(renderFrame(i, 0, true), 0, 0);
    tc.restore();
    const label = document.createElement('span');
    label.className = 'frame-label';
    label.innerHTML = `<span>${String(i + 1).padStart(2, '0')}</span><span>×${f.hold}</span>`;
    b.append(thumb, label);
    b.onclick = () => selectFrame(i);
    list.append(b);
  });
  const add = document.createElement('button');
  add.className = 'add-frame';
  add.innerHTML = icon('plus');
  add.title = 'Add blank frame';
  add.setAttribute('aria-label', 'Add blank frame');
  add.onclick = () => addFrame(false);
  list.append(add);
  list.scrollLeft = scroll;
}

function selectFrame(i) {
  if (drawing || exporting) return;
  pause();
  project.current = clamp(i, 0, project.frames.length - 1);
  playIndex = project.current;
  updateUI();
}

function addFrame(duplicate) {
  clearSelection();
  if (project.frames.length >= 48) {
    toast('This project has reached 48 frames');
    return;
  }
  pause();
  const frame = duplicate
    ? copy(currentFrame())
    : { hold: 1, contents: Object.fromEntries(project.layers.map((l) => [l.id, []])) };
  frame.id = uid();
  project.frames.splice(project.current + 1, 0, frame);
  project.current++;
  commit(duplicate ? 'Frame duplicated' : 'Blank frame added');
  $('frames').children[project.current]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
