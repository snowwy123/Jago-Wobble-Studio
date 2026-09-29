// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Cameron Jago Lis Illustrates.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const browserDir = path.join(__dirname, 'Browser');
const suiteDir = path.dirname(__dirname);

function readSource(name) {
  return fs.readFileSync(path.join(browserDir, name), 'utf8');
}

function fillSlot(html, marker, content) {
  if (html.split(marker).length !== 2) {
    throw new Error(`Expected one ${marker} placeholder in shell.html.`);
  }
  // A callback keeps dollar signs in the source from becoming replacement patterns.
  return html.replace(marker, () => content);
}

function buildBrowser() {
  const files = JSON.parse(fs.readFileSync(path.join(__dirname, 'browser-files.json'), 'utf8'));
  if (!Array.isArray(files) || files.length === 0 || new Set(files).size !== files.length) {
    throw new Error('browser-files.json must list each app script once, in load order.');
  }

  const logo = fs.readFileSync(path.join(__dirname, 'Brand/logo.svg'), 'utf8').trim();
  let html = readSource('shell.html');
  html = fillSlot(html, '<!-- STUDIO_LOGO -->', logo);
  html = fillSlot(
    html,
    '<!-- STUDIO_FAVICON -->',
    '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,' +
      encodeURIComponent(logo) +
      '">'
  );
  html = fillSlot(html, '/* JAGO_LAYOUT */', readSource('layout.css'));
  html = fillSlot(html, '/* JAGO_STYLES */', readSource('studio.css'));
  html = fillSlot(html, '/* JAGO_SKETCHBOOK */', readSource('sketchbook.css'));
  html = fillSlot(
    html,
    '<!-- JAGO_TOOLBAR -->',
    '<script>\n' + readSource('toolbar.js') + '\n</script>'
  );

  // Keep one app script: the feature files share state and extend earlier functions.
  const app = files.map((file) => `// Source: ${file}\n${readSource(file)}`).join('\n');
  html = fillSlot(
    html,
    '<!-- STUDIO_ENGINE -->',
    '<!-- STUDIO_ENGINE -->\n<script>\n' + app + '\n</script>'
  );
  for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    new vm.Script(match[1], { filename: 'Jago-Wobble-Studio.html' });
  }

  // Validate everything before touching either output. Both editions use identical bytes.
  for (const name of ['Jago-Wobble-Studio.html', 'index.html']) {
    fs.writeFileSync(path.join(suiteDir, name), html);
  }
  return html;
}

if (require.main === module) {
  try {
    buildBrowser();
    console.log('Built Jago-Wobble-Studio.html and index.html.');
  } catch (error) {
    console.error('Browser build failed: ' + error.message);
    process.exitCode = 1;
  }
}

module.exports = { buildBrowser, fillSlot };
