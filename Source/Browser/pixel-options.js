// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Cameron Jago Lis Illustrates.

function readPixelSize(value) {
  return [1, 2, 3, 4, 6, 8, 12].includes(value) ? value : 4;
}

function syncExportPixels() {
  const style = $('exportStyle').value;
  const pixel =
    project.canvasMode === 'pixel' ||
    style === 'pixel' ||
    (style === 'current' && project.renderStyle === 'pixel');
  $('exportPixelField').classList.toggle('hidden', !pixel);
  $('exportPixelHint').classList.toggle('hidden', !pixel);
  $('exportStyle').disabled = project.canvasMode === 'pixel' || exporting;
}
