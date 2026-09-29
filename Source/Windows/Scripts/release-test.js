// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Cameron Jago Lis Illustrates.
window.releaseTestResult = 'running';
(async () => {
  const saved = snapshot();
  const capture = canvas.setPointerCapture;
  let checks = 0;
  const assert = (ok, name) => {
    if (!ok) throw Error(name);
    checks++;
  };
  const pixels = (c) => c.toDataURL();
  const fire = (type, x, y) => {
    const box = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        pointerId: 17,
        pointerType: 'mouse',
        button: 0,
        clientX: box.left + x * zoom,
        clientY: box.top + y * zoom
      })
    );
  };
  const square = () => ({
    points: [
      { x: 20, y: 20 },
      { x: 100, y: 20 },
      { x: 100, y: 100 },
      { x: 20, y: 100 }
    ]
  });
  try {
    pause();
    // Synthetic pointer events have no OS capture; the real handlers still do the work.
    canvas.setPointerCapture = () => {};
    for (const size of [1, 2, 3, 4, 6, 8, 12]) {
      $('newBtn').click();
      $('canvasSize').value = '128,128';
      $('newStyle').value = 'pixel';
      $('newStyle').dispatchEvent(new Event('change'));
      $('newPixelSize').value = size;
      assert(!$('newPixelField').classList.contains('hidden'), 'new pixel selector visible');
      $('createProject').click();
      assert(
        project.pixelSize === size && project.renderStyle === 'pixel',
        'new pixel size ' + size
      );
      assert(
        validateProject(JSON.parse(snapshot())).pixelSize === size,
        'saved pixel size ' + size
      );
    }
    $('newBtn').click();
    $('newStyle').value = 'nativePixel';
    $('newStyle').dispatchEvent(new Event('change'));
    assert($('newPixelField').classList.contains('hidden'), 'native canvas stays a real 1 px grid');
    $('createProject').click();
    assert(project.pixelSize === 1 && project.canvasMode === 'pixel', 'native pixel project');

    project = fresh(128, 128);
    currentOps().push({
      kind: 'stroke',
      tool: 'pen',
      color: '#123456',
      size: 9,
      opacity: 1,
      pressure: false,
      animate: true,
      mirror: false,
      seed: 17,
      points: [
        { x: 29, y: 38, p: 0.5 },
        { x: 79, y: 87, p: 0.5 }
      ]
    });
    resizeBuffers();
    invalidate();
    resetHistory();
    updateUI();
    fit();
    const before = snapshot();
    for (const type of [
      'classic',
      'sway',
      'ripple',
      'flutter',
      'breathe',
      'spring',
      'drift',
      'crawl'
    ]) {
      activeLayer().motion = motionDefaults(type);
      invalidate();
      for (const size of [1, 2, 3, 4, 6, 8, 12]) {
        const original = project.pixelSize;
        const chosen = pixels(exportCanvas(0, 2, 128, 128, true, 'pixel', size));
        assert(project.pixelSize === original, 'export keeps project size');
        project.pixelSize = size;
        invalidate();
        const expected = pixels(exportCanvas(0, 2, 128, 128, true, 'pixel'));
        assert(chosen === expected, type + ' renders requested block size ' + size);
        project.pixelSize = original;
        invalidate();
      }
    }
    project = validateProject(JSON.parse(before));
    resizeBuffers();
    invalidate();
    updateUI();
    fit();
    $('exportBtn').click();
    $('exportStyle').value = 'pixel';
    $('exportStyle').dispatchEvent(new Event('change'));
    $('exportPixelSize').value = '8';
    assert(!$('exportPixelField').classList.contains('hidden'), 'export pixel selector visible');
    $('exportStyle').value = 'smooth';
    $('exportStyle').dispatchEvent(new Event('change'));
    assert($('exportPixelField').classList.contains('hidden'), 'smooth hides pixel selector');
    $('exportDialog').close();
    assert(snapshot() === before, 'opening export preserves drawing');

    const renderExport = exportCanvas,
      saveDownload = download;
    try {
      for (const format of ['png', 'gif', 'sheet', 'sequence']) {
        let blob;
        const cells = [];
        exportCanvas = (...args) => {
          cells.push(args[6]);
          return renderExport(...args);
        };
        download = (output) => {
          blob = output;
        };
        $('exportBtn').click();
        $('exportStyle').value = 'pixel';
        $('exportPixelSize').value = '6';
        $('exportFormat').value = format;
        $('exportSeconds').value = '1';
        $('sequenceRate').value = '12';
        $('exportScale').value = '1';
        await $('downloadExport').onclick();
        assert(
          blob?.size > 0 && cells.length && cells.every((n) => n === 6),
          format + ' receives selected pixel size'
        );
        assert(snapshot() === before, format + ' leaves project untouched');
        if (format === 'sequence') {
          const bytes = new TextDecoder().decode(await blob.arrayBuffer());
          assert(bytes.includes('"pixelSize": 6'), 'sequence records pixel size');
        }
      }
    } finally {
      exportCanvas = renderExport;
      download = saveDownload;
    }

    for (const toolName of ['select', 'lasso', 'polygon']) {
      project = validateProject(JSON.parse(before));
      resizeBuffers();
      invalidate();
      resetHistory();
      updateUI();
      fit();
      setTool(toolName);
      selection = square();
      fire('pointerdown', 60, 60);
      assert(
        moving?.selection && tool === toolName,
        toolName + ' starts inside drag without switching'
      );
      fire('pointermove', 70, 68);
      fire('pointerup', 70, 68);
      assert(
        selection.points[0].x === 30 && selection.points[0].y === 28,
        'selection follows drag'
      );
      assert(
        currentOps().some((op) => op.kind === 'group'),
        'keeps live stroke data'
      );
      assert(
        pixels(renderFrame(0, 0, false)) !== pixels(renderFrame(0, 4, false)),
        'moved selection animates'
      );
      undo();
      assert(snapshot() === before, 'selection move undo');
      selection = square();
      fire('pointerdown', 60, 60);
      fire('pointermove', 70, 68);
      fire('pointercancel', 70, 68);
      assert(snapshot() === before && selection.points[0].x === 20, 'selection cancel');
    }
    clearSelection();
    setTool('polygon');
    for (const [x, y] of [
      [20, 20],
      [100, 20],
      [100, 100],
      [20, 100]
    ]) {
      fire('pointerdown', x, y);
      fire('pointerup', x, y);
    }
    assert(selectionDrag.points.length === 4 && !selection, 'polygon waits for completion');
    handleStudioShortcut({ key: 'Backspace', preventDefault() {} }, false, false);
    assert(selectionDrag.points.length === 3, 'polygon backspace');
    handleStudioShortcut({ key: 'Enter', preventDefault() {} }, false, false);
    assert(selection?.points.length === 3 && !selectionDrag, 'polygon Enter closes');
    assert(
      insideSelection({ x: 80, y: 40 }) && !insideSelection({ x: 25, y: 90 }),
      'actual triangular hit region'
    );
    clearSelection();
    for (const [x, y] of [
      [20, 20],
      [100, 20],
      [100, 100]
    ]) {
      fire('pointerdown', x, y);
      fire('pointerup', x, y);
    }
    canvas.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    assert(selection?.points.length === 3, 'polygon double-click closes');
    clearSelection();
    fire('pointerdown', 20, 20);
    fire('pointerup', 20, 20);
    handleStudioShortcut({ key: 'Escape', preventDefault() {} }, false, false);
    assert(!selectionDrag && !selection, 'polygon Escape cancels');

    for (const hex of [
      '#000000',
      '#ffffff',
      '#ff0000',
      '#00ff00',
      '#0000ff',
      '#edce83',
      '#123456'
    ]) {
      assert(hsvToHex(hexToHSV(hex)) === hex, 'colour round-trip ' + hex);
    }
    setColour('#123456');
    $('toolColor').click();
    assert($('colourDialog').open, 'toolbar opens shared colour wheel');
    $('colourHex').value = '#edce83';
    $('colourHex').dispatchEvent(new Event('change', { bubbles: true }));
    assert(
      colour === '#edce83' && $('color').value === colour,
      'wheel applies colour to both swatches'
    );
    $('color').click();
    $('colourHex').value = '#ffffff';
    $('colourDialog').close();
    assert(colour === '#edce83', 'unsubmitted hex leaves ink alone');
    const oldPaper = project.paper;
    $('paperColor').click();
    $('colourHex').value = '#abcdef';
    $('colourHex').dispatchEvent(new Event('change', { bubbles: true }));
    assert(project.paper === '#abcdef', 'paper uses shared wheel');
    undo();
    assert(project.paper === oldPaper, 'paper colour has one undo step');
    $('shadeBase').click();
    $('colourHex').value = '#abcxyz';
    $('colourHex').dispatchEvent(new Event('change', { bubbles: true }));
    assert(
      $('colourDialog').open && $('colourPickerError').textContent,
      'invalid hex shows feedback'
    );
    $('colourHex').value = '#aabbcc';
    $('colourHex').dispatchEvent(new Event('change', { bubbles: true }));
    assert(project.shadePalette[0] === '#aabbcc', 'shading uses shared wheel');
    assert(icons.onionSettings !== icons.frameTiming, 'timeline icons are distinct');
    assert(!$('colourDialog').matches(':modal'), 'colour panel never blocks tools');
    $('expandColour').click();
    assert($('colourDialog').classList.contains('expanded'), 'colour panel expands');
    $('expandColour').click();
    assert(!$('colourDialog').classList.contains('expanded'), 'colour panel returns to corner');
    $('toolColor').click();
    $('colourR').value = '12';
    $('colourG').value = '34';
    $('colourB').value = '56';
    $('colourB').dispatchEvent(new Event('change'));
    assert(colour === '#0c2238', 'RGB sets ink');
    $('colourR').value = '999';
    $('colourR').dispatchEvent(new Event('change'));
    assert(
      colour === '#0c2238' && $('colourPickerError').textContent,
      'invalid RGB does not change ink'
    );
    setColour('#edce83');
    assert($('colourHex').value === '#edce83', 'palette and eyedropper sync open picker');
    $('closeColour').click();

    $('newBtn').click();
    $('newStyle').value = 'nativePixel';
    $('newStyle').dispatchEvent(new Event('change'));
    assert($('canvasSize').value === '128,128', 'explicit pixel canvas offers pixel size');
    $('createProject').click();
    assert(project.width === 128 && project.canvasMode === 'pixel', 'chosen pixel canvas opens');
    $('newBtn').click();
    assert(
      $('canvasSize').value === '960,640' && $('newStyle').value === 'smooth',
      'New resets previous pixel choice'
    );
    $('createProject').click();
    assert(
      project.width === 960 && project.height === 640 && project.renderStyle === 'smooth',
      'blank opens default canvas'
    );
    $('newBtn').click();
    $('canvasSize').value = '64,64';
    $('canvasSize').dispatchEvent(new Event('change'));
    $('newDialog').close();
    $('demoBtn').click();
    assert(
      $('starter').value === 'demo' && $('canvasSize').value === '960,640',
      'demo ignores cancelled pixel dimensions'
    );
    $('createProject').click();
    pause();
    assert(
      project.name === 'Bouncing ball' &&
        project.width === 960 &&
        project.height === 640 &&
        project.canvasMode === 'drawing',
      'ball opens intended drawing canvas'
    );
    assert(project.frames.length === 24, 'ball keeps all animation frames');
    $('newBtn').click();
    $('canvasSize').value = '1920,1080';
    $('canvasSize').dispatchEvent(new Event('change'));
    $('newStyle').value = 'pixel';
    $('newPixelSize').value = '8';
    $('createProject').click();
    assert(
      project.width === 1920 && project.height === 1080 && project.pixelSize === 8,
      'explicit size and pixel look are respected'
    );
    $('quickMotion').checked = false;
    $('quickMotion').dispatchEvent(new Event('change'));
    assert(
      !project.wiggleEnabled && !$('wiggleEnabled').checked,
      'corner motion switch disables both'
    );
    $('wiggleEnabled').checked = true;
    $('wiggleEnabled').dispatchEvent(new Event('change'));
    assert(project.wiggleEnabled && $('quickMotion').checked, 'main motion switch updates corner');
    undo();
    assert(!project.wiggleEnabled && !$('quickMotion').checked, 'undo syncs motion switches');
    $('pauseMotion').click();
    $('quickMotion').checked = true;
    $('quickMotion').dispatchEvent(new Event('change'));
    assert(project.wiggleEnabled && !motionPaused, 'enabling live motion resumes paused motion');

    window.releaseTestResult = 'PASS: ' + checks + ' release checks';
  } catch (e) {
    window.releaseTestResult = 'FAIL: ' + e.message;
  } finally {
    canvas.setPointerCapture = capture;
    for (const id of ['newDialog', 'exportDialog', 'colourDialog']) $(id).close();
    clearSelection();
    moving = null;
    pointerId = null;
    project = validateProject(JSON.parse(saved));
    resizeBuffers();
    invalidate();
    resetHistory();
    updateUI();
    fit();
  }
})();
