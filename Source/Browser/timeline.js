// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Cameron Jago Lis Illustrates.
// Frame holds and the playback clock.

function frameSequence() {
  const a = project.frames.map((f, i) => i);
  return project.loop === 'pingpong' && a.length > 2 ? a.concat(a.slice(1, -1).reverse()) : a;
}

function frameAtBeat(beat) {
  const seq = frameSequence(),
    total = seq.reduce((s, i) => s + project.frames[i].hold, 0);
  let b = ((beat % total) + total) % total;
  for (const i of seq) {
    if (b < project.frames[i].hold) return i;
    b -= project.frames[i].hold;
  }
  return 0;
}

function beatForFrame(i) {
  return project.frames.slice(0, i).reduce((s, f) => s + f.hold, 0);
}

function pause() {
  playing = false;
  $('playBtn').innerHTML = icon('play');
  $('playBtn').title = 'Play (Space)';
  playIndex = project.current;
  document.querySelectorAll('.frame-card.playing').forEach((e) => e.classList.remove('playing'));
  updateStatus();
  renderNeeded = true;
}

function togglePlay() {
  if (drawing || exporting) return;
  if (playing) {
    project.current = playIndex;
    pause();
    updateUI();
    return;
  }
  playing = true;
  playStart = performance.now();
  playBase = beatForFrame(project.current);
  $('playBtn').innerHTML = icon('pause');
  $('playBtn').title = 'Pause (Space)';
  updateStatus();
}

function tick(now) {
  if (!exporting && !document.hidden) {
    const nextTick = project.wiggleEnabled ? Math.floor((now / 1000) * project.boil) % 12 : 0;
    if (nextTick !== lastTick) {
      phase = nextTick;
      lastTick = nextTick;
      if (project.wiggle > 0) renderNeeded = true;
    }
    if (playing) {
      const index = frameAtBeat(playBase + ((now - playStart) / 1000) * project.fps);
      if (index !== playIndex) {
        playIndex = index;
        renderNeeded = true;
        updateStatus();
      }
      Array.from($('frames').children).forEach((e, i) =>
        e.classList.toggle('playing', i === playIndex)
      );
    }
    if (renderNeeded) paintCanvas();
  }
  requestAnimationFrame(tick);
}
