// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Cameron Jago Lis Illustrates.
'use strict';

let drawLayoutStamp = null;

function syncDrawPanel() {
  if (!uiReady) return;
  const stamp = tool === 'stamp';
  $('regularBrushPanel').classList.toggle('hidden', stamp);
  $('stampBrushPanel').classList.toggle('hidden', !stamp);
  $('useStamp').classList.toggle('active', stamp);
  $('useStamp').setAttribute('aria-pressed', String(stamp));
  // Move the actual controls, preserving handlers, values and keyboard access.
  if (drawLayoutStamp !== stamp) {
    $(stamp ? 'stampBasicSlot' : 'regularBasicSlot').append($('sharedBrushBasics'));
    $(stamp ? 'stampSmoothingSlot' : 'regularSmoothingSlot').append($('sharedSmoothing'));
    drawLayoutStamp = stamp;
    if (stamp) $('stampDetails').open = true;
  }
  $('sharedSmoothing').classList.toggle(
    'hidden',
    !['pen', 'pencil', 'marker', 'spray', 'eraser', 'stamp'].includes(tool)
  );
}

function openSaveStampAs() {
  const base = selectedBrushPreset?.preset.name || currentBrushName();
  let name = (base + ' custom').slice(0, 50),
    number = 2;
  while (studioLibrary.brushes.some((p) => p.name === name)) {
    const suffix = ' custom ' + number++;
    name = base.slice(0, 50 - suffix.length) + suffix;
  }
  $('saveStampAsName').value = name;
  $('saveStampAsError').textContent = '';
  $('saveStampAsDialog').showModal();
  $('saveStampAsName').focus?.();
  $('saveStampAsName').select();
}

function saveStampAsNewPreset() {
  const name = $('saveStampAsName').value.trim();
  if (!name || name.length > 50) {
    $('saveStampAsError').textContent = 'Give your brush a name of 1 to 50 characters.';
    return;
  }
  if (studioLibrary.brushes.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    $('saveStampAsError').textContent =
      'That name is already in your library. Choose another name to keep both brushes easy to find.';
    return;
  }
  if (studioLibrary.brushes.length >= 30) {
    $('saveStampAsError').textContent =
      'Your library has 30 brush presets. Export a backup and remove one in Stamp presets before saving another.';
    return;
  }
  const before = studioLibrary.brushes.length,
    previous = $('presetName').value;
  $('presetName').value = name;
  try {
    $('saveBrushPreset').onclick();
  } finally {
    $('presetName').value = previous;
  }
  if (studioLibrary.brushes.length > before) {
    $('saveStampAsDialog').close();
    toast('Saved ' + name + ' in Your saved presets');
  }
}
const panelSetTool = setTool;
setTool = function (id) {
  const previous = tool;
  panelSetTool(id);
  if (uiReady) {
    syncDrawPanel();
    if (['pen', 'pencil', 'marker', 'spray', 'stamp'].includes(id)) showPanel('draw');
    if ((previous === 'stamp') !== (id === 'stamp')) $('inspector').scrollTop = 0;
  }
};
const panelSyncBrush = syncBrushUI;
syncBrushUI = function () {
  panelSyncBrush();
  syncDrawPanel();
};
const panelInitialise = initialiseStudio;
initialiseStudio = function () {
  panelInitialise();
  $('saveStampAs').onclick = openSaveStampAs;
  $('confirmSaveStampAs').onclick = saveStampAsNewPreset;
  $('saveStampAsName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveStampAsNewPreset();
    }
  });
  syncDrawPanel();
};
