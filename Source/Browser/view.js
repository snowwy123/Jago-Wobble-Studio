// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Cameron Jago Lis Illustrates.
// Keep pointer coordinates in canvas pixels, independent of zoom.

function resizeBuffers() {
  canvas.width = project.width;
  canvas.height = project.height;
  layerCanvas = makeCanvas();
  strokeCanvas = makeCanvas();
  onionCanvas = makeCanvas();
  $('canvasWrap').style.width = project.width + 'px';
  $('canvasWrap').style.height = project.height + 'px';
}

function fit() {
  const v = $('viewport');
  fitScale = Math.min((v.clientWidth - 64) / project.width, (v.clientHeight - 55) / project.height);
  fitScale = Math.max(0.05, fitScale);
  zoom = fitScale;
  pan = { x: 0, y: 0 };
  applyView();
}

function applyView() {
  $('canvasWrap').style.transform =
    `translate(calc(-50% + ${pan.x}px),calc(-50% + ${pan.y}px)) scale(${zoom})`;
  $('fitBtn').textContent = Math.round(zoom * 100) + '%';
}

function zoomAt(factor, x, y) {
  const v = $('viewport').getBoundingClientRect(),
    old = zoom;
  zoom = clamp(zoom * factor, 0.08, project.canvasMode === 'pixel' ? 40 : 5);
  if (x !== undefined) {
    const cx = x - v.left - v.width / 2,
      cy = y - v.top - v.height / 2;
    pan.x = cx - ((cx - pan.x) * zoom) / old;
    pan.y = cy - ((cy - pan.y) * zoom) / old;
  }
  applyView();
}

function pointFrom(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: clamp((e.clientX - r.left) / zoom, 0, project.width),
    y: clamp((e.clientY - r.top) / zoom, 0, project.height),
    p: pressure && e.pointerType === 'pen' ? clamp(e.pressure, 0.08, 1) : 0.5
  };
}
