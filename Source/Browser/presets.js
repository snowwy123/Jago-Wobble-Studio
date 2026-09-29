// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Cameron Jago Lis Illustrates.
'use strict';

let selectedBrushPreset = null,
  selectedMotionPreset = null,
  presetRequest = 0;
let librarySelection = new Set(),
  lastPresetRemoval = null;
const currentPresetOptions = {};
const starterPresetLibrary = {
  brushes: builtinTips.map((tip) => ({
    name: tipNames[tip],
    brush: { ...stampDefaults, tip },
    size: 40,
    opacity: 1,
    colour: '#252338'
  })),
  motions: Object.keys(motionDescriptions).map((type) => ({
    name: {
      classic: 'Classic line boil',
      sway: 'Sway',
      ripple: 'Ripple',
      flutter: 'Flutter',
      breathe: 'Breathe',
      spring: 'Spring',
      drift: 'Drift',
      crawl: 'Texture crawl'
    }[type],
    motion: motionDefaults(type)
  }))
};

function presetChoiceValue(kind, preset) {
  if (kind === 'brushes' && preset.projectTip && project.brushTips?.[preset.projectTip])
    return 'project:' + preset.projectTip;
  const index = studioLibrary[kind].indexOf(preset);
  if (index >= 0) return String(index);
  const starter = starterPresetLibrary[kind].indexOf(preset);
  return starter >= 0 ? 'starter:' + starter : '';
}

function motionTypeLabel(type) {
  return starterPresetLibrary.motions.find((p) => p.motion.type === type)?.name || type;
}

function presetDisplayName(kind, preset) {
  return kind === 'motions'
    ? preset.name + ' · ' + motionTypeLabel(preset.motion.type)
    : preset.name;
}

function currentBrushName() {
  return project.brushTips?.[stampSettings.tip]?.name || tipNames[stampSettings.tip] || 'Brush';
}
const stampSourceAliases = new WeakMap();
const stablePresetJSON = (value) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v
  );

function brushPresetState() {
  return stablePresetJSON({ brush: stampSettings, size: brushSize, opacity, colour });
}

function motionPresetState() {
  return stablePresetJSON(motionDraft);
}

function motionPresetContext() {
  return motionScope === 'layer' ? 'layer:' + project.activeLayer : 'new';
}

function syncSavedPresetStatus() {
  if (!uiReady) return;
  const b = selectedBrushPreset,
    m = selectedMotionPreset;
  if (b && (b.project !== project || b.tip !== stampSettings.tip)) selectedBrushPreset = null;
  if (m && (m.project !== project || m.context !== motionPresetContext()))
    selectedMotionPreset = null;
  for (const [kind, id, status, selected, state] of [
    ['brushes', 'savedBrush', 'savedBrushStatus', selectedBrushPreset, brushPresetState()],
    ['motions', 'savedMotion', 'savedMotionStatus', selectedMotionPreset, motionPresetState()]
  ]) {
    const value = selected ? presetChoiceValue(kind, selected.preset) : '';
    const changed = !!selected && selected.state !== state;
    if (currentPresetOptions[kind])
      currentPresetOptions[kind].textContent = changed
        ? kind === 'motions'
          ? selected.preset.name + ' (modified) · ' + motionTypeLabel(motionDraft.type)
          : selected.preset.name + ' (modified)'
        : kind === 'brushes'
          ? currentBrushName() + ' (current settings)'
          : 'Choose saved settings (optional)';
    $(id).value = changed ? '' : value;
    if (selected) {
      $(status).textContent =
        selected.preset.name +
        (changed ? ' (modified)' : '') +
        (!value ? ' · removed from library' : '') +
        (kind === 'motions'
          ? ' · Saved ' +
            motionTypeLabel(motionDraft.type) +
            ' settings. ' +
            (motionScope === 'new'
              ? 'For new marks. Use Apply below for existing artwork.'
              : "Editing this layer's setup. Use Apply below to keep it.")
          : selected.preset.projectTip
            ? ' · Image with your current brush settings.'
            : '');
    } else
      $(status).textContent =
        kind === 'brushes'
          ? 'Choose any brush above. Adjust its settings below; Edit brush lets you change its image.'
          : 'Optional: choose saved settings above, or start with a Wiggle type below.';
  }
}

function refreshSavedPresetChoices() {
  if (!uiReady) return;
  for (const [kind, id] of [
    ['brushes', 'savedBrush'],
    ['motions', 'savedMotion']
  ]) {
    const list = $(id);
    list.replaceChildren();
    const current = document.createElement('optgroup');
    current.label = 'Current setup';
    const own = document.createElement('option');
    own.value = '';
    own.textContent = 'Your current setup';
    current.append(own);
    list.append(current);
    currentPresetOptions[kind] = own;
    const groups = [
      [
        kind === 'brushes' ? 'Default brushes' : 'Default settings',
        starterPresetLibrary[kind].map((preset, index) => ({ preset, value: 'starter:' + index }))
      ],
      [
        'Imported presets',
        studioLibrary[kind]
          .map((preset, index) => ({ preset, value: String(index) }))
          .filter((x) => x.preset.origin === 'imported')
      ],
      [
        'Your saved presets',
        studioLibrary[kind]
          .map((preset, index) => ({ preset, value: String(index) }))
          .filter((x) => x.preset.origin === 'saved')
      ],
      [
        'Earlier presets',
        studioLibrary[kind]
          .map((preset, index) => ({ preset, value: String(index) }))
          .filter((x) => !x.preset.origin)
      ]
    ];
    if (kind === 'brushes') {
      const aliases = stampSourceAliases.get(project);
      const images = Object.entries(project.brushTips || {}).filter(
        ([id, tip]) =>
          !studioLibrary.brushes.some(
            (p) => p.tip && (p.tip.src === tip.src || aliases?.get(p.tip.src)?.id === id)
          )
      );
      groups.push([
        'In this drawing',
        images.map(([id, tip]) => ({ preset: { name: tip.name }, value: 'project:' + id }))
      ]);
    }
    for (const [label, items] of groups) {
      if (!items.length) continue;
      const group = document.createElement('optgroup');
      group.label = label;
      for (const { preset, value } of items) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent =
          String(value).startsWith('starter:') && kind === 'motions'
            ? preset.name + ' · Default settings'
            : presetDisplayName(kind, preset);
        group.append(option);
      }
      list.append(group);
    }
  }
  syncSavedPresetStatus();
}

// Reuse the same image even if PNG encoders produce different data URLs.
// The alias cache belongs to one project and is never saved in a drawing.

async function ensureProjectStamp(src, name, owner) {
  const check = () => {
    if (project !== owner) throw Error('The drawing changed. Choose the brush again.');
  };
  check();
  owner.brushTips = owner.brushTips || {};
  let aliases = stampSourceAliases.get(owner);
  if (!aliases) {
    aliases = new Map();
    stampSourceAliases.set(owner, aliases);
  }
  const remembered = aliases.get(src);
  if (remembered && owner.brushTips[remembered.id]?.src === remembered.png) {
    await cacheImage(remembered.png);
    check();
    return remembered.id;
  }
  const existing = Object.entries(owner.brushTips).find(([, tip]) => tip.src === src);
  if (existing) {
    await cacheImage(src);
    check();
    return existing[0];
  }
  const im = await cacheImage(src);
  check();
  if (im.width > 4096 || im.height > 4096)
    throw Error('Stamp images must be at most 4096 pixels per side.');
  const c = makeCanvas(128, 128),
    cx = c.getContext('2d'),
    s = Math.min(128 / im.width, 128 / im.height);
  cx.drawImage(
    im,
    (128 - im.width * s) / 2,
    (128 - im.height * s) / 2,
    im.width * s,
    im.height * s
  );
  const pixels = cx.getImageData(0, 0, 128, 128).data;
  if (!pixels.some((v, i) => i % 4 === 3 && v > 0))
    throw Error('This stamp image is completely transparent.');
  const png = c.toDataURL('image/png');
  await cacheImage(png);
  check();
  // Check again after awaits so concurrent choices cannot add duplicate images.
  let match = Object.entries(owner.brushTips).find(([, tip]) => tip.src === src || tip.src === png);
  if (!match) {
    for (const [id, tip] of Object.entries(owner.brushTips)) {
      const other = await cacheImage(tip.src);
      check();
      if (other.width !== 128 || other.height !== 128) continue;
      const out = makeCanvas(128, 128);
      out.getContext('2d').drawImage(other, 0, 0);
      const data = out.getContext('2d').getImageData(0, 0, 128, 128).data;
      if (data.every((value, i) => value === pixels[i])) {
        match = [id, tip];
        break;
      }
    }
  }
  check();
  // Another request may have completed during pixel comparison.
  match =
    match || Object.entries(owner.brushTips).find(([, tip]) => tip.src === png || tip.src === src);
  if (!match) {
    if (Object.keys(owner.brushTips).length >= 24)
      throw Error(
        'This drawing has 24 different custom stamp images. You can still use its existing stamps. Save it and start a new drawing to use another image.'
      );
    const id = 'tip' + uid();
    owner.brushTips[id] = { name: name.slice(0, 50), src: png };
    match = [id, owner.brushTips[id]];
  }
  aliases.set(src, { id: match[0], png: match[1].src });
  return match[0];
}

async function useSavedPreset(kind, index) {
  const starter = String(index).startsWith('starter:'),
    projectTip =
      kind === 'brushes' && String(index).startsWith('project:') ? String(index).slice(8) : null;
  const image = projectTip && project.brushTips?.[projectTip];
  const preset = image
    ? {
        name: image.name,
        projectTip,
        brush: { ...stampSettings, tip: projectTip },
        size: brushSize,
        opacity,
        colour
      }
    : starter
      ? starterPresetLibrary[kind]?.[Number(String(index).slice(8))]
      : studioLibrary[kind]?.[index];
  if (!preset) return false;
  const request = ++presetRequest,
    owner = project;
  try {
    if (kind === 'motions') {
      motionDraft = validateMotion(preset.motion);
      motionScope = 'new';
      motionPreview = false;
      selectedMotionPreset = { preset, project: owner, context: 'new', state: motionPresetState() };
      if (motionDraft.type === 'classic') {
        project.wiggle = motionDraft.amount;
        $('wiggle').value = project.wiggle;
        $('wiggleValue').textContent = project.wiggle + ' px';
      }
      syncMotionUI();
      showPanel('motion');
      invalidate();
      if (motionDraft.type === 'classic') commit();
    } else {
      const b = validateBrush(preset.brush),
        before = Object.keys(owner.brushTips || {}).length;
      if (preset.tip) b.tip = await ensureProjectStamp(preset.tip.src, preset.tip.name, owner);
      if (request !== presetRequest || project !== owner) return false;
      stampSettings = b;
      brushSize = preset.size;
      opacity = preset.opacity;
      if (!starter) setColour(preset.colour);
      setTool('stamp');
      selectedBrushPreset = { preset, project: owner, tip: b.tip, state: brushPresetState() };
      showPanel('draw');
      $('stampDetails').open = true;
      syncBrushUI();
      if (Object.keys(owner.brushTips || {}).length !== before) commit();
    }
    syncSavedPresetStatus();
    toast('Using ' + preset.name);
    return true;
  } catch (e) {
    if (request === presetRequest) {
      syncSavedPresetStatus();
      toast(e.message);
    }
    return false;
  }
}

function presetIdentity(kind, preset) {
  if (kind === 'motions')
    return stablePresetJSON({ name: preset.name, motion: validateMotion(preset.motion) });
  const brush = validateBrush(preset.brush);
  if (preset.tip) brush.tip = 'custom';
  return stablePresetJSON({
    name: preset.name,
    brush,
    size: preset.size,
    opacity: preset.opacity,
    colour: preset.colour.toLowerCase(),
    tip: preset.tip ? { src: preset.tip.src } : null
  });
}

async function importPresetLibrary(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    if (file.size > 4e6) throw Error('Preset files must be under 4 MB');
    const incoming = validateLibrary(JSON.parse(await file.text())),
      additions = { brushes: [], motions: [] },
      identified = [];
    let skipped = 0;
    for (const kind of ['brushes', 'motions']) {
      const seen = new Set(studioLibrary[kind].map((p) => presetIdentity(kind, p)));
      for (const preset of incoming[kind]) {
        const key = presetIdentity(kind, preset);
        if (seen.has(key)) {
          skipped++;
          const prior = studioLibrary[kind].find(
            (p) => !p.origin && presetIdentity(kind, p) === key
          );
          if (prior) identified.push(prior);
          continue;
        }
        seen.add(key);
        additions[kind].push({ ...preset, origin: 'imported' });
      }
      if (studioLibrary[kind].length + additions[kind].length > 30)
        throw Error(
          'This pack would exceed 30 ' +
            (kind === 'brushes' ? 'stamp' : 'motion') +
            ' presets. Export a backup and remove some presets first. Nothing was imported.'
        );
    }
    identified.forEach((p) => (p.origin = 'imported'));
    studioLibrary.brushes.push(...additions.brushes);
    studioLibrary.motions.push(...additions.motions);
    saveLibrary();
    renderLibrary();
    toast(
      additions.brushes.length +
        ' brushes and ' +
        additions.motions.length +
        ' motions ready in the Draw and Motion panels.' +
        (skipped ? ' ' + skipped + ' already in your library.' : '')
    );
  } catch (e) {
    toast(e.message);
  }
}

const presetSyncMotion = syncMotionUI;
syncMotionUI = function () {
  presetSyncMotion();
  syncSavedPresetStatus();
};
const presetPaintBrush = paintBrushPreview;
paintBrushPreview = function () {
  presetPaintBrush();
  syncSavedPresetStatus();
};
let brushChoiceProject = null,
  brushChoiceImages = '';
const pickerSyncBrush = syncBrushUI;
syncBrushUI = function () {
  pickerSyncBrush();
  const images = JSON.stringify(
    Object.entries(project.brushTips || {}).map(([id, tip]) => [id, tip.name])
  );
  if (brushChoiceProject !== project || brushChoiceImages !== images) {
    brushChoiceProject = project;
    brushChoiceImages = images;
    refreshSavedPresetChoices();
  }
};
const presetSaveLibrary = saveLibrary;
saveLibrary = function () {
  presetSaveLibrary();
  refreshSavedPresetChoices();
};
const presetInitialise = initialiseStudio;
initialiseStudio = function () {
  presetInitialise();
  for (const [id, kind] of [
    ['savedBrush', 'brushes'],
    ['savedMotion', 'motions']
  ])
    $(id).onchange = async (e) => {
      if (e.target.value === '') {
        if (kind === 'brushes') selectedBrushPreset = null;
        else selectedMotionPreset = null;
        syncSavedPresetStatus();
        return;
      }
      await useSavedPreset(kind, e.target.value);
    };
  // Keep the name's modified state up to date without rebuilding the controls.
  for (const id of [...Object.keys(motionFields), 'wiggle', 'boil']) {
    const original = $(id).oninput;
    if (original)
      $(id).oninput = (e) => {
        original(e);
        syncSavedPresetStatus();
      };
  }
  for (const id of ['mPin', 'mDirection', 'mPath']) {
    const original = $(id).onchange;
    $(id).onchange = (e) => {
      original(e);
      syncSavedPresetStatus();
    };
  }
  for (const [id, kind] of [
    ['saveBrushPreset', 'brushes'],
    ['saveMotionPreset', 'motions']
  ]) {
    const original = $(id).onclick;
    $(id).onclick = () => {
      const count = studioLibrary[kind].length;
      original();
      if (studioLibrary[kind].length === count) return;
      const preset = studioLibrary[kind].at(-1);
      if (kind === 'brushes')
        selectedBrushPreset = {
          preset,
          project,
          tip: stampSettings.tip,
          state: brushPresetState()
        };
      else
        selectedMotionPreset = {
          preset,
          project,
          context: motionPresetContext(),
          state: motionPresetState()
        };
      syncSavedPresetStatus();
    };
  }
  $('selectImportedPresets').onclick = () => {
    librarySelection = new Set(
      [...studioLibrary.brushes, ...studioLibrary.motions].filter((p) => p.origin === 'imported')
    );
    renderLibrary();
  };
  $('clearPresetSelection').onclick = () => {
    librarySelection.clear();
    renderLibrary();
  };
  $('deleteSelectedPresets').onclick = () => deleteLibraryPresets(librarySelection);
  $('undoPresetRemoval').onclick = () => {
    if (!lastPresetRemoval) return;
    for (const kind of ['brushes', 'motions'])
      if (studioLibrary[kind].length + lastPresetRemoval[kind].length > 30) {
        toast('Make room in the library before restoring these presets.');
        return;
      }
    for (const kind of ['brushes', 'motions'])
      for (const { preset, index } of lastPresetRemoval[kind])
        studioLibrary[kind].splice(Math.min(index, studioLibrary[kind].length), 0, preset);
    lastPresetRemoval = null;
    saveLibrary();
    renderLibrary();
    toast('Presets restored');
  };
  refreshSavedPresetChoices();
};

function deleteLibraryPresets(presets) {
  const removed = { brushes: [], motions: [] };
  for (const kind of ['brushes', 'motions']) {
    studioLibrary[kind].forEach((preset, index) => {
      if (presets.has(preset)) removed[kind].push({ preset, index });
    });
    studioLibrary[kind] = studioLibrary[kind].filter((p) => !presets.has(p));
  }
  const count = removed.brushes.length + removed.motions.length;
  if (!count) return;
  lastPresetRemoval = removed;
  librarySelection.clear();
  saveLibrary();
  renderLibrary();
  toast(count + ' presets removed. Existing artwork is unchanged. Undo removal is available here.');
}
