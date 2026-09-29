// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Cameron Jago Lis Illustrates.
// Export options and progress belong here; the encoders live beside this file.

function exportSummary() {
  syncExportPixels();
  const format = $('exportFormat').value,
    seconds = clamp(Math.round(+$('exportSeconds').value || 3), 1, 12),
    { duration, schedule } = gifSchedule(seconds),
    animated = format === 'gif' || format === 'sequence';
  $('exportSummary').textContent =
    project.width +
    ' × ' +
    project.height +
    ' · ' +
    project.frames.length +
    ' drawing frames' +
    (animated ? ' · ' + duration.toFixed(2) + ' second loop' : '');
  $('secondsField').classList.toggle('hidden', !animated || project.frames.length > 1);
  $('sequenceRateField').classList.toggle('hidden', format !== 'sequence');
  $('downloadExport').innerHTML =
    icon('export') +
    'Export ' +
    (format === 'gif'
      ? 'GIF'
      : format === 'sheet'
        ? 'sprite sheet'
        : format === 'sequence'
          ? 'PNG sequence'
          : 'PNG');
  $('exportNote').textContent =
    format === 'gif'
      ? 'GIF uses 256 colours per image. ' +
        schedule.length +
        ' images to render. Hard transparency; maximum 240 images and 1280 px per side.'
      : format === 'sheet'
        ? 'One cell per drawing frame, arranged left to right then top to bottom. Choose PNG sequence to include every motion step.'
        : format === 'sequence'
          ? 'A ZIP of numbered full-colour PNGs at the chosen frame rate, plus timing.json. Includes the whole animated loop, frame holds and ping-pong order. Maximum 720 images, 60 seconds and 256 MB. Transparent PNGs keep soft edges.'
          : 'PNG keeps full colour and soft transparency. Exports the selected drawing frame.';
  if (format === 'sequence') {
    try {
      const plan = pngSequenceSchedule(seconds, +$('sequenceRate').value);
      $('exportNote').textContent += ' ' + plan.schedule.length + ' PNGs to render.';
    } catch (e) {
      $('exportNote').textContent = e.message;
    }
  }
}
$('sequenceRate').onchange = exportSummary;

$('exportBtn').onclick = () => {
  pause();
  motionPreview = false;
  invalidate();
  $('exportSeconds').value = project.motionLoopSeconds || 3;
  $('exportTransparent').checked = project.transparent;
  $('exportStyle').value = 'current';
  $('exportStyle').disabled = project.canvasMode === 'pixel';
  $('exportPixelSize').value = project.pixelSize;
  exportSummary();
  $('exportDialog').showModal();
};
$('exportFormat').onchange = exportSummary;
$('exportStyle').onchange = exportSummary;
$('exportSeconds').onchange = () => {
  $('exportSeconds').value = clamp(Math.round(+$('exportSeconds').value || 3), 1, 12);
  project.motionLoopSeconds = +$('exportSeconds').value;
  commit();
  exportSummary();
};

function exportCanvas(
  fi,
  tick,
  w,
  h,
  transparent,
  style = project.renderStyle,
  cell = project.pixelSize
) {
  if (project.canvasMode === 'pixel') style = 'pixel';
  cell = readPixelSize(cell);
  const c = makeCanvas(w, h),
    cc = c.getContext('2d');
  if (!transparent) {
    cc.fillStyle = project.paper;
    cc.fillRect(0, 0, w, h);
  }
  cc.imageSmoothingEnabled = style !== 'pixel';
  cc.drawImage(renderFrame(fi, tick, false, false, style, cell), 0, 0, w, h);
  return c;
}

function canvasBlob(c) {
  return new Promise((resolve, reject) =>
    c.toBlob(
      (b) =>
        b ? resolve(b) : reject(Error('The image is too large to export. Try a smaller size.')),
      'image/png'
    )
  );
}
$('exportDialog').addEventListener('cancel', (e) => {
  if (exporting) {
    e.preventDefault();
    cancelExport = true;
  }
});
$('downloadExport').onclick = async () => {
  if (exporting) return;
  syncExportPixels();
  const format = $('exportFormat').value,
    scale = +$('exportScale').value,
    w = Math.round(project.width * scale),
    h = Math.round(project.height * scale),
    transparent = $('exportTransparent').checked,
    style =
      project.canvasMode === 'pixel'
        ? 'pixel'
        : $('exportStyle').value === 'current'
          ? project.renderStyle
          : $('exportStyle').value,
    cell = readPixelSize(+$('exportPixelSize').value);
  const button = $('downloadExport');
  try {
    const seconds = clamp(Math.round(+$('exportSeconds').value || 3), 1, 12),
      { duration, schedule } = gifSchedule(seconds);
    if (w * h > 32e6 || w > 16384 || h > 16384)
      throw Error('That export is too large. Choose a smaller export size.');
    if (format === 'gif' && (w > 1280 || h > 1280))
      throw Error('Choose a smaller size for GIF (maximum 1280 px per side).');
    if (format === 'gif' && (schedule.length > 240 || duration > 60))
      throw Error(
        'This loop is too long. Reduce frame holds or the redraw rate, or export a sprite sheet.'
      );
    exporting = true;
    cancelExport = false;
    button.disabled = true;
    document
      .querySelectorAll('#exportDialog input,#exportDialog select')
      .forEach((e) => (e.disabled = true));
    $('exportProgress').classList.remove('hidden');
    $('exportProgress').value = 0;
    let blob, name;
    if (format === 'sequence') {
      blob = await exportPNGSequence(
        { seconds, fps: +$('sequenceRate').value, w, h, transparent, style, pixelSize: cell },
        (done, total) => {
          $('exportProgress').value = done / total;
          button.textContent = 'Rendering ' + done + ' / ' + total;
        }
      );
      name = filename('-png-sequence.zip');
    } else if (format === 'gif') {
      const writer = new GIFWriter(w, h);
      let elapsedCs = 0,
        idealCs = 0;
      for (let i = 0; i < schedule.length; i++) {
        if (cancelExport) throw Error('Export cancelled');
        const s = schedule[i];
        const c = exportCanvas(s.frame, s.tick, w, h, transparent, style, cell);
        idealCs += s.delay * 100;
        const delayCs = Math.max(2, Math.round(idealCs) - elapsedCs);
        elapsedCs += delayCs;
        writer.add(
          c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data,
          delayCs / 100,
          transparent
        );
        $('exportProgress').value = (i + 1) / schedule.length;
        button.textContent = `Rendering ${i + 1} / ${schedule.length}`;
        await new Promise((r) => setTimeout(r, 0));
      }
      blob = writer.finish();
      name = filename('.gif');
    } else if (format === 'png') {
      blob = await canvasBlob(exportCanvas(project.current, phase, w, h, transparent, style, cell));
      name = filename('.png');
    } else {
      const cols = Math.ceil(Math.sqrt(project.frames.length)),
        rows = Math.ceil(project.frames.length / cols);
      if (w * cols * h * rows > 32e6 || w * cols > 16384 || h * rows > 16384)
        throw Error('That sprite sheet is too large. Choose a smaller export size.');
      const sheet = makeCanvas(w * cols, h * rows),
        sc = sheet.getContext('2d');
      if (!transparent) {
        sc.fillStyle = project.paper;
        sc.fillRect(0, 0, sheet.width, sheet.height);
      }
      for (let i = 0; i < project.frames.length; i++) {
        if (cancelExport) throw Error('Export cancelled');
        sc.drawImage(
          exportCanvas(
            i,
            (beatForFrame(i) / project.fps) * project.boil,
            w,
            h,
            transparent,
            style,
            cell
          ),
          (i % cols) * w,
          Math.floor(i / cols) * h
        );
        $('exportProgress').value = (i + 1) / project.frames.length;
        await new Promise((r) => setTimeout(r, 0));
      }
      blob = await canvasBlob(sheet);
      name = filename(`-sheet-${cols}x${rows}-${w}x${h}.png`);
    }
    if (cancelExport) throw Error('Export cancelled');
    download(blob, name);
    $('exportDialog').close();
    toast('Export downloaded');
  } catch (err) {
    toast(err.message || 'Export failed. Try a smaller size.');
  } finally {
    exporting = false;
    button.disabled = false;
    document
      .querySelectorAll('#exportDialog input,#exportDialog select,#exportDialog [data-close]')
      .forEach((e) => (e.disabled = false));
    $('exportProgress').classList.add('hidden');
    exportSummary();
    renderNeeded = true;
  }
};
