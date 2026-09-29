// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Cameron Jago Lis Illustrates.
// Wire up the main controls before the later panels extend them.

function confirmAction(title, body, action) {
  $('confirmTitle').textContent = title;
  $('confirmBody').textContent = body;
  $('confirmAction').textContent = title.startsWith('Open')
    ? 'Open project'
    : title.startsWith('Clear')
      ? 'Clear'
      : 'Delete';
  $('confirmAction').onclick = () => {
    $('confirmDialog').close();
    action();
  };
  $('confirmDialog').showModal();
}
document
  .querySelectorAll('[data-tool]')
  .forEach((b) => (b.onclick = () => setTool(b.dataset.tool)));
document
  .querySelectorAll('[data-color]')
  .forEach((b) => (b.onclick = () => setColour(b.dataset.color)));
$('color').oninput = (e) => setColour(e.target.value);
$('hexColor').onchange = (e) => {
  if (/^#[\da-f]{6}$/i.test(e.target.value)) setColour(e.target.value);
  else {
    e.target.value = colour;
    toast('Use a six-digit hex colour, such as #55c4ed');
  }
};
$('toolColor').oninput = (e) => setColour(e.target.value);
$('swapColor').onclick = () => setColour(previousColour);
for (const [id, setter, suffix] of [
  [
    'size',
    (v) => {
      brushSize = v;
      updateStatus();
    },
    ' px'
  ],
  ['opacity', (v) => (opacity = v / 100), '%'],
  ['smoothing', (v) => (smoothing = v / 100), '%']
])
  $(id).oninput = (e) => {
    const v = +e.target.value;
    setter(v);
    $(id + 'Value').textContent = v + suffix;
  };
$('shapeFill').onchange = (e) => (shapeFilled = e.target.checked);
$('moreShapes').onclick = () => $('shapesDialog').showModal();
$('smoothStyle').onclick = () => setRenderStyle('smooth');
$('pixelStyle').onclick = () => setRenderStyle('pixel');
$('pixelSize').onchange = (e) => {
  project.pixelSize = +e.target.value;
  commit();
};
$('clearAll').onclick = () =>
  confirmAction(
    'Clear all artwork?',
    'This clears every frame and every layer, including hidden and locked layers. Your canvas settings, layers and frame timing stay in place. Undo restores all the artwork.',
    () => {
      pause();
      for (const f of project.frames) for (const l of project.layers) f.contents[l.id] = [];
      commit('All artwork cleared - Undo to restore');
    }
  );
$('pressure').onchange = (e) => (pressure = e.target.checked);
$('symmetry').onchange = (e) => {
  symmetry = e.target.checked;
  renderNeeded = true;
};
$('animateStroke').onchange = (e) => (animateStroke = e.target.checked);
for (const id of ['wiggle', 'boil']) {
  $(id).oninput = (e) => {
    project[id] = +e.target.value;
    if (id === 'wiggle' && motionDraft.type === 'classic') motionDraft.amount = project.wiggle;
    $(id + 'Value').textContent = e.target.value + (id === 'wiggle' ? ' px' : '');
    invalidate();
  };
  $(id).onchange = () => commit();
}
function setLiveMotion(enabled) {
  project.wiggleEnabled = enabled;
  motionPaused = false;
  if (!enabled) motionPreview = false;
  commit();
}
$('wiggleEnabled').onchange = (e) => setLiveMotion(e.target.checked);
$('quickMotion').onchange = (e) => setLiveMotion(e.target.checked);
document.querySelectorAll('[data-motion]').forEach(
  (b) =>
    (b.onclick = () => {
      project.wiggle = { gentle: 1, lively: 3, wild: 7 }[b.dataset.motion];
      if (motionDraft.type === 'classic') motionDraft.amount = project.wiggle;
      project.boil = { gentle: 6, lively: 8, wild: 12 }[b.dataset.motion];
      project.wiggleEnabled = true;
      commit();
    })
);
$('undoBtn').onclick = undo;
$('redoBtn').onclick = redo;
$('fitBtn').onclick = fit;
$('zoomIn').onclick = () => zoomAt(1.2);
$('zoomOut').onclick = () => zoomAt(1 / 1.2);
$('propsBtn').onclick = () => $('inspector').classList.toggle('open');
$('projectName').onchange = (e) => {
  project.name = e.target.value.trim() || 'Untitled loop';
  commit();
};
$('fps').onchange = (e) => {
  project.fps = clamp(Math.round(+e.target.value || 8), 1, 24);
  pause();
  commit();
};
$('loopMode').onchange = (e) => {
  project.loop = e.target.value;
  pause();
  commit();
};
$('paperColor').oninput = (e) => {
  project.paper = e.target.value;
  invalidate();
};
$('paperColor').onchange = () => commit();
$('transparent').onchange = (e) => {
  project.transparent = e.target.checked;
  commit();
};
$('playBtn').onclick = togglePlay;
$('onionBtn').onclick = () => {
  onion = !onion;
  syncOnionUI();
  toast(
    onion
      ? onionSettings.original
        ? 'Onion skin: original colours'
        : 'Onion skin: pink before, blue after'
      : 'Onion skin off'
  );
};
$('duplicateFrame').onclick = () => addFrame(true);
$('deleteFrame').onclick = () => {
  if (project.frames.length < 2) return;
  confirmAction(
    'Delete this frame?',
    'The other frames will stay in place. You can undo this.',
    () => {
      pause();
      project.frames.splice(project.current, 1);
      project.current = Math.min(project.current, project.frames.length - 1);
      commit('Frame deleted');
    }
  );
};
$('frameOptions').onclick = () => {
  pause();
  $('frameHold').value = currentFrame().hold;
  $('frameLeft').disabled = project.current === 0;
  $('frameRight').disabled = project.current === project.frames.length - 1;
  $('allFrameTiming').disabled = project.frames.length < 2;
  $('frameTimingResult').textContent = '';
  $('frameDialog').showModal();
};
$('frameHold').onchange = (e) => {
  currentFrame().hold = clamp(Math.round(+e.target.value || 1), 1, 24);
  e.target.value = currentFrame().hold;
  $('frameTimingResult').textContent = 'Current frame updated.';
  commit();
};
$('allFrameTiming').onclick = () => {
  pause();
  const hold = clamp(Math.round(+$('frameHold').value || 1), 1, 24);
  $('frameHold').value = hold;
  project.frames.forEach((frame) => (frame.hold = hold));
  commit('Timing applied to all frames');
  $('frameTimingResult').textContent =
    'All ' +
    project.frames.length +
    ' frames now hold for ' +
    hold +
    ' beat' +
    (hold === 1 ? '' : 's') +
    '.';
};

function moveFrame(d) {
  const i = project.current,
    j = i + d;
  if (j < 0 || j >= project.frames.length) return;
  [project.frames[i], project.frames[j]] = [project.frames[j], project.frames[i]];
  project.current = j;
  commit();
  $('frameLeft').disabled = j === 0;
  $('frameRight').disabled = j === project.frames.length - 1;
}
$('frameLeft').onclick = () => moveFrame(-1);
$('frameRight').onclick = () => moveFrame(1);
$('addLayer').onclick = () => {
  clearSelection();
  if (project.layers.length >= 12) {
    toast('This project has reached 12 layers');
    return;
  }
  const id = uid();
  project.layers.push({
    id,
    name: `Layer ${project.layers.length + 1}`,
    visible: true,
    locked: false,
    opacity: 1
  });
  project.frames.forEach((f) => (f.contents[id] = []));
  project.activeLayer = id;
  commit('Layer added');
};

function moveLayer(d) {
  const i = project.layers.indexOf(activeLayer()),
    j = i + d;
  if (j < 0 || j >= project.layers.length) return;
  [project.layers[i], project.layers[j]] = [project.layers[j], project.layers[i]];
  commit();
}
$('layerUp').onclick = () => moveLayer(1);
$('layerDown').onclick = () => moveLayer(-1);
$('deleteLayer').onclick = () => {
  if (project.layers.length === 1) return;
  confirmAction(
    'Delete this layer?',
    'This removes its drawings from every frame. You can undo this.',
    () => {
      const id = project.activeLayer;
      project.layers = project.layers.filter((l) => l.id !== id);
      project.frames.forEach((f) => delete f.contents[id]);
      project.activeLayer = project.layers[project.layers.length - 1].id;
      commit('Layer deleted');
    }
  );
};
$('renameLayer').onclick = () => {
  $('layerNameInput').value = activeLayer().name;
  $('renameDialog').showModal();
  $('layerNameInput').select();
};
$('applyLayerName').onclick = () => {
  activeLayer().name = $('layerNameInput').value.trim() || 'Untitled layer';
  $('renameDialog').close();
  commit();
};
$('layerOpacity').oninput = (e) => {
  activeLayer().opacity = +e.target.value / 100;
  $('layerOpacityValue').textContent = e.target.value + '%';
  invalidate();
};
$('layerOpacity').onchange = () => commit();
document.querySelectorAll('[data-close]').forEach(
  (b) =>
    (b.onclick = () => {
      if (exporting) {
        cancelExport = true;
        return;
      }
      b.closest('dialog').close();
    })
);
document.querySelectorAll('dialog').forEach((d) =>
  d.addEventListener('click', (e) => {
    if (e.target === d && !exporting) {
      const r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        d.close();
    }
  })
);
$('helpBtn').onclick = () => $('helpDialog').showModal();
function openNewCanvas(starter = 'blank') {
  $('colourDialog').close();
  $('canvasSize').value = '960,640';
  $('starter').value = starter;
  $('newStyle').value = 'smooth';
  $('newPixelSize').value = '4';
  syncNewCanvas();
  $('newDialog').showModal();
}
$('newBtn').onclick = () => openNewCanvas();
$('demoBtn').onclick = () => {
  $('helpDialog').close();
  openNewCanvas('demo');
};
