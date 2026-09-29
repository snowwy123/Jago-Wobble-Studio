(() => {
  try {
    const assert = (b, m) => {
      if (!b) throw Error(m);
    };
    const stage = (m) => chrome.webview.postMessage('test-stage:' + m);
    stage('start');
    assert(
      document.querySelectorAll('[data-tool]').length === 28 &&
        document.querySelector('[data-tool="polygon"]'),
      'toolbar loaded'
    );
    assert(canvas.width === project.width && typeof GIFWriter === 'function', 'engine loaded');
    assert(
      $('toolColor').type === 'color' && typeof $('toolColor').onclick === 'function',
      'independent quick picker'
    );
    showPanel('motion');
    const colourPanel = $('tab-motion').getAttribute('aria-selected');
    $('toolColor').value = '#ef6461';
    $('toolColor').dispatchEvent(new Event('input', { bubbles: true }));
    assert(
      colour === '#ef6461' && $('color').value === colour && $('hexColor').value === colour,
      'quick colour synchronisation'
    );
    assert(
      $('tab-motion').getAttribute('aria-selected') === colourPanel,
      'quick picker preserves panel'
    );
    setColour('#55c4ed');
    assert($('toolColor').value === '#55c4ed', 'sidebar colour synchronisation');
    showPanel('draw');
    project = fresh(256, 192);
    resizeBuffers();
    invalidate();
    resetHistory();
    updateUI();
    fit();
    const bounds = canvas.getBoundingClientRect();
    const event = (type, x, y) =>
      canvas.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 1,
          button: 0,
          buttons: type === 'pointerup' ? 0 : 1,
          pointerType: 'pen',
          pressure: 0.7,
          clientX: bounds.left + x * zoom,
          clientY: bounds.top + y * zoom,
          bubbles: true
        })
      );
    // Synthetic events cannot own pointer capture; exercise the engine through its state API instead.
    currentOps().push({
      kind: 'stroke',
      tool: 'pen',
      color: '#ef6461',
      size: 10,
      opacity: 1,
      pressure: true,
      animate: true,
      mirror: false,
      seed: 123,
      points: [
        { x: 30, y: 40, p: 0.3 },
        { x: 100, y: 120, p: 0.9 },
        { x: 200, y: 50, p: 0.4 }
      ]
    });
    commit();
    assert(
      renderFrame(0, 0, false).getContext('2d').getImageData(30, 40, 1, 1).data[3] > 0,
      'native canvas rendered'
    );
    addFrame(true);
    assert(project.frames.length === 2, 'frame duplicate');
    undo();
    assert(project.frames.length === 1, 'undo');
    redo();
    assert(project.frames.length === 2, 'redo');
    const before = renderFrame(0, 0, false).toDataURL();
    setRenderStyle('pixel');
    assert(project.renderStyle === 'pixel', 'pixel style');
    const pix = renderFrame(0, 0, false).getContext('2d').getImageData(0, 0, 256, 192).data;
    for (let y = 0; y < 192; y++)
      for (let x = 0; x < 256; x++) {
        const p = (y * 256 + x) * 4,
          q = ((y - (y % 4)) * 256 + x - (x % 4)) * 4;
        for (let k = 0; k < 4; k++) assert(pix[p + k] === pix[q + k], 'pixel cells are crisp');
      }
    setRenderStyle('smooth');
    assert(renderFrame(0, 0, false).toDataURL() === before, 'smooth image is unchanged');
    for (const t of extraShapes) {
      const op = {
        kind: 'stroke',
        tool: t,
        filled: true,
        color: '#55c4ed',
        size: 3,
        opacity: 1,
        pressure: false,
        animate: false,
        mirror: false,
        seed: 4,
        points: [
          { x: 40, y: 40, p: 0.5 },
          { x: 180, y: 160, p: 0.5 }
        ]
      };
      assert(pathPoints(op, 0).length > 3, 'new shape path');
    }
    const restore = snapshot();
    $('clearAll').click();
    $('confirmAction').click();
    assert(
      project.frames.every((f) => Object.values(f.contents).every((a) => a.length === 0)),
      'clear all'
    );
    undo();
    assert(snapshot() === restore, 'clear all undo');
    const old = snapshot();
    stage('existing studies');
    makeStudy('shading');
    resizeBuffers();
    invalidate();
    assert(
      project.layers.length === 5 && project.layers.filter((l) => l.clipTo).length === 3,
      'shading study'
    );
    assert(
      renderFrame(0, 0, false).toDataURL() !== renderFrame(0, 5, false).toDataURL(),
      'layer sway'
    );
    assert(gifSchedule(3).schedule.length === 72, 'new motion exports when classic amount is zero');
    makeStudy('motion');
    resizeBuffers();
    invalidate();
    assert(validateProject(JSON.parse(snapshot())).format === 'jago-loop-studio', 'project schema');
    const preset = validateLibrary({
      format: 'jago-presets',
      motions: [{ name: 'Sway', motion: motionDefaults('sway') }],
      brushes: []
    });
    assert(preset.motions.length === 1, 'presets');
    stage('selection checks');
    project = fresh(240, 160);
    project.wiggleEnabled = false;
    resizeBuffers();
    currentOps().push({
      kind: 'stroke',
      tool: 'stamp',
      color: '#443355',
      size: 40,
      opacity: 1,
      pressure: false,
      animate: false,
      mirror: true,
      seed: 42,
      brush: { ...stampSettings, tip: 'dither', patternScale: 8 },
      points: [
        { x: 40, y: 60, p: 0.5 },
        { x: 70, y: 100, p: 0.5 }
      ]
    });
    invalidate();
    const mirrored = renderFrame(0, 0, false).getContext('2d').getImageData(0, 0, 240, 160).data;
    for (let y = 0; y < 160; y++)
      for (let x = 0; x < 120; x++)
        assert(
          mirrored[(y * 240 + x) * 4 + 3] === mirrored[(y * 240 + 239 - x) * 4 + 3],
          'mirrored dither'
        );
    selection = {
      points: [
        { x: 10, y: 20 },
        { x: 95, y: 20 },
        { x: 95, y: 140 },
        { x: 10, y: 140 }
      ]
    };
    beginSelectionMove({ clientX: 0, clientY: 0 });
    updateSelectionMove(20, 0);
    finishStroke();
    assert(
      currentOps().length === 2 && currentOps().every((op) => op.kind === 'group'),
      'selection retains live drawing groups'
    );
    assert(selection.previewLive, 'selection resumes live preview');
    clearSelection();
    allOperations(currentOps())
      .filter((op) => op.kind === 'stroke')
      .forEach((op) => {
        op.animate = true;
        op.motion = motionDefaults('sway');
      });
    project.wiggleEnabled = true;
    invalidate();
    assert(
      renderFrame(0, 0, false).toDataURL() !== renderFrame(0, 5, false).toDataURL(),
      'moved selection still animates'
    );
    assert(validateProject(JSON.parse(snapshot())).version === 5, 'live groups save and reload');
    setAppTheme('paper');
    assert(document.documentElement.dataset.theme === 'paper', 'paper theme');
    setAppTheme('plum');
    assert(document.documentElement.dataset.theme === 'plum', 'plum theme');
    setAppTheme('candy');
    assert(document.documentElement.dataset.theme === 'candy', 'candy theme');
    setAppTheme('charcoal');
    stampSettings.rotation = 80;
    resetStampDefaults();
    assert(stampSettings.rotation === 0 && stampSettings.tip === 'dab', 'stamp reset');
    brushSize = 50;
    resetBrushDefaults();
    assert(brushSize === 8 && opacity === 1, 'brush reset');
    project.guideMode = 'arc';
    project.guideSettings = { ...arcDefaults, width: 60 };
    project.gridSettings = { ...gridDefaults, width: 80 };
    assert(validateProject(JSON.parse(snapshot())).gridSettings.width === 80, 'guide round trip');
    selection = {
      points: [
        { x: 0, y: 0 },
        { x: 120, y: 0 },
        { x: 120, y: 150 },
        { x: 0, y: 150 }
      ]
    };
    tool = 'move';
    const cbox = canvas.getBoundingClientRect();
    beginSelectionHandle({ clientX: cbox.left + 120 * zoom, clientY: cbox.top + 150 * zoom }, 2);
    updateSelectionHandle({
      clientX: cbox.left + 150 * zoom,
      clientY: cbox.top + 180 * zoom,
      shiftKey: true
    });
    finishStroke();
    assert(selection.previewLive, 'handles keep live selection');
    clearSelection();
    duplicateActiveLayer();
    assert(project.layers.length === 2, 'layer duplication');
    {
      project = fresh(720, 240);
      resizeBuffers();
      currentOps().push({
        kind: 'stroke',
        tool: 'pen',
        size: 2,
        color: '#442255',
        opacity: 0.5,
        pressure: false,
        animate: false,
        mirror: false,
        seed: 42,
        points: [
          { x: 60, y: 120, p: 0.5 },
          { x: 660, y: 120, p: 0.5 }
        ]
      });
      for (const type of ['classic', 'ripple', 'flutter'])
        for (const step of [0, 5, 9]) {
          activeLayer().motion = { ...motionDefaults(type), amount: 24, wavelength: 150 };
          invalidate();
          const pixels = renderFrame(0, step, false)
            .getContext('2d')
            .getImageData(0, 0, 720, 240).data;
          let prior = null;
          for (let x = 110; x < 610; x++) {
            let min = 240,
              max = -1;
            for (let y = 0; y < 240; y++)
              if (pixels[(y * 720 + x) * 4 + 3] > 20) {
                min = Math.min(min, y);
                max = y;
              }
            assert(max >= 0, type + ' layer has no empty columns');
            if (prior)
              assert(
                min <= prior.max + 1 && max >= prior.min - 1,
                type + ' layer lines stay connected'
              );
            prior = { min, max };
          }
        }
      project = fresh(160, 144);
      resizeBuffers();
      addFrame(true);
      addFrame(true);
      project.frames.forEach((f, i) => (f.hold = i + 1));
      resetHistory();
      $('frameHold').value = 5;
      $('allFrameTiming').click();
      assert(
        project.frames.every((f) => f.hold === 5),
        'timing applies to every frame'
      );
      undo();
      assert(project.frames.map((f) => f.hold).join(',') === '1,2,3', 'all-frame timing undo');
    }
    {
      stage('new controls');
      for (const id of [
        'brushSampler',
        'shapeSampler',
        'lineExamples',
        'placePivot',
        'sprayShape',
        'vanishX'
      ])
        assert($(id), 'new control ' + id);
      assert(
        Array.from($('appTheme').options)
          .map((o) => o.textContent)
          .join('|') === 'Sketchbook|Charcoal|Warm Paper|Midnight Plum|Candy Cloud',
        'consistent theme names'
      );
      for (const tip of patternTips) {
        stampSettings = { ...stampDefaults, tip };
        syncBrushUI();
        assert(
          !$('patternModeField').classList.contains('hidden'),
          'pattern layout available ' + tip
        );
        $('stampPatternMode').value = 'stamps';
        $('stampPatternMode').dispatchEvent(new Event('change'));
        assert(
          stampSettings.patternMode === 'stamps' && !$('stampPatternScale').disabled,
          'individual pattern sizing ' + tip
        );
      }
      setTool('spray');
      assert(!$('sprayControls').classList.contains('hidden'), 'spray panel');
      $('sprayGrain').click();
      assert(spraySettings.dotSize === 5, 'spray preset');
      $('resetSpray').click();
      assert(spraySettings.dotSize === 2, 'spray reset');
      stage('pixel canvas');
      $('canvasSize').value = '64,64';
      $('canvasSize').dispatchEvent(new Event('change'));
      assert($('newStyle').value === 'nativePixel', 'small canvas chooses real pixels');
      $('createProject').click();
      assert(
        project.width === 64 &&
          project.canvasMode === 'pixel' &&
          project.pixelSize === 1 &&
          brushSize === 1 &&
          !animateStroke,
        'native pixel canvas defaults'
      );
      currentOps().push({
        kind: 'stroke',
        tool: 'pen',
        color: '#ef6461',
        size: 1,
        opacity: 1,
        pressure: false,
        animate: false,
        mirror: false,
        seed: 3,
        points: [
          { x: 8.5, y: 8.5, p: 0.5 },
          { x: 48.5, y: 32.5, p: 0.5 }
        ]
      });
      invalidate();
      const raster = exportCanvas(0, 0, 256, 256, true, 'smooth')
        .getContext('2d')
        .getImageData(0, 0, 256, 256).data;
      let pixels = 0;
      for (let i = 3; i < raster.length; i += 4) {
        assert(raster[i] === 0 || raster[i] === 255, 'native pixels export without smoothing');
        if (raster[i]) pixels++;
      }
      assert(pixels > 0, 'pixel export has artwork');
      stage('pivot');
      makeStudy('motion');
      resizeBuffers();
      invalidate();
      updateUI();
      fit();
      showPanel('motion');
      assert(
        activeLayer().name === 'Pendulum' && motionDraft.type === 'sway',
        'motion study opens pendulum settings'
      );
      const stored = activeLayer().motion.anchorY;
      movePivotTo({ x: 300, y: 150 });
      assert(
        Math.abs(pivotGeometry().y - 150) < 0.001 &&
          activeLayer().motion.anchorY === stored &&
          motionPreview,
        'pivot previews before applying'
      );
      applyMotionToLayer();
      assert(activeLayer().motion.anchorY === motionDraft.anchorY, 'pivot applies to layer');
      for (const mode of ['thirds', 'centre', 'isometric', 'perspective', 'pixels']) {
        project.guideMode = guides = mode;
        syncGridUI();
        paintCanvas();
        assert(validateProject(JSON.parse(snapshot())).guideMode === mode, 'new guide ' + mode);
      }
      stage('embedded examples');
      const storedProject = snapshot();
      project = validateProject(copy(exampleProjects.brush));
      resizeBuffers();
      invalidate();
      assert(currentOps().length === 12, 'embedded brush sampler');
      project = validateProject(copy(exampleProjects.shape));
      resizeBuffers();
      invalidate();
      assert(currentOps().length > 0, 'embedded shape sampler');
      makeLineStudy();
      resizeBuffers();
      invalidate();
      assert(
        project.layers.length === 4 &&
          renderFrame(0, 0, false).toDataURL() !== renderFrame(0, 3, false).toDataURL(),
        'line study animates'
      );
    }

    stage('chalk and hint');
    stampSettings = { ...stampDefaults, tip: 'chalk' };
    syncBrushUI();
    assert(!$('patternModeField').classList.contains('hidden'), 'chalk layouts visible');
    $('stampPatternAngle').value = 32;
    $('stampPatternAngle').dispatchEvent(new Event('input'));
    assert(stampSettings.patternAngle === 32, 'pattern angle input');
    assert(validateBrush(stampSettings).patternAngle === 32, 'pattern angle round trip');
    project = fresh(64, 64);
    project.canvasMode = 'pixel';
    project.renderStyle = 'pixel';
    project.pixelSize = 1;
    resizeBuffers();
    updateUI();
    zoom = 1.35;
    applyView();
    assert(
      getComputedStyle($('emptyHint')).visibility === 'hidden',
      'hint hidden when canvas is tiny'
    );
    zoom = 8;
    applyView();
    const hintHeight = $('emptyHintTitle').getBoundingClientRect().height;
    assert(hintHeight > 10 && hintHeight < 30, 'compact readable hint');
    const hintRect = $('emptyHint').getBoundingClientRect(),
      canvasRect = canvas.getBoundingClientRect();
    assert(
      Math.abs(hintRect.left + hintRect.width / 2 - (canvasRect.left + canvasRect.width / 2)) < 1,
      'hint stays centred'
    );
    zoom = 16;
    applyView();
    assert(
      Math.abs($('emptyHintTitle').getBoundingClientRect().height - hintHeight) < 1,
      'hint does not grow with zoom'
    );
    stage('native exports');
    project = validateProject(JSON.parse(old));
    resizeBuffers();
    invalidate();
    fit();
    project.name = 'Windows app self-test';
    setRenderStyle('pixel');
    saveLocal();
    return {
      ok: true,
      canvas: [canvas.width, canvas.height],
      frames: project.frames.length,
      tools: document.querySelectorAll('[data-tool]').length,
      origin: location.origin
    };
  } catch (error) {
    return { error: String(error), stack: error.stack };
  }
})();
