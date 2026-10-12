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

(()=>{const label=document.createElement('label');label.className='check';label.innerHTML='<input id="pixelPerfect" type="checkbox"> Pixel-perfect one-cell strokes';label.title='Removes extra corner cells on thin pen, pencil and eraser strokes. Thick brushes retain their shape.';$('pixelSettings').append(label);$('pixelPerfect').onchange=()=>{project.pixelPerfect=$('pixelPerfect').checked;commit();};const original=updateStyleControls;updateStyleControls=function(){original();$('pixelPerfect').checked=!!project.pixelPerfect};})();
