// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Cameron Jago Lis Illustrates.
/*
Inspiration: WigglyPaint and Decker by John Earnest (Internet Janitor).
Created by Cameron Jago Lis Illustrates.
A separate drawing app, not affiliated with or endorsed by John Earnest.
*/
// Small, dependency-free GIF89a writer with an adaptive palette for each frame.

function quantizeRGBA(rgba) {
  const hist = new Map();
  // Sample a bounded number of pixels, preserving exact mean colours in each bucket.
  const stride = Math.max(1, Math.floor(rgba.length / 4 / 90000));
  for (let i = 0; i < rgba.length; i += 4 * stride) {
    if (rgba[i + 3] < 16) continue;
    const r = rgba[i],
      g = rgba[i + 1],
      b = rgba[i + 2],
      key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    let a = hist.get(key);
    if (!a) hist.set(key, (a = { n: 0, r: 0, g: 0, b: 0 }));
    a.n++;
    a.r += r;
    a.g += g;
    a.b += b;
  }
  const values = [...hist.values()].map((a) => ({
    n: a.n,
    r: a.r / a.n,
    g: a.g / a.n,
    b: a.b / a.n
  }));
  function box(v) {
    const min = [255, 255, 255],
      max = [0, 0, 0];
    let n = 0;
    for (const p of v) {
      n += p.n;
      ['r', 'g', 'b'].forEach((k, i) => {
        min[i] = Math.min(min[i], p[k]);
        max[i] = Math.max(max[i], p[k]);
      });
    }
    const ranges = max.map((a, i) => a - min[i]);
    return { v, n, ranges, score: Math.max(...ranges) * Math.sqrt(n) };
  }
  let boxes = values.length ? [box(values)] : [box([{ n: 1, r: 0, g: 0, b: 0 }])];
  while (boxes.length < 255) {
    let selected = -1,
      best = -1;
    boxes.forEach((b, i) => {
      if (b.v.length > 1 && b.score > best) {
        best = b.score;
        selected = i;
      }
    });
    if (selected < 0) break;
    const b = boxes[selected],
      axis = ['r', 'g', 'b'][b.ranges.indexOf(Math.max(...b.ranges))];
    b.v.sort((p, q) => p[axis] - q[axis]);
    let n = 0,
      split = 1;
    for (let i = 0; i < b.v.length - 1; i++) {
      n += b.v[i].n;
      split = i + 1;
      if (n >= b.n / 2) break;
    }
    boxes.splice(selected, 1, box(b.v.slice(0, split)), box(b.v.slice(split)));
  }
  const palette = new Uint8Array(768),
    colours = [];
  boxes.forEach((b, i) => {
    const rgb = ['r', 'g', 'b'].map((k) =>
      Math.round(b.v.reduce((a, p) => a + p[k] * p.n, 0) / b.n)
    );
    palette.set(rgb, (i + 1) * 3);
    colours.push(rgb);
  });
  const lookup = new Int16Array(32768);
  lookup.fill(-1);
  const indices = new Uint8Array(rgba.length / 4);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
    if (rgba[i + 3] < 16) {
      indices[j] = 0;
      continue;
    }
    const r = rgba[i],
      g = rgba[i + 1],
      b = rgba[i + 2],
      key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    let idx = lookup[key];
    if (idx < 0) {
      let distance = Infinity;
      colours.forEach((c, k) => {
        const d = (r - c[0]) ** 2 * 0.3 + (g - c[1]) ** 2 * 0.59 + (b - c[2]) ** 2 * 0.11;
        if (d < distance) {
          distance = d;
          idx = k + 1;
        }
      });
      lookup[key] = idx;
    }
    indices[j] = idx;
  }
  return { palette, indices };
}

function lzwEncode(indices) {
  const bytes = [];
  let accum = 0,
    bitCount = 0,
    bits = 9,
    next = 258,
    dict = new Map();
  const write = (code) => {
    accum |= code << bitCount;
    bitCount += bits;
    while (bitCount >= 8) {
      bytes.push(accum & 255);
      accum >>>= 8;
      bitCount -= 8;
    }
  };
  write(256);
  if (indices.length) {
    let prefix = indices[0];
    for (let i = 1; i < indices.length; i++) {
      const k = indices[i],
        key = prefix * 256 + k,
        found = dict.get(key);
      if (found !== undefined) {
        prefix = found;
        continue;
      }
      write(prefix);
      if (next < 4096) {
        dict.set(key, next++);
        if (next > 1 << bits && bits < 12) bits++;
      } else {
        write(256);
        dict = new Map();
        next = 258;
        bits = 9;
      }
      prefix = k;
    }
    write(prefix);
  }
  write(257);
  if (bitCount) bytes.push(accum & 255);
  return new Uint8Array(bytes);
}

class GIFWriter {
  constructor(w, h) {
    this.chunks = [];
    this.w = w;
    this.h = h;
    this.push([
      ...Array.from('GIF89a', (c) => c.charCodeAt(0)),
      w & 255,
      w >> 8,
      h & 255,
      h >> 8,
      0x70,
      0,
      0,
      0x21,
      0xff,
      11,
      ...Array.from('NETSCAPE2.0', (c) => c.charCodeAt(0)),
      3,
      1,
      0,
      0,
      0
    ]);
  }
  push(a) {
    this.chunks.push(a instanceof Uint8Array ? a : new Uint8Array(a));
  }
  add(rgba, delay, transparent) {
    const { palette, indices } = quantizeRGBA(rgba),
      cs = clamp(Math.round(delay * 100), 2, 65535);
    this.push([
      0x21,
      0xf9,
      4,
      transparent ? 9 : 8,
      cs & 255,
      cs >> 8,
      0,
      0,
      0x2c,
      0,
      0,
      0,
      0,
      this.w & 255,
      this.w >> 8,
      this.h & 255,
      this.h >> 8,
      0x87
    ]);
    this.push(palette);
    this.push([8]);
    const data = lzwEncode(indices);
    for (let i = 0; i < data.length; i += 255) {
      const slice = data.subarray(i, i + 255);
      this.push([slice.length]);
      this.push(slice);
    }
    this.push([0]);
  }
  finish() {
    this.push([0x3b]);
    return new Blob(this.chunks, { type: 'image/gif' });
  }
}

function gifSchedule(seconds) {
  const sequence = frameSequence(),
    beats = sequence.reduce((s, i) => s + project.frames[i].hold, 0),
    duration = project.frames.length === 1 ? seconds : beats / project.fps;
  const boundaries = new Set([0, duration]);
  const rate = projectHasMotion() ? 24 : project.boil;
  if (project.wiggleEnabled && (project.wiggle > 0 || projectHasMotion()))
    for (let t = 1 / rate; t < duration - 1e-7; t += 1 / rate)
      boundaries.add(Math.round(t * 1e6) / 1e6);
  let sum = 0;
  for (const i of sequence) {
    sum += project.frames[i].hold / project.fps;
    if (sum < duration - 1e-7) boundaries.add(Math.round(sum * 1e6) / 1e6);
  }
  const times = [...boundaries].sort((a, b) => a - b);
  const schedule = [];
  for (let i = 0; i < times.length - 1; i++) {
    const a = times[i],
      b = times[i + 1];
    if (b - a < 0.00001) continue;
    schedule.push({
      time: a,
      delay: b - a,
      frame: frameAtBeat((a + 1e-6) * project.fps),
      tick: project.wiggleEnabled
        ? projectHasMotion()
          ? a * project.boil
          : Math.floor((a + 1e-6) * project.boil) % 12
        : 0
    });
  }
  return { duration, schedule };
}
// PNG data is already compressed. Store ZIP entries without recompressing them.
