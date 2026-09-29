// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Cameron Jago Lis Illustrates.
'use strict';
$('dimensions').onclick = () => {
  if (exporting) return;
  finishStroke();
  $('resizePaperWidth').value = project.width;
  $('resizePaperHeight').value = project.height;
  const value = project.width + ',' + project.height;
  $('resizePaperPreset').value = [...$('resizePaperPreset').options].some((o) => o.value === value)
    ? value
    : 'custom';
  $('resizePaperAnchor').value = 'centre';
  $('resizePaperDialog').showModal();
};
$('resizePaperPreset').onchange = (e) => {
  if (e.target.value === 'custom') return;
  const [w, h] = e.target.value.split(',').map(Number);
  $('resizePaperWidth').value = w;
  $('resizePaperHeight').value = h;
};
for (const id of ['resizePaperWidth', 'resizePaperHeight'])
  $(id).oninput = () => {
    $('resizePaperPreset').value = 'custom';
  };
function resizePaper(w, h, anchor = 'centre') {
  if (exporting) return false;
  if (![w, h].every((n) => Number.isInteger(n) && n >= 16 && n <= 2048) || w * h > 2097152) {
    toast('Use 16–2048 px per side, up to 2,097,152 pixels altogether.');
    return false;
  }
  if (w === project.width && h === project.height) return true;
  finishStroke();
  pause();
  clearSelection();
  let dx = anchor === 'centre' ? (w - project.width) / 2 : 0;
  let dy = anchor === 'centre' ? (h - project.height) / 2 : 0;
  if (project.canvasMode === 'pixel') {
    dx = Math.round(dx);
    dy = Math.round(dy);
  }
  const next = copy(project);
  // Keep old mirror centres fixed, even inside a transformed selection group.
  function keepMirrorCentres(ops) {
    for (const op of ops) {
      if (op.kind === 'group') keepMirrorCentres(op.ops);
      else if (op.mirror && !op.symmetry)
        op.symmetry = {
          mode: 'vertical',
          centerX: project.width / 2,
          centerY: project.height / 2,
          segments: 6
        };
    }
  }
  for (const frame of next.frames)
    for (const id of Object.keys(frame.contents)) {
      keepMirrorCentres(frame.contents[id]);
      const ops = translatedOps(frame.contents[id], dx, dy);
      for (const op of ops)
        if (op.kind !== 'group' && op.selection)
          op.selection = op.selection.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
      frame.contents[id] = ops;
    }
  next.width = w;
  next.height = h;
  project = validateProject(next);
  resizeBuffers();
  invalidate();
  commit('Paper resized');
  updateUI();
  fit();
  return true;
}
$('resizePaperApply').onclick = () => {
  if (
    resizePaper(
      +$('resizePaperWidth').value,
      +$('resizePaperHeight').value,
      $('resizePaperAnchor').value
    )
  )
    $('resizePaperDialog').close();
};
