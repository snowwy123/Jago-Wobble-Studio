// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Cameron Jago Lis Illustrates.
// Keyboard shortcuts and saving when the tab goes into the background.

document.addEventListener('keydown', (e) => {
  const input = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName),
    modal = !!document.querySelector('dialog:modal');
  if (handleStudioShortcut(e, input, modal)) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    if (exporting) return;
    e.preventDefault();
    $('saveBtn').click();
    return;
  }
  if (input || modal || exporting || e.altKey) return;
  if (e.ctrlKey || e.metaKey) {
    if (e.key.toLowerCase() === 'z') {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
    } else if (e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
    } else if (e.key.toLowerCase() === 'e') {
      e.preventDefault();
      $('exportBtn').click();
    }
    return;
  }
  if (drawing || moving || panning || selectionDrag) {
    if (e.key === 'Escape') finishStroke(true);
    return;
  }
  const k = e.key.toLowerCase(),
    match = toolDefs.find((t) => t[2].toLowerCase() === k);
  if (match) {
    e.preventDefault();
    setTool(match[0]);
    return;
  }
  if (k === ' ') {
    e.preventDefault();
    togglePlay();
  } else if (k === 'o') $('onionBtn').click();
  else if (k === 'd') addFrame(true);
  else if (k === 'x') setColour(previousColour);
  else if (k === '0') fit();
  else if (k === 'arrowleft') {
    e.preventDefault();
    selectFrame(project.current - 1);
  } else if (k === 'arrowright') {
    e.preventDefault();
    selectFrame(project.current + 1);
  } else if (k === '[' || k === ']') {
    brushSize = clamp(brushSize + (k === '[' ? -2 : 2), 1, 80);
    $('size').value = brushSize;
    $('sizeValue').textContent = brushSize + ' px';
    updateStatus();
    paintBrushPreview();
  } else if (k === '?') $('helpBtn').click();
});
window.addEventListener('beforeunload', (e) => {
  if (dirty) saveLocal();
  if (autosaveFailed) {
    e.preventDefault();
    e.returnValue = '';
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && dirty) saveLocal();
});
new ResizeObserver(() => {
  if (Math.abs(zoom - fitScale) < 0.001) fit();
}).observe($('viewport'));
