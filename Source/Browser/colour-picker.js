// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Cameron Jago Lis Illustrates.
// One picker for the browser and Windows app, independent of the OS colour dialog.

let colourTarget = null;
let pickerHSV = { h: 0, s: 0, v: 0 };
let colourDrag = null;
let applyingColour = false;
let colourChanged = false;

function hexToHSV(hex) {
  const rgb = hex
    .slice(1)
    .match(/../g)
    .map((n) => parseInt(n, 16) / 255);
  const [r, g, b] = rgb,
    max = Math.max(...rgb),
    min = Math.min(...rgb),
    delta = max - min;
  let h = 0;
  if (delta) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
  }
  return { h: (h * 60 + 360) % 360, s: max ? delta / max : 0, v: max };
}

function hsvToHex({ h, s, v }) {
  const channel = (n) => {
    const k = (n + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return '#' + channel(5) + channel(3) + channel(1);
}

function paintColourWheel() {
  const c = $('colourWheel').getContext('2d');
  c.clearRect(0, 0, 256, 256);
  c.lineWidth = 20;
  for (let h = 0; h < 360; h++) {
    c.strokeStyle = `hsl(${h} 100% 50%)`;
    c.beginPath();
    c.arc(128, 128, 112, ((h - 0.5) * Math.PI) / 180, ((h + 1) * Math.PI) / 180);
    c.stroke();
  }
  c.fillStyle = `hsl(${pickerHSV.h} 100% 50%)`;
  c.fillRect(60, 60, 136, 136);
  const white = c.createLinearGradient(60, 0, 196, 0);
  white.addColorStop(0, '#fff');
  white.addColorStop(1, '#fff0');
  c.fillStyle = white;
  c.fillRect(60, 60, 136, 136);
  const black = c.createLinearGradient(0, 60, 0, 196);
  black.addColorStop(0, '#0000');
  black.addColorStop(1, '#000');
  c.fillStyle = black;
  c.fillRect(60, 60, 136, 136);
  const angle = (pickerHSV.h * Math.PI) / 180;
  for (const [x, y] of [
    [128 + Math.cos(angle) * 112, 128 + Math.sin(angle) * 112],
    [60 + pickerHSV.s * 136, 60 + (1 - pickerHSV.v) * 136]
  ]) {
    c.beginPath();
    c.arc(x, y, 5, 0, Math.PI * 2);
    c.strokeStyle = '#111';
    c.lineWidth = 4;
    c.stroke();
    c.strokeStyle = '#fff';
    c.lineWidth = 2;
    c.stroke();
  }
}

function syncColourPicker() {
  const hex = hsvToHex(pickerHSV);
  $('colourHex').value = hex;
  $('colourNew').style.backgroundColor = hex;
  ['colourR', 'colourG', 'colourB'].forEach((id, i) => {
    $(id).value = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  });
  $('colourHue').value = Math.round(pickerHSV.h);
  $('colourSaturation').value = Math.round(pickerHSV.s * 100);
  $('colourBrightness').value = Math.round(pickerHSV.v * 100);
  $('colourHueValue').textContent = Math.round(pickerHSV.h) + '°';
  $('colourSaturationValue').textContent = Math.round(pickerHSV.s * 100) + '%';
  $('colourBrightnessValue').textContent = Math.round(pickerHSV.v * 100) + '%';
  $('colourPickerError').textContent = '';
  paintColourWheel();
}

function openColourPicker(input) {
  if (exporting) return;
  finishColourChange();
  colourTarget = input;
  pickerHSV = hexToHSV(input.value);
  const names = {
    paperColor: 'Paper colour',
    shadeBase: 'Base colour',
    shadeShadow: 'Shadow colour',
    shadeLight: 'Light colour'
  };
  $('colourPickerTitle').textContent = names[input.id] || 'Ink colour';
  syncColourPicker();
  positionColourPicker();
  if (!$('colourDialog').open) $('colourDialog').show();
}

function positionColourPicker() {
  const view = $('viewport').getBoundingClientRect();
  const panel = $('colourDialog');
  panel.style.setProperty('--picker-left', Math.max(8, view.left + 12) + 'px');
  panel.style.setProperty('--picker-bottom', Math.max(8, innerHeight - view.bottom + 8) + 'px');
  panel.style.setProperty('--picker-height', Math.max(180, view.bottom - 92) + 'px');
}
window.addEventListener('resize', positionColourPicker);

function moveColourPointer(e) {
  if (!colourDrag || colourDrag.id !== e.pointerId) return;
  const box = $('colourWheel').getBoundingClientRect();
  const x = ((e.clientX - box.left) * 256) / box.width;
  const y = ((e.clientY - box.top) * 256) / box.height;
  if (colourDrag.part === 'hue') {
    pickerHSV.h = ((Math.atan2(y - 128, x - 128) * 180) / Math.PI + 360) % 360;
  } else {
    pickerHSV.s = clamp((x - 60) / 136, 0, 1);
    pickerHSV.v = 1 - clamp((y - 60) / 136, 0, 1);
  }
  syncColourPicker();
  applyPickedColour();
}

$('colourWheel').onpointerdown = (e) => {
  if (e.button !== 0) return;
  const box = e.currentTarget.getBoundingClientRect();
  const x = ((e.clientX - box.left) * 256) / box.width;
  const y = ((e.clientY - box.top) * 256) / box.height;
  const inSquare = x >= 60 && x <= 196 && y >= 60 && y <= 196;
  const radius = Math.hypot(x - 128, y - 128);
  if (!inSquare && (radius < 100 || radius > 126)) return;
  e.preventDefault();
  e.currentTarget.setPointerCapture(e.pointerId);
  colourDrag = { id: e.pointerId, part: inSquare ? 'shade' : 'hue' };
  moveColourPointer(e);
};
$('colourWheel').onpointermove = moveColourPointer;
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  $('colourWheel').addEventListener(event, () => {
    colourDrag = null;
    finishColourChange();
  });
}
for (const [id, key, scale] of [
  ['colourHue', 'h', 1],
  ['colourSaturation', 's', 100],
  ['colourBrightness', 'v', 100]
]) {
  $(id).oninput = (e) => {
    pickerHSV[key] = +e.target.value / scale;
    syncColourPicker();
    applyPickedColour();
  };
  $(id).onchange = finishColourChange;
}
// Ink updates immediately; paper and shading keep one undo step per gesture.
function applyPickedColour() {
  if (!colourTarget) return;
  const hex = hsvToHex(pickerHSV);
  if (hex === colourTarget.value) return;
  applyingColour = true;
  colourTarget.value = hex;
  colourTarget.dispatchEvent(new Event('input', { bubbles: true }));
  applyingColour = false;
  colourChanged = true;
}

function finishColourChange() {
  if (!colourTarget || !colourChanged) return;
  colourChanged = false;
  colourTarget.dispatchEvent(new Event('change', { bubbles: true }));
}

function readColourHex() {
  let hex = $('colourHex').value.trim();
  if (!hex.startsWith('#')) hex = '#' + hex;
  if (/^#[0-9a-f]{3}$/i.test(hex)) hex = '#' + [...hex.slice(1)].map((c) => c + c).join('');
  if (!/^#[0-9a-f]{6}$/i.test(hex)) {
    $('colourPickerError').textContent = 'Use a hex colour, such as #edce83.';
    return;
  }
  pickerHSV = hexToHSV(hex);
  syncColourPicker();
  applyPickedColour();
  finishColourChange();
}
$('colourHex').onchange = readColourHex;
$('colourHex').onkeydown = (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    readColourHex();
  }
};
for (const id of ['colourR', 'colourG', 'colourB']) {
  $(id).onchange = () => {
    const values = ['colourR', 'colourG', 'colourB'].map((key) => $(key).value.trim());
    if (
      values.some(
        (value) => value === '' || !Number.isInteger(+value) || +value < 0 || +value > 255
      )
    ) {
      $('colourPickerError').textContent = 'RGB values go from 0 to 255.';
      return;
    }
    pickerHSV = hexToHSV(
      '#' + values.map((value) => (+value).toString(16).padStart(2, '0')).join('')
    );
    syncColourPicker();
    applyPickedColour();
    finishColourChange();
  };
}
$('expandColour').onclick = () => {
  const expanded = $('colourDialog').classList.toggle('expanded');
  $('expandColour').setAttribute('aria-expanded', String(expanded));
  $('expandColour').setAttribute(
    'aria-label',
    expanded ? 'Compact colour picker' : 'Larger colour picker'
  );
  $('expandColour').title = expanded ? 'Compact colour picker' : 'Larger colour picker';
};
$('closeColour').onclick = () => {
  finishColourChange();
  $('colourDialog').close();
};
$('colourDialog').addEventListener('close', () => {
  // A close event can arrive after another swatch has reopened the panel.
  if ($('colourDialog').open) return;
  finishColourChange();
  colourTarget = null;
  colourDrag = null;
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('colourDialog').open && !document.querySelector('dialog:modal')) {
    finishColourChange();
    $('colourDialog').close();
  }
});
const paletteSetColour = setColour;
setColour = function (value) {
  paletteSetColour(value);
  if (
    !applyingColour &&
    $('colourDialog').open &&
    ['color', 'toolColor'].includes(colourTarget?.id)
  ) {
    pickerHSV = hexToHSV(colour);
    syncColourPicker();
  }
};
const paletteUpdateUI = updateUI;
updateUI = function () {
  paletteUpdateUI();
  if (
    $('colourDialog').open && colourTarget && !applyingColour && !colourDrag &&
    !document.activeElement?.matches('#colourDialog input')
  ) {
    pickerHSV = hexToHSV(colourTarget.value);
    syncColourPicker();
  }
};
for (const id of ['color', 'toolColor', 'paperColor', 'shadeBase', 'shadeShadow', 'shadeLight']) {
  const input = $(id);
  input.setAttribute('aria-haspopup', 'dialog');
  input.onclick = (e) => {
    e.preventDefault();
    openColourPicker(input);
  };
  input.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openColourPicker(input);
    }
  };
}
