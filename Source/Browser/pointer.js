// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Cameron Jago Lis Illustrates.
// Drawing, moving, filling and image caching.

function constrainPoint(a, p, e) {
  if (!e.shiftKey) return p;
  const dx = p.x - a.x,
    dy = p.y - a.y;
  if (tool === 'line' || tool === 'arrow') {
    const angle = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI) / 4,
      r = Math.hypot(dx, dy);
    return { ...p, x: a.x + Math.cos(angle) * r, y: a.y + Math.sin(angle) * r };
  }
  if (closedShapes.includes(tool) && tool !== 'arrow') {
    const d = Math.max(Math.abs(dx), Math.abs(dy));
    return {
      ...p,
      x: clamp(a.x + Math.sign(dx || 1) * d, 0, project.width),
      y: clamp(a.y + Math.sign(dy || 1) * d, 0, project.height)
    };
  }
  return p;
}
canvas.addEventListener('pointerdown', async (e) => {
  if (
    exporting ||
    drawing ||
    moving ||
    panning ||
    (selectionDrag && selectionDrag.tool !== 'polygon') ||
    e.button > 1 ||
    (!touchDrawing && e.pointerType === 'touch')
  )
    return;
  e.preventDefault();
  canvas.focus({ preventScroll: true });
  canvas.setPointerCapture(e.pointerId);
  pointerId = e.pointerId;
  if (tool === 'hand' || e.button === 1) {
    panning = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    canvas.style.cursor = 'grabbing';
    return;
  }
  pause();
  const p = pointFrom(e),
    handle = hitSelectionHandle(p);
  if (handle !== null) {
    beginSelectionHandle(e, handle);
    return;
  }
  if (['select', 'lasso', 'polygon'].includes(tool)) {
    if (insideSelection(p)) {
      if (canDraw()) beginSelectionMove(e);
    } else {
      if (tool === 'polygon') addPolygonCorner(p);
      else beginSelection(e, p);
    }
    return;
  }
  if (tool === 'picker') {
    const source = renderFrame(project.current, 0, true),
      pixel = source
        .getContext('2d')
        .getImageData(
          Math.min(project.width - 1, Math.floor(p.x)),
          Math.min(project.height - 1, Math.floor(p.y)),
          1,
          1
        ).data;
    if (pixel[3])
      setColour(
        '#' +
          Array.from(pixel.slice(0, 3))
            .map((v) => v.toString(16).padStart(2, '0'))
            .join('')
      );
    setTool('pen');
    return;
  }
  if (!canDraw()) return;
  if (tool === 'move') {
    if (selection) {
      beginSelectionMove(e);
      return;
    }
    if (!currentOps().length) {
      toast('This layer is empty in the current frame');
      return;
    }
    moving = { x: e.clientX, y: e.clientY, ops: copy(currentOps()) };
    return;
  }
  if (tool === 'fill') {
    await floodFill(p);
    return;
  }
  drawing = true;
  draft = {
    kind: 'stroke',
    tool,
    filled: shapeFilled && closedShapes.includes(tool),
    color: colour,
    size: brushSize,
    opacity,
    pressure: pressure && e.pointerType === 'pen',
    animate: animateStroke && tool !== 'eraser',
    mirror: symmetry,
    seed: Math.floor(Math.random() * 1e6),
    points: [p]
  };
  configureNewStroke(draft);
  $('emptyHint').classList.add('hidden');
  renderNeeded = true;
});
canvas.addEventListener('pointermove', (e) => {
  if (selectionDrag?.tool === 'polygon' && !panning) {
    selectionDrag.hover = pointFrom(e);
    renderNeeded = true;
    return;
  }
  if (pointerId !== e.pointerId) {
    const p = pointFrom(e),
      handle = hitSelectionHandle(p);
    canvas.style.cursor =
      handle === 'rotate'
        ? 'grab'
        : handle !== null
          ? 'nwse-resize'
          : tool === 'hand'
            ? 'grab'
            : tool === 'move' ||
                (['select', 'lasso', 'polygon'].includes(tool) && insideSelection(p))
              ? 'move'
              : 'crosshair';
    return;
  }
  if (moving?.handle !== undefined) {
    updateSelectionHandle(e);
    return;
  }
  if (selectionDrag) {
    extendSelection(e);
    return;
  }
  if (panning) {
    pan = { x: panning.px + e.clientX - panning.x, y: panning.py + e.clientY - panning.y };
    applyView();
    return;
  }
  if (moving) {
    let dx = (e.clientX - moving.x) / zoom,
      dy = (e.clientY - moving.y) / zoom;
    if (e.shiftKey) {
      if (Math.abs(dx) > Math.abs(dy)) dy = 0;
      else dx = 0;
    }
    if (moving.selection) {
      updateSelectionMove(dx, dy);
      return;
    }
    if (project.canvasMode === 'pixel') {
      dx = Math.round(dx);
      dy = Math.round(dy);
    }
    const ops = translatedOps(moving.ops, dx, dy);
    currentFrame().contents[project.activeLayer] = ops;
    invalidate();
    return;
  }
  if (!drawing || !draft) return;
  let events = e.getCoalescedEvents?.() || [e];
  if (!events.length) events = [e];
  for (const ev of events) {
    let p = pointFrom(ev);
    if (isShapeTool(draft.tool)) {
      draft.points[1] = constrainPoint(draft.points[0], p, e);
    } else {
      const last = draft.points[draft.points.length - 1],
        distance = Math.hypot(p.x - last.x, p.y - last.y);
      if (distance < 1) continue;
      const factor = project.canvasMode === 'pixel' ? 1 : 1 - smoothing * 0.75;
      p = { ...p, x: last.x + (p.x - last.x) * factor, y: last.y + (p.y - last.y) * factor };
      const steps = Math.min(
        60,
        Math.max(1, Math.ceil(distance / (draft.tool === 'spray' ? 4 : 5)))
      );
      for (let n = 1; n <= steps; n++) {
        draft.points.push({
          x: last.x + ((p.x - last.x) * n) / steps,
          y: last.y + ((p.y - last.y) * n) / steps,
          p: last.p + ((p.p - last.p) * n) / steps
        });
      }
      if (draft.points.length > 15000) {
        toast('Stroke size limit reached - start another stroke');
        finishStroke();
        break;
      }
    }
  }
  renderNeeded = true;
});

function translatedOps(source, dx, dy) {
  const ops = [];
  for (const original of source) {
    const op = copy(original);
    if (op.kind === 'group') {
      op.transform[4] += dx;
      op.transform[5] += dy;
    } else if (op.kind === 'image') {
      op.x += dx;
      op.y += dy;
    } else {
      op.points.forEach((p) => {
        p.x += dx;
        p.y += dy;
      });
      if (op.mirror && op.symmetry) {
        op.symmetry.centerX += dx;
        op.symmetry.centerY += dy;
      } else if (op.mirror) {
        op.mirror = false;
        const other = copy(op);
        other.points = original.points.map((p) => ({
          ...p,
          x: project.width - p.x + dx,
          y: p.y + dy
        }));
        ops.push(other);
      }
    }
    ops.push(op);
  }
  return ops;
}

function flipArtwork(axis) {
  if (!canDraw()) return;
  const horizontal = axis === 'x';
  for (const op of currentOps()) {
    if (op.kind === 'group') {
      const m = op.transform;
      if (horizontal) {
        m[0] *= -1;
        m[2] *= -1;
        m[4] = project.width - m[4];
      } else {
        m[1] *= -1;
        m[3] *= -1;
        m[5] = project.height - m[5];
      }
    } else if (op.kind === 'image') {
      if (horizontal) {
        op.x = project.width - op.x - op.w;
        op.flipX = !op.flipX;
      } else {
        op.y = project.height - op.y - op.h;
        op.flipY = !op.flipY;
      }
    } else {
      op.points.forEach((p) => (p[axis] = (horizontal ? project.width : project.height) - p[axis]));
      if (op.symmetry) {
        const key = horizontal ? 'centerX' : 'centerY';
        op.symmetry[key] = (horizontal ? project.width : project.height) - op.symmetry[key];
      }
    }
  }
  commit('Artwork flipped');
}
$('flipH').onclick = () => flipArtwork('x');
$('flipV').onclick = () => flipArtwork('y');
$('clearLayer').onclick = () => {
  if (!canDraw()) return;
  confirmAction(
    'Clear this layer?',
    'This clears only the active layer in the current frame. You can undo this.',
    () => {
      currentFrame().contents[project.activeLayer] = [];
      commit('Layer cleared');
    }
  );
};

function finishStroke(cancel = false) {
  if (selectionDrag && !panning) {
    if (selectionDrag.tool === 'polygon' && !cancel) {
      pointerId = null;
      return;
    }
    finishSelection(cancel);
    pointerId = null;
    return;
  }
  if (panning) {
    panning = null;
    canvas.style.cursor = tool === 'hand' ? 'grab' : 'crosshair';
  }
  if (moving) {
    if (cancel) {
      currentFrame().contents[project.activeLayer] = moving.ops;
      if (moving.selection) selection = copy(moving.savedSelection);
    } else if (moving.selection && selection) {
      selection.previewLive = true;
    }
    moving = null;
    cancel ? (invalidate(), updateUI()) : commit();
  }
  if (drawing && draft) {
    if (!cancel) currentOps().push(draft);
    draft = null;
    drawing = false;
    if (!cancel) commit();
    else {
      invalidate();
      updateUI();
    }
  }
  pointerId = null;
}
canvas.addEventListener('dblclick', (e) => {
  if (selectionDrag?.tool === 'polygon') {
    e.preventDefault();
    finishSelection(false);
  }
});
canvas.addEventListener('pointerup', () => finishStroke());
canvas.addEventListener('pointercancel', () => finishStroke(true));
canvas.addEventListener('lostpointercapture', () => {
  if (drawing || panning || moving || selectionDrag) finishStroke();
});
$('viewport').addEventListener(
  'wheel',
  (e) => {
    if (exporting) return;
    e.preventDefault();
    zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY);
  },
  { passive: false }
);

async function floodFill(p) {
  const source =
      fillReference === 'visible'
        ? renderFrame(project.current, 0, false)
        : renderLayer(project.current, project.activeLayer, 0),
    sc = source.getContext('2d'),
    w = project.width,
    h = project.height,
    img = sc.getImageData(0, 0, w, h),
    pixels = img.data,
    x = Math.min(w - 1, Math.floor(p.x)),
    y = Math.min(h - 1, Math.floor(p.y)),
    start = (y * w + x) * 4,
    target = Array.from(pixels.slice(start, start + 4)),
    rgba = [
      parseInt(colour.slice(1, 3), 16),
      parseInt(colour.slice(3, 5), 16),
      parseInt(colour.slice(5, 7), 16),
      Math.round(opacity * 255)
    ];
  if (target.every((v, i) => Math.abs(v - rgba[i]) < 2)) return;
  const seen = new Uint8Array(w * h),
    out = new ImageData(w, h),
    stack = [y * w + x],
    match = (i) =>
      target[3] < 16
        ? pixels[i + 3] < 16
        : Math.abs(pixels[i] - target[0]) < 34 &&
          Math.abs(pixels[i + 1] - target[1]) < 34 &&
          Math.abs(pixels[i + 2] - target[2]) < 34 &&
          Math.abs(pixels[i + 3] - target[3]) < 34;
  while (stack.length) {
    const pos = stack.pop();
    if (seen[pos]) continue;
    seen[pos] = 1;
    const k = pos * 4;
    if (!match(k)) continue;
    out.data.set(rgba, k);
    if (pos % w > 0) stack.push(pos - 1);
    if (pos % w < w - 1) stack.push(pos + 1);
    if (pos >= w) stack.push(pos - w);
    if (pos < w * (h - 1)) stack.push(pos + w);
  }
  const patch = makeCanvas();
  patch.getContext('2d').putImageData(out, 0, 0);
  const src = patch.toDataURL('image/png');
  await cacheImage(src);
  currentOps().push({
    kind: 'image',
    src,
    x: 0,
    y: 0,
    w,
    h,
    opacity: 1,
    alphaLock: !!activeLayer().alphaLock,
    selection: selection ? copy(selection.points) : undefined
  });
  commit('Area filled');
}

function cacheImage(src) {
  if (imageCache.has(src)) return Promise.resolve(imageCache.get(src));
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => {
      imageCache.set(src, im);
      resolve(im);
    };
    im.onerror = () => reject(new Error('An image could not be read'));
    im.src = src;
  });
}

async function preloadImages() {
  const sources = new Set();
  for (const f of project.frames)
    for (const ops of Object.values(f.contents))
      for (const op of allOperations(ops)) if (op.kind === 'image') sources.add(op.src);
  for (const tip of Object.values(project.brushTips || {})) sources.add(tip.src);
  await Promise.all([...sources].map(cacheImage));
}
