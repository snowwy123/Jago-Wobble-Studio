// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Cameron Jago Lis Illustrates.
// Restore the last drawing only after every feature has been installed.

async function init() {
  try {
    const saved = localStorage.getItem(JAGO_KEY);
    if (saved) {
      project = validateProject(JSON.parse(saved));
      await preloadImages();
    }
  } catch (err) {
    project = fresh();
    toast('Saved drawing could not be restored. Open a saved .jago project if you have one.');
  }
  initialiseStudio();
  resizeBuffers();
  invalidate();
  resetHistory();
  setTool('pen');
  setColour(colour);
  updateUI();
  fit();
  requestAnimationFrame(tick);
}
init().catch((err) => {
  console.error(err);
  toast('The studio could not start. Reload or open a saved project.');
});
