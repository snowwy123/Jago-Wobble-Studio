setAppTheme('sketchbook');
window.presetTestResult = 'running';
(async () => {
  const assert = (condition, message) => {
    if (!condition) throw Error(message);
  };
  const previous = snapshot(),
    previousLibrary = copy(studioLibrary);
  project = fresh(480, 320);
  resizeBuffers();
  resetHistory();
  updateUI();
  fit();
  const image = makeCanvas(128, 128);
  image.getContext('2d').fillRect(30, 30, 68, 68);
  const src = image.toDataURL('image/png');
  const library = {
    format: 'jago-presets',
    version: 1,
    brushes: [
      {
        name: 'Pocket Test',
        brush: { ...stampDefaults, tip: 'tipnative' },
        size: 34,
        opacity: 0.8,
        colour: '#805c73',
        tip: { name: 'Pocket Test', src }
      }
    ],
    motions: [{ name: 'Paper Breeze', motion: { ...motionDefaults('flutter'), amount: 7 } }]
  };
  studioLibrary = { brushes: [], motions: [] };
  await importPresetLibrary({
    target: {
      files: [{ size: JSON.stringify(library).length, text: async () => JSON.stringify(library) }],
      value: ''
    }
  });
  assert(
    $('savedBrush').querySelector('optgroup[label="Imported presets"]').children.length === 1,
    'imported brush group'
  );
  assert(
    $('savedMotion').querySelector('optgroup[label="Default settings"]').children.length === 8,
    'starter motion group'
  );
  assert(
    Object.keys(project.brushTips || {}).length === 0,
    'import does not fill drawing with images'
  );
  for (let i = 0; i < 4; i++) await useSavedPreset('brushes', 0);
  assert(Object.keys(project.brushTips || {}).length === 1, 'repeated brush use has one image');
  assert($('savedBrushStatus').textContent === 'Pocket Test', 'brush name visible');
  assert($('size').max === '160', '160 px slider maximum');
  for (const id of ['saveStampAs', 'resetStamp', 'openBrushLibrary', 'brushPackHelp'])
    assert($('stampPresetActions').contains($(id)), 'footer action ' + id);
  function previewInkSize() {
    const c = $('brushPreviewCanvas'),
      d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width,
      x1 = -1,
      y0 = c.height,
      y1 = -1;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++) {
        const k = (y * c.width + x) * 4;
        if (d[k + 3] > 20 && Math.min(d[k], d[k + 1], d[k + 2]) < 210) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
      }
    return Math.max(x1 - x0 + 1, y1 - y0 + 1);
  }
  const rememberedBrush = copy(stampSettings),
    rememberedSize = brushSize;
  stampSettings = {
    ...stampSettings,
    mode: 'single',
    variation: 0,
    scatter: 0,
    follow: false,
    rotation: 0
  };
  const previewSizes = [];
  for (const n of [80, 120, 160]) {
    $('size').value = n;
    $('size').dispatchEvent(new Event('input'));
    assert(brushSize === n, 'slider input ' + n);
    previewSizes.push(previewInkSize());
  }
  assert(
    previewSizes[1] > previewSizes[0] * 1.3 && previewSizes[2] > previewSizes[1] * 1.2,
    'preview grows up to 160 px'
  );
  stampSettings = rememberedBrush;
  brushSize = rememberedSize;
  syncBrushUI();

  assert(
    $('stampBasicSlot').contains($('size')) && $('stampBasicSlot').contains($('color')),
    'shared controls moved into stamp panel'
  );
  assert(
    $('regularBrushPanel').classList.contains('hidden') &&
      !$('stampBrushPanel').classList.contains('hidden'),
    'only stamp panel visible'
  );
  assert(
    $('stampVariationSettings').closest('details').id === 'stampDetails',
    'variation outside hidden subsections'
  );
  const savedSize = brushSize,
    savedOpacity = opacity,
    savedSmoothing = smoothing;
  setTool('pen');
  assert(
    $('regularBasicSlot').contains($('size')) && $('regularSmoothingSlot').contains($('smoothing')),
    'regular controls restored'
  );
  assert($('stampBrushPanel').classList.contains('hidden'), 'stamp-only settings hidden for pen');
  setTool('stamp');
  assert(
    brushSize === savedSize && opacity === savedOpacity && smoothing === savedSmoothing,
    'switching tools keeps values'
  );
  for (const id of ['size', 'opacity', 'smoothing', 'pressure', 'color'])
    assert(document.querySelectorAll('[id=' + id + ']').length === 1, 'one shared control ' + id);
  assert(!$('editStampBrush').open, 'image selector tucked away');
  $('editStampBrush').open = true;
  assert($('stampTip').getClientRects().length > 0, 'image selector available in Edit brush');
  $('editStampBrush').open = false;
  $('size').value = '40';
  $('size').dispatchEvent(new Event('input'));
  assert($('savedBrushStatus').textContent.includes('modified'), 'brush changes labelled');
  assert(
    $('savedBrush').selectedOptions[0].textContent.includes('modified'),
    'modified name in dropdown'
  );
  $('saveStampAs').click();
  assert($('saveStampAsDialog').open, 'direct save dialog');
  $('saveStampAsName').value = 'My Pocket Test';
  $('confirmSaveStampAs').click();
  assert(!$('saveStampAsDialog').open, 'direct save completes');
  assert($('savedBrush').querySelector('optgroup[label="Your saved presets"]'), 'saved group');
  assert($('savedBrushStatus').textContent === 'My Pocket Test', 'saved name visible');
  await useSavedPreset('motions', 0);
  assert(
    $('motionType').value === 'flutter' &&
      $('savedMotion').selectedOptions[0].textContent === 'Paper Breeze · Flutter',
    'motion type and name'
  );
  $('mAmount').value = '9';
  $('mAmount').dispatchEvent(new Event('input'));
  assert(
    $('savedMotionStatus').textContent.includes('Paper Breeze (modified)'),
    'modified motion name'
  );
  const count = Object.keys(project.brushTips || {}).length;
  showLibrary();
  $('selectImportedPresets').click();
  $('deleteSelectedPresets').click();
  assert(
    studioLibrary.brushes.length === 1 && studioLibrary.motions.length === 0,
    'bulk removal keeps personal preset'
  );
  assert(Object.keys(project.brushTips || {}).length === count, 'deletion leaves images alone');
  $('undoPresetRemoval').click();
  assert(studioLibrary.brushes.length === 2 && studioLibrary.motions.length === 1, 'undo deletion');
  $('libraryDialog').close();
  await importPresetLibrary({
    target: {
      files: [{ size: JSON.stringify(library).length, text: async () => JSON.stringify(library) }],
      value: ''
    }
  });
  assert(
    studioLibrary.brushes.length === 2 && studioLibrary.motions.length === 1,
    'duplicate pack skipped'
  );
  await useSavedPreset('motions', 0);
  showPanel('motion');
  for (const id of ['savedMotion', 'savedMotionStatus', 'motionType']) {
    const b = $(id).getBoundingClientRect();
    assert(
      b.width > 100 && b.height > 10 && b.right <= innerWidth + 1,
      'visible motion control ' + id
    );
  }
  window.presetTestPrevious = previous;
  window.presetTestLibrary = previousLibrary;
  window.presetTestResult = 'PASS';
})().catch((e) => {
  window.presetTestResult = 'FAIL: ' + e.message;
});
