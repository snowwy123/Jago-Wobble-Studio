// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Cameron Jago Lis Illustrates.
// A stored ZIP keeps PNG frames together without recompressing each image.

const zipCrcTable = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});

function zipCrc(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = zipCrcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

class PNGSequenceZip {
  constructor() {
    this.parts = [];
    this.directory = [];
    this.offset = 0;
    this.count = 0;
  }
  add(name, bytes) {
    const filename = new TextEncoder().encode(name),
      crc = zipCrc(bytes),
      header = new Uint8Array(30 + filename.length),
      v = new DataView(header.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 0x800, true);
    v.setUint16(12, 33, true);
    v.setUint32(14, crc, true);
    v.setUint32(18, bytes.length, true);
    v.setUint32(22, bytes.length, true);
    v.setUint16(26, filename.length, true);
    header.set(filename, 30);
    const centre = new Uint8Array(46 + filename.length),
      d = new DataView(centre.buffer);
    d.setUint32(0, 0x02014b50, true);
    d.setUint16(4, 20, true);
    d.setUint16(6, 20, true);
    d.setUint16(8, 0x800, true);
    d.setUint16(14, 33, true);
    d.setUint32(16, crc, true);
    d.setUint32(20, bytes.length, true);
    d.setUint32(24, bytes.length, true);
    d.setUint16(28, filename.length, true);
    d.setUint32(42, this.offset, true);
    centre.set(filename, 46);
    if (this.offset + header.length + bytes.length > 256 * 1024 * 1024)
      throw Error('This sequence exceeds 256 MB. Use a smaller export size or lower frame rate.');
    this.parts.push(header, bytes);
    this.directory.push(centre);
    this.offset += header.length + bytes.length;
    this.count++;
  }
  finish() {
    const size = this.directory.reduce((n, p) => n + p.length, 0),
      end = new Uint8Array(22),
      v = new DataView(end.buffer);
    v.setUint32(0, 0x06054b50, true);
    v.setUint16(8, this.count, true);
    v.setUint16(10, this.count, true);
    v.setUint32(12, size, true);
    v.setUint32(16, this.offset, true);
    return new Blob([...this.parts, ...this.directory, end], { type: 'application/zip' });
  }
}

function pngSequenceSchedule(seconds, fps = 24) {
  if (![12, 24, 30, 60].includes(fps)) throw Error('Choose a supported sequence frame rate.');
  const sequence = frameSequence(),
    duration =
      project.frames.length === 1
        ? seconds
        : sequence.reduce((n, i) => n + project.frames[i].hold / project.fps, 0),
    count = Math.max(1, Math.ceil(duration * fps - 1e-7));
  if (count > 720 || duration > 60)
    throw Error(
      'PNG sequences are limited to 720 images and 60 seconds. Reduce the frame rate or loop length.'
    );
  return {
    duration,
    exportDuration: count / fps,
    fps,
    schedule: Array.from({ length: count }, (_, i) => {
      const time = i / fps;
      return {
        time,
        delay: 1 / fps,
        frame: frameAtBeat((time + 1e-6) * project.fps),
        tick: project.wiggleEnabled
          ? projectHasMotion()
            ? time * project.boil
            : Math.floor((time + 1e-6) * project.boil) % 12
          : 0
      };
    })
  };
}

async function exportPNGSequence(options, onProgress = () => {}, cancelled = () => cancelExport) {
  const { seconds, fps, w, h, transparent, style, pixelSize = project.pixelSize } = options;
  if (w < 1 || h < 1 || w * h > 32e6 || w > 8192 || h > 8192)
    throw Error('Choose a smaller PNG export size.');
  const plan = pngSequenceSchedule(seconds, fps),
    zip = new PNGSequenceZip(),
    frames = [];
  for (let i = 0; i < plan.schedule.length; i++) {
    if (cancelled()) throw Error('Export cancelled');
    const step = plan.schedule[i],
      name = 'frame-' + String(i + 1).padStart(4, '0') + '.png',
      blob = await canvasBlob(
        exportCanvas(step.frame, step.tick, w, h, transparent, style, pixelSize)
      );
    if (cancelled()) throw Error('Export cancelled');
    zip.add(name, new Uint8Array(await blob.arrayBuffer()));
    frames.push({
      file: name,
      time: step.time,
      duration: step.delay,
      drawingFrame: step.frame + 1
    });
    onProgress(i + 1, plan.schedule.length);
    await new Promise((r) => setTimeout(r, 0));
  }
  const timing = {
    format: 'jago-png-sequence',
    version: 1,
    name: project.name,
    width: w,
    height: h,
    frameRate: fps,
    sourceDuration: plan.duration,
    duration: plan.exportDuration,
    loop: project.loop,
    transparent,
    style,
    pixelSize: style === 'pixel' ? pixelSize : null,
    frames
  };
  zip.add('timing.json', new TextEncoder().encode(JSON.stringify(timing, null, 2)));
  zip.add(
    'README.txt',
    new TextEncoder().encode(
      'Jago Wobble Studio PNG sequence\n\nImport frame-0001.png as an image sequence at ' +
        fps +
        ' frames per second.\nNumbered PNGs contain the full rendered motion, including layer and selection effects.\nFrames: ' +
        frames.length +
        '; size: ' +
        w +
        ' x ' +
        h +
        '; playback: ' +
        plan.exportDuration.toFixed(6) +
        ' seconds.\nThe source loop is ' +
        plan.duration.toFixed(6) +
        ' seconds; output rounds up to a whole frame.\nThe repeated loop endpoint is omitted. timing.json lists every frame.\n'
    )
  );
  if (cancelled()) throw Error('Export cancelled');
  return zip.finish();
}
