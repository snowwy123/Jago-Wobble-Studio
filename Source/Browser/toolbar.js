// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Cameron Jago Lis Illustrates.

'use strict';
const $ = (id) => document.getElementById(id);
const icons = {
  pen: 'M4 20l4-1 12-12-3-3L5 16z M14 7l3 3',
  pencil: 'M4 20l5-1L20 8l-4-4L5 15z M5 15l4 4 M13 7l4 4',
  marker: 'M4 20l6-2 8-8-5-5-8 8z M13 5l2-2 5 5-2 2 M4 20h7',
  spray: 'M7 10h9v11H7z M10 7h3v3 M12 7V4h4 M19 4h.1 M20 7h.1 M20 1h.1',
  eraser: 'M4 13l9-9 7 7-9 9H9z M9 8l7 7 M11 20h10',
  fill: 'M3 13l9-9 8 8-9 9z M8 2l8 8 M3 13h17 M21 16q4 5 0 5t0-5',
  picker: 'M4 20l3-1L18 8l-3-3L4 16z M13 3l8 8 M16 4l2-2 4 4-2 2',
  line: 'M4 20L20 4 M3 19l2 2 M19 3l2 2',
  rect: 'M4 5h16v14H4z',
  ellipse: 'M21 12a9 7 0 1 1-18 0 9 7 0 1 1 18 0',
  hand: 'M8 12V6q0-3 3 0v5-7q0-3 3 0v7-5q0-3 3 0v6-3q0-3 3 0v7q0 6-7 6-3 0-5-3l-4-5q-1-3 2-2l2 2',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
  undo: 'M4 10h10q7 0 6 8 M4 10l5-5 M4 10l5 5',
  redo: 'M20 10H10q-7 0-6 8 M20 10l-5-5 M20 10l-5 5',
  folder: 'M3 6h7l2 3h9v11H3z',
  save: 'M4 3h13l3 3v15H4z M8 3v6h8V3 M8 21v-8h8v8',
  help: 'M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0 M9 9q0-5 5-3 4 2-2 6v2 M12 17h.01',
  export: 'M12 15V3 M7 8l5-5 5 5 M4 14v7h16v-7',
  onionSettings: 'M3 4h12v12H3z M8 9h13v12H8z M5 7h5 M11 13h7 M11 17h7',
  frameTiming: 'M3 3h12v5 M3 3v14h4 M20 15a7 7 0 1 1-14 0 7 7 0 1 1 14 0 M13 11v4l3 2',
  sliders: 'M5 3v18 M12 3v18 M19 3v18 M2 8h6 M9 16h6 M16 7h6',
  swap: 'M3 7h17l-4-4 M21 17H4l4 4',
  wiggle: 'M2 16C5 1 10 2 8 14s8 13 7-1 8-9 7 1',
  play: 'M8 4l12 8-12 8z',
  pause: 'M8 5v14 M16 5v14',
  onion: 'M15 6a7 7 0 1 1-10 10 M21 8a7 7 0 1 1-14 0 7 7 0 1 1 14 0',
  copy: 'M8 8h13v13H8z M4 16H2V2h14v2',
  trash: 'M3 6h18 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7',
  eye: 'M2 12q10-14 20 0-10 14-20 0 M15 12a3 3 0 1 1-6 0 3 3 0 1 1 6 0',
  hidden: 'M3 3l18 18 M8 5q8-3 14 7l-3 3 M15 19Q7 21 2 12l3-3',
  lock: 'M6 10h12v11H6z M8 10V6q0-7 8 0v4',
  unlock: 'M6 10h12v11H6z M8 10V6q0-7 8 0',
  close: 'M5 5l14 14 M19 5L5 19',
  image: 'M3 3h18v18H3z M3 17l6-7 5 5 3-3 4 5 M17 7h.01'
};
const icon = (n) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[n] || icons.pen}"/></svg>`;
document.querySelectorAll('[data-icon]').forEach((e) => (e.outerHTML = icon(e.dataset.icon)));
icons.hexagon = 'M7 3h10l5 9-5 9H7l-5-9z';
icons.move = 'M12 2v20 M2 12h20 M8 6l4-4 4 4 M8 18l4 4 4-4 M6 8l-4 4 4 4 M18 8l4 4-4 4';
icons.triangle = 'M12 3l10 18H2z';
icons.star = 'M12 2l3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1z';
icons.heart = 'M12 21S1 14 2 7c1-6 8-6 10-1 2-5 9-5 10 1 1 7-10 14-10 14';
icons.diamond = 'M12 2l10 10-10 10L2 12z';
icons.arrow = 'M2 9h11V3l9 9-9 9v-6H2z';
const extraShapes = ['triangle', 'star', 'heart', 'diamond', 'arrow', 'hexagon'];
const closedShapes = ['rect', 'ellipse', ...extraShapes];
const isShapeTool = (t) => t === 'line' || closedShapes.includes(t);
icons.stamp = 'M5 21h14 M4 14h16v4H4z M9 14V9a4 4 0 1 1 6 0v5';
icons.select = 'M3 8V3h5 M16 3h5v5 M21 16v5h-5 M8 21H3v-5';
icons.polygon = 'M4 5l15-2 2 15-12 3L4 5 M3 4h2v2H3z M18 2h2v2h-2z M20 17h2v2h-2z M8 20h2v2H8z';
icons.lasso = 'M18 17c9-7 0-16-10-12S1 21 12 20s4-8 0-6-2 9-6 9';
const toolDefs = [
  ['pen', 'Studio pen', 'B'],
  ['pencil', 'Pencil', 'P'],
  ['marker', 'Marker', 'M'],
  ['spray', 'Spray', 'A'],
  ['eraser', 'Eraser', 'E'],
  ['fill', 'Fill', 'F'],
  ['picker', 'Colour picker', 'I'],
  ['line', 'Line', 'L'],
  ['rect', 'Rectangle', 'R'],
  ['ellipse', 'Ellipse', 'C'],
  ['stamp', 'Stamp brush', 'J'],
  ['select', 'Rectangle selection', 'U'],
  ['lasso', 'Lasso selection', 'K'],
  ['polygon', 'Polygon selection', 'W'],
  ['move', 'Move selection or layer', 'V'],
  ['hand', 'Pan', 'H'],
  ['triangle', 'Triangle', 'T'],
  ['star', 'Star', 'S'],
  ['heart', 'Heart', 'G'],
  ['diamond', 'Diamond', 'Q'],
  ['arrow', 'Arrow', 'Y'],
  ['hexagon', 'Hexagon', 'N']
];
$('toolBar').innerHTML =
  toolDefs
    .filter((t) => !extraShapes.includes(t[0]))
    .map(
      ([id, name, key], i) =>
        `${i === 4 || i === 7 || i === 10 ? '<hr>' : ''}<button data-tool="${id}" title="${name} (${key})" aria-label="${name} (${key})" aria-pressed="${id === 'pen'}">${icon(id)}</button>${id === 'ellipse' ? '<button id="moreShapes" title="More shapes" aria-label="More shapes">' + icon('star') + '</button>' : ''}`
    )
    .join('') +
  '<hr><input id="toolColor" class="tool-color" type="color" value="#252338" title="Choose colour" aria-label="Choose colour">';
$('brushes').innerHTML = toolDefs
  .slice(0, 4)
  .map(
    ([id, name]) =>
      `<button data-tool="${id}" title="${name}" aria-label="${name}" aria-pressed="${id === 'pen'}">${icon(id)}</button>`
  )
  .join('');
$('shapeGrid').innerHTML = toolDefs
  .filter((t) => closedShapes.includes(t[0]))
  .map(
    ([id, name, key]) =>
      `<button data-tool="${id}" aria-label="${name} (${key})" title="${name} (${key})">${icon(id)}<span>${name}</span></button>`
  )
  .join('');
const colours = [
  '#252338',
  '#58556d',
  '#89859c',
  '#ffffff',
  '#ef6461',
  '#ffa474',
  '#ffd668',
  '#dcff72',
  '#62d6ae',
  '#55c4ed',
  '#6682ed',
  '#a88af7',
  '#e5a0e3',
  '#ff85aa',
  '#aa7155',
  '#483e3b'
];
$('palette').innerHTML = colours
  .map(
    (c) =>
      `<button class="swatch" data-color="${c}" style="background:${c}" title="${c}" aria-label="Colour ${c}"></button>`
  )
  .join('');
