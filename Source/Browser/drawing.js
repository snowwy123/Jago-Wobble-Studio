// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Cameron Jago Lis Illustrates.
// Stroke geometry and the smooth and pixel renderers.

function random(seed) {
  let n = (seed | 0) + 0x6d2b79f5;
  n = Math.imul(n ^ (n >>> 15), n | 1);
  n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
  return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
}

function jitterPoint(p, index, op, tick) {
  const a = project.wiggleEnabled && op.animate ? project.wiggle : 0;
  if (!a) return p;
  const seed = op.seed,
    t = (tick * Math.PI) / 6;
  return {
    x:
      p.x +
      a *
        (Math.sin(index * 0.39 + seed * 0.001 + t * 2) * 0.65 +
          Math.sin(index * 0.13 - seed * 0.03 + t) * 0.35),
    y:
      p.y +
      a *
        (Math.cos(index * 0.34 + seed * 0.003 + t * 3) * 0.65 +
          Math.cos(index * 0.17 + seed * 0.002 - t) * 0.35),
    p: p.p
  };
}
// Original inspiration: John Earnest (Internet Janitor). Created by Cameron Jago Lis Illustrates.

function originalPathPoints(op, tick) {
  let ps = op.points;
  if (['line', 'rect', 'ellipse'].includes(op.tool)) {
    const a = ps[0],
      b = ps[ps.length - 1];
    ps = [];
    if (op.tool === 'ellipse') {
      for (let i = 0; i <= 64; i++) {
        const t = (i / 64) * Math.PI * 2;
        ps.push({
          x: (a.x + b.x) / 2 + ((b.x - a.x) / 2) * Math.cos(t),
          y: (a.y + b.y) / 2 + ((b.y - a.y) / 2) * Math.sin(t),
          p: 0.5
        });
      }
    } else {
      const vertices =
        op.tool === 'rect'
          ? [a, { x: b.x, y: a.y, p: 0.5 }, b, { x: a.x, y: b.y, p: 0.5 }, a]
          : [a, b];
      vertices.slice(1).forEach((v, i) => {
        const u = vertices[i],
          steps = Math.min(2048, Math.max(1, Math.ceil(Math.hypot(v.x - u.x, v.y - u.y) / 12)));
        for (let n = 0; n < steps; n++)
          ps.push({
            x: u.x + ((v.x - u.x) * n) / steps,
            y: u.y + ((v.y - u.y) * n) / steps,
            p: 0.5
          });
      });
      ps.push(vertices[vertices.length - 1]);
    }
  }
  const out = ps.map((p, i) => jitterPoint(p, i, op, tick));
  if (['rect', 'ellipse'].includes(op.tool)) out[out.length - 1] = { ...out[0] };
  return out;
}

function pathPoints(op, tick) {
  if (!extraShapes.includes(op.tool)) return originalPathPoints(op, tick);
  let ps = op.points;
  if (isShapeTool(op.tool)) {
    const a = ps[0],
      b = ps[ps.length - 1],
      left = Math.min(a.x, b.x),
      top = Math.min(a.y, b.y),
      w = Math.abs(b.x - a.x),
      h = Math.abs(b.y - a.y),
      vertices = [];
    const point = (x, y) => ({ x: left + x * w, y: top + y * h, p: 0.5 });
    if (op.tool === 'line') vertices.push(a, b);
    else if (op.tool === 'rect') vertices.push(point(0, 0), point(1, 0), point(1, 1), point(0, 1));
    else if (op.tool === 'triangle') vertices.push(point(0.5, 0), point(1, 1), point(0, 1));
    else if (op.tool === 'hexagon')
      vertices.push(
        point(0.25, 0),
        point(0.75, 0),
        point(1, 0.5),
        point(0.75, 1),
        point(0.25, 1),
        point(0, 0.5)
      );
    else if (op.tool === 'diamond')
      vertices.push(point(0.5, 0), point(1, 0.5), point(0.5, 1), point(0, 0.5));
    else if (op.tool === 'star') {
      for (let i = 0; i < 10; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 5,
          r = i % 2 ? 0.21 : 0.5;
        vertices.push(point(0.5 + Math.cos(angle) * r, 0.5 + Math.sin(angle) * r));
      }
    } else if (op.tool === 'heart') {
      const raw = [];
      for (let i = 0; i < 80; i++) {
        const t = (i / 80) * Math.PI * 2;
        raw.push({
          x: 16 * Math.sin(t) ** 3,
          y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
        });
      }
      const xs = raw.map((p) => p.x),
        ys = raw.map((p) => p.y),
        minX = Math.min(...xs),
        minY = Math.min(...ys),
        spanX = Math.max(...xs) - minX,
        spanY = Math.max(...ys) - minY;
      raw.forEach((p) => vertices.push(point((p.x - minX) / spanX, (p.y - minY) / spanY)));
    } else if (op.tool === 'arrow') {
      const length = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
        ux = (b.x - a.x) / length,
        uy = (b.y - a.y) / length,
        shaft = Math.max(2, Math.min(length * 0.075, op.size * 1.5)),
        head = Math.min(length * 0.42, Math.max(shaft * 3, length * 0.22));
      const p = (along, across) => ({
        x: a.x + ux * along - uy * across,
        y: a.y + uy * along + ux * across,
        p: 0.5
      });
      vertices.push(
        p(0, -shaft),
        p(length - head, -shaft),
        p(length - head, -head * 0.65),
        p(length, 0),
        p(length - head, head * 0.65),
        p(length - head, shaft),
        p(0, shaft)
      );
    } else if (op.tool === 'ellipse') {
      for (let i = 0; i < 64; i++) {
        const t = (i / 64) * Math.PI * 2;
        vertices.push(point(0.5 + 0.5 * Math.cos(t), 0.5 + 0.5 * Math.sin(t)));
      }
    }
    if (closedShapes.includes(op.tool)) vertices.push(vertices[0]);
    ps = [];
    for (let i = 0; i < vertices.length - 1; i++) {
      const u = vertices[i],
        v = vertices[i + 1],
        n = Math.min(2048, Math.max(1, Math.ceil(Math.hypot(v.x - u.x, v.y - u.y) / 10)));
      for (let j = 0; j < n; j++)
        ps.push({ x: u.x + ((v.x - u.x) * j) / n, y: u.y + ((v.y - u.y) * j) / n, p: 0.5 });
    }
    ps.push(vertices[vertices.length - 1] || a);
  }
  const out = ps.map((p, i) => jitterPoint(p, i, op, tick));
  if (closedShapes.includes(op.tool)) out[out.length - 1] = { ...out[0] };
  return out;
}

function drawPath(c, pts, width, variable) {
  c.lineCap = 'round';
  c.lineJoin = 'round';
  if (pts.length === 1) {
    c.beginPath();
    c.arc(pts[0].x, pts[0].y, width * (variable ? 0.3 + pts[0].p * 0.7 : 0.5), 0, Math.PI * 2);
    c.fill();
    return;
  }
  if (!variable) {
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++)
      c.quadraticCurveTo(
        pts[i].x,
        pts[i].y,
        (pts[i].x + pts[i + 1].x) / 2,
        (pts[i].y + pts[i + 1].y) / 2
      );
    const end = pts[pts.length - 1];
    c.lineTo(end.x, end.y);
    c.stroke();
    return;
  }
  let prev = pts[0];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i],
      next = pts[i + 1],
      end = next ? { x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 } : p;
    c.lineWidth = width * (0.25 + 0.75 * (prev.p + p.p));
    c.beginPath();
    c.moveTo(prev.x, prev.y);
    c.quadraticCurveTo(p.x, p.y, end.x, end.y);
    c.stroke();
    prev = { ...end, p: p.p };
  }
}
// Original inspiration: John Earnest (Internet Janitor). Created by Cameron Jago Lis Illustrates.

function updateStyleControls() {
  const pixel = project.renderStyle === 'pixel';
  $('smoothStyle').setAttribute('aria-pressed', String(!pixel));
  $('pixelStyle').setAttribute('aria-pressed', String(pixel));
  $('pixelSettings').classList.toggle('hidden', !pixel);
  $('pixelSize').value = project.pixelSize;
  $('pixelGridSize').textContent =
    `${Math.ceil(project.width / project.pixelSize)} × ${Math.ceil(project.height / project.pixelSize)} grid`;
  canvas.style.imageRendering = pixel ? 'pixelated' : 'auto';
}

function setRenderStyle(style) {
  if (drawing || moving || exporting) return;
  project.renderStyle = style;
  commit(
    style === 'pixel'
      ? 'Pixel style · original strokes preserved'
      : 'Smooth style · original strokes preserved'
  );
}
const pixelBrushCache = new Map();

function pixelDisk(c, x, y, diameter) {
  const d = Math.max(1, Math.round(diameter)),
    start = -Math.floor(d / 2);
  if (
    x + start >= c.canvas.width ||
    y + start >= c.canvas.height ||
    x + start + d <= 0 ||
    y + start + d <= 0
  )
    return;
  if (d === 1) {
    c.fillRect(x, y, 1, 1);
    return;
  }
  const key = d + ':' + c.fillStyle;
  let stamp = pixelBrushCache.get(key);
  if (!stamp) {
    stamp = makeCanvas(d, d);
    const sc = stamp.getContext('2d');
    sc.fillStyle = c.fillStyle;
    const centre = (d - 1) / 2,
      r2 = (d * d) / 4;
    for (let sy = 0; sy < d; sy++) {
      let left = d,
        right = -1;
      for (let sx = 0; sx < d; sx++)
        if ((sx - centre) ** 2 + (sy - centre) ** 2 <= r2) {
          left = Math.min(left, sx);
          right = sx;
        }
      if (right >= left) sc.fillRect(left, sy, right - left + 1, 1);
    }
    if (pixelBrushCache.size >= 96) pixelBrushCache.delete(pixelBrushCache.keys().next().value);
    pixelBrushCache.set(key, stamp);
  }
  c.drawImage(stamp, x + start, y + start);
}

function pixelPolygon(c, pts, cell) {
  const ps = pts.map((p) => ({ x: p.x / cell, y: p.y / cell }));
  const minY = Math.max(0, Math.floor(Math.min(...ps.map((p) => p.y)))),
    maxY = Math.min(c.canvas.height - 1, Math.ceil(Math.max(...ps.map((p) => p.y))));
  for (let y = minY; y <= maxY; y++) {
    const crossings = [],
      scan = y + 0.5;
    for (let i = 0, j = ps.length - 1; i < ps.length; j = i++) {
      const a = ps[j],
        b = ps[i];
      if ((a.y <= scan && b.y > scan) || (b.y <= scan && a.y > scan))
        crossings.push(a.x + ((scan - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i < crossings.length - 1; i += 2) {
      const x = Math.max(0, Math.ceil(crossings[i] - 0.5)),
        end = Math.min(c.canvas.width, Math.ceil(crossings[i + 1] - 0.5));
      if (end > x) c.fillRect(x, y, end - x, 1);
    }
  }
}

function drawPixelOp(c, op, tick, cell) {
  if (op.kind === 'image') {
    const im = imageCache.get(op.src);
    if (!im) return;
    c.save();
    c.imageSmoothingEnabled = false;
    c.globalAlpha = op.opacity ?? 1;
    const x = Math.floor(op.x / cell),
      y = Math.floor(op.y / cell),
      w = Math.max(1, Math.round(op.w / cell)),
      h = Math.max(1, Math.round(op.h / cell));
    c.translate(x + (op.flipX ? w : 0), y + (op.flipY ? h : 0));
    c.scale(op.flipX ? -1 : 1, op.flipY ? -1 : 1);
    c.drawImage(im, 0, 0, w, h);
    c.restore();
    return;
  }
  const sc = pixelStrokeCanvas.getContext('2d');
  sc.clearRect(0, 0, sc.canvas.width, sc.canvas.height);
  sc.globalAlpha = 1;
  sc.globalCompositeOperation = 'source-over';
  sc.fillStyle = op.color;
  const ps = pathPoints(op, tick),
    baseWidth = (op.size * (op.tool === 'pencil' ? 0.55 : op.tool === 'marker' ? 1.8 : 1)) / cell;
  const paint = (pts) => {
    if (op.filled && closedShapes.includes(op.tool)) pixelPolygon(sc, pts, cell);
    if (op.tool === 'spray') {
      pts.forEach((p, i) => {
        const count = Math.max(3, Math.floor(op.size * 0.7));
        for (let n = 0; n < count; n++) {
          const seed = op.seed + i * 239 + n * 31,
            t = random(seed) * Math.PI * 2,
            r = Math.sqrt(random(seed + 1)) * op.size;
          sc.globalAlpha = 0.2 + random(seed + 2) * 0.6;
          sc.fillRect(
            Math.floor((p.x + Math.cos(t) * r) / cell),
            Math.floor((p.y + Math.sin(t) * r) / cell),
            1,
            1
          );
        }
      });
      sc.globalAlpha = 1;
      return;
    }
    const stamp = (x, y, p) =>
      pixelDisk(sc, x, y, baseWidth * (op.pressure && !isShapeTool(op.tool) ? 0.25 + 1.5 * p : 1));
    if (pts.length === 1) stamp(Math.floor(pts[0].x / cell), Math.floor(pts[0].y / cell), pts[0].p);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1],
        b = pts[i];
      let x = Math.floor(a.x / cell),
        y = Math.floor(a.y / cell);
      const bx = Math.floor(b.x / cell),
        by = Math.floor(b.y / cell),
        dx = Math.abs(bx - x),
        dy = -Math.abs(by - y),
        sx = x < bx ? 1 : -1,
        sy = y < by ? 1 : -1;
      let err = dx + dy,
        step = 0,
        total = Math.max(dx, -dy, 1);
      while (true) {
        stamp(x, y, a.p + ((b.p - a.p) * step) / total);
        if (x === bx && y === by) break;
        const e = err * 2;
        if (e >= dy) {
          err += dy;
          x += sx;
        }
        if (e <= dx) {
          err += dx;
          y += sy;
        }
        step++;
      }
    }
    if (op.tool === 'pencil' && baseWidth > 1) {
      sc.save();
      sc.globalCompositeOperation = 'destination-out';
      pts.forEach((p, i) => {
        const seed = op.seed + i * 17;
        if (random(seed) > 0.55)
          sc.fillRect(
            Math.floor(p.x / cell + (random(seed + 1) - 0.5) * baseWidth),
            Math.floor(p.y / cell + (random(seed + 2) - 0.5) * baseWidth),
            1,
            1
          );
      });
      sc.restore();
    }
  };
  paint(ps);
  if (op.mirror) paint(ps.map((p) => ({ ...p, x: project.width - p.x })));
  c.save();
  c.globalAlpha = op.opacity * (op.tool === 'marker' ? 0.42 : 1);
  c.globalCompositeOperation = op.tool === 'eraser' ? 'destination-out' : 'source-over';
  c.drawImage(pixelStrokeCanvas, 0, 0);
  c.restore();
}

function renderPixelLayer(fi, id, tick, includeDraft, cell = project.pixelSize) {
  const w = Math.ceil(project.width / cell),
    h = Math.ceil(project.height / cell);
  if (pixelLayerCanvas.width !== w || pixelLayerCanvas.height !== h) {
    pixelLayerCanvas = makeCanvas(w, h);
    pixelStrokeCanvas = makeCanvas(w, h);
  }
  const pc = pixelLayerCanvas.getContext('2d');
  pc.clearRect(0, 0, w, h);
  for (const op of project.frames[fi].contents[id] || []) drawPixelOp(pc, op, tick, cell);
  if (includeDraft && draft && id === project.activeLayer) drawPixelOp(pc, draft, 0, cell);
  const lc = layerCanvas.getContext('2d');
  lc.clearRect(0, 0, project.width, project.height);
  lc.save();
  lc.imageSmoothingEnabled = false;
  lc.drawImage(pixelLayerCanvas, 0, 0, w * cell, h * cell);
  lc.restore();
  return layerCanvas;
}

function drawOp(c, op, tick) {
  if (op.kind === 'image') {
    const im = imageCache.get(op.src);
    if (im) {
      c.save();
      c.globalAlpha = op.opacity ?? 1;
      c.translate(op.x + (op.flipX ? op.w : 0), op.y + (op.flipY ? op.h : 0));
      c.scale(op.flipX ? -1 : 1, op.flipY ? -1 : 1);
      c.drawImage(im, 0, 0, op.w, op.h);
      c.restore();
    }
    return;
  }
  const sc = strokeCanvas.getContext('2d');
  sc.clearRect(0, 0, project.width, project.height);
  sc.globalCompositeOperation = 'source-over';
  sc.globalAlpha = 1;
  sc.fillStyle = sc.strokeStyle = op.color;
  let pts = pathPoints(op, tick);
  const paint = () => {
    if (op.tool === 'spray') {
      pts.forEach((p, i) => {
        const count = Math.max(3, Math.floor(op.size * 0.7));
        for (let n = 0; n < count; n++) {
          const base = op.seed + i * 239 + n * 31,
            angle = random(base) * Math.PI * 2,
            r = Math.sqrt(random(base + 1)) * op.size;
          sc.globalAlpha = 0.2 + random(base + 2) * 0.6;
          sc.beginPath();
          sc.arc(
            p.x + Math.cos(angle) * r,
            p.y + Math.sin(angle) * r,
            0.5 + random(base + 3) * 1.2,
            0,
            Math.PI * 2
          );
          sc.fill();
        }
      });
      sc.globalAlpha = 1;
    } else {
      if (op.filled && closedShapes.includes(op.tool)) {
        sc.beginPath();
        sc.moveTo(pts[0].x, pts[0].y);
        pts.slice(1).forEach((p) => sc.lineTo(p.x, p.y));
        sc.closePath();
        sc.fill();
      }
      drawPath(
        sc,
        pts,
        op.tool === 'pencil' ? op.size * 0.55 : op.tool === 'marker' ? op.size * 1.8 : op.size,
        op.pressure && !isShapeTool(op.tool)
      );
      if (op.tool === 'pencil') {
        sc.save();
        sc.globalCompositeOperation = 'destination-out';
        pts.forEach((p, i) => {
          for (let n = 0; n < 3; n++) {
            const s = op.seed + i * 17 + n * 113;
            sc.fillRect(
              p.x + (random(s) - 0.5) * op.size,
              p.y + (random(s + 1) - 0.5) * op.size,
              random(s + 2) * 1.2 + 0.4,
              random(s + 3) * 1.2 + 0.4
            );
          }
        });
        sc.restore();
      }
    }
  };
  paint();
  if (op.mirror) {
    sc.save();
    sc.translate(project.width, 0);
    sc.scale(-1, 1);
    paint();
    sc.restore();
  }
  c.save();
  c.globalAlpha = op.opacity * (op.tool === 'marker' ? 0.42 : 1);
  c.globalCompositeOperation = op.tool === 'eraser' ? 'destination-out' : 'source-over';
  c.drawImage(strokeCanvas, 0, 0);
  c.restore();
}

function renderLayer(
  fi,
  id,
  tick,
  includeDraft = false,
  style = project.renderStyle,
  cell = project.pixelSize
) {
  if (style === 'pixel') return renderPixelLayer(fi, id, tick, includeDraft, cell);
  const lc = layerCanvas.getContext('2d', { willReadFrequently: true });
  lc.clearRect(0, 0, project.width, project.height);
  for (const op of project.frames[fi].contents[id] || []) drawOp(lc, op, tick);
  if (includeDraft && draft && id === project.activeLayer) drawOp(lc, draft, 0);
  return layerCanvas;
}

function renderFrame(
  fi,
  tick,
  withPaper = true,
  includeDraft = false,
  style = project.renderStyle,
  cell = project.pixelSize
) {
  const key = `${revision}:${fi}:${tick}:${withPaper}:${style}:${cell}`;
  if (!includeDraft && renderCache.has(key)) return renderCache.get(key);
  const c = makeCanvas(),
    cc = c.getContext('2d');
  if (withPaper && !project.transparent) {
    cc.fillStyle = project.paper;
    cc.fillRect(0, 0, c.width, c.height);
  }
  for (const l of project.layers) {
    if (!l.visible || l.opacity === 0) continue;
    cc.globalAlpha = l.opacity;
    cc.drawImage(renderLayer(fi, l.id, tick, includeDraft, style, cell), 0, 0);
  }
  cc.globalAlpha = 1;
  if (!includeDraft) {
    if (renderCache.size >= 8) renderCache.delete(renderCache.keys().next().value);
    renderCache.set(key, c);
  }
  return c;
}

function drawOnion(fi, tint, alpha = 0.2) {
  const c = onionCanvas.getContext('2d');
  c.clearRect(0, 0, project.width, project.height);
  c.globalCompositeOperation = 'source-over';
  c.drawImage(renderFrame(fi, 0, false), 0, 0);
  if (tint) {
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = tint;
    c.fillRect(0, 0, project.width, project.height);
    c.globalCompositeOperation = 'source-over';
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(onionCanvas, 0, 0);
  ctx.restore();
}

function paintCanvas() {
  const fi = playing ? playIndex : project.current;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!project.transparent) {
    ctx.fillStyle = project.paper;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (onion && !playing) paintOnionFrames(fi);
  ctx.drawImage(renderFrame(fi, drawing ? 0 : phase, false, !!draft), 0, 0);
  renderNeeded = false;
}
