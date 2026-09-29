// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Cameron Jago Lis Illustrates.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { buildBrowser, fillSlot } = require('../build-browser.cjs');

test('source text keeps literal dollar signs', () => {
  const text = "$& $` $' $$";
  assert.equal(fillSlot('before SLOT after', 'SLOT', text), 'before ' + text + ' after');
});

test('a missing or repeated template slot fails instead of dropping source', () => {
  assert.throws(() => fillSlot('nothing here', 'SLOT', 'script'), /Expected one/);
  assert.throws(() => fillSlot('SLOT SLOT', 'SLOT', 'script'), /Expected one/);
});

test('every browser script is in the load list exactly once', () => {
  const source = path.join(__dirname, '..');
  const files = JSON.parse(fs.readFileSync(path.join(source, 'browser-files.json'), 'utf8'));
  const onDisk = fs
    .readdirSync(path.join(source, 'Browser'))
    .filter((name) => name.endsWith('.js'));
  assert.equal(new Set(files).size, files.length);
  assert.deepEqual([...files, 'toolbar.js'].sort(), onDisk.sort());
  assert.equal(files.at(-1), 'startup.js');
});

test('offline and website builds match and keep each control ID unique', () => {
  const html = buildBrowser();
  const suite = path.join(__dirname, '../..');
  assert.equal(fs.readFileSync(path.join(suite, 'index.html'), 'utf8'), html);
  assert.equal(fs.readFileSync(path.join(suite, 'Jago-Wobble-Studio.html'), 'utf8'), html);
  assert.equal(buildBrowser(), html);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const placeholder of [
    'JAGO_LAYOUT',
    'JAGO_STYLES',
    'JAGO_SKETCHBOOK',
    'JAGO_TOOLBAR',
    'STUDIO_FAVICON',
    'STUDIO_LOGO'
  ]) {
    assert(!html.includes(placeholder), placeholder + ' was not filled');
  }
});
