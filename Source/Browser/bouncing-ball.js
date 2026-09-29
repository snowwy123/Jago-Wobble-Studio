// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Cameron Jago Lis Illustrates.
// The editable bouncing-ball exercise.

function makeDemo() {
  // A pencil exercise: one rough ball, a ground line, and two mirrored arcs.
  const scale = Math.min(project.width / 640, project.height / 480),
    ox = project.width / 2 - 320 * scale,
    oy = project.height / 2 - 240 * scale;
  const ground = uid(),
    ball = uid();
  project.name = 'Bouncing ball';
  project.paper = '#fffdf9';
  project.wiggle = 1;
  project.boil = 6;
  project.fps = 12;
  project.loop = 'loop';
  project.layers = [
    { id: ground, name: 'Ground line', visible: true, locked: false, opacity: 1 },
    { id: ball, name: 'Ball sketches', visible: true, locked: false, opacity: 1 }
  ];
  project.activeLayer = ball;
  project.current = 0;
  const point = (x, y) => ({ x: ox + x * scale, y: oy + y * scale, p: 0.5 });
  const stroke = (points, size, color, seed, opacity = 1, animate = true) => ({
    kind: 'stroke',
    tool: 'pencil',
    points: points.map((p) => point(...p)),
    color,
    size: Math.max(1, size * scale),
    opacity,
    pressure: false,
    animate,
    mirror: false,
    seed
  });
  project.frames = Array.from({ length: 24 }, (_, f) => {
    const step = f % 12,
      t = step / 12,
      travel = f < 12 ? t : 1 - t;
    const x = 115 + 410 * travel,
      lift = 175 * 4 * t * (1 - t);
    const squash = step === 0,
      stretch = step === 1 || step === 11;
    const rx = squash ? 37 : stretch ? 24 : 29,
      ry = squash ? 20 : stretch ? 35 : 29;
    const y = 385 - ry - lift,
      contour = [];
    // Each frame gets a slightly different, imperfect contour, like redrawing on paper.
    for (let i = 0; i <= 40; i++) {
      const j = i % 40,
        a = (j / 40) * Math.PI * 2;
      const r = 1 + 0.025 * Math.sin(j * 1.7 + f * 2.1) + 0.035 * Math.cos(j * 0.63 - f * 0.7);
      contour.push([x + Math.cos(a) * rx * r, y + Math.sin(a) * ry * r]);
    }
    const retrace = [];
    for (let i = 0; i < 25; i++) {
      const a = (-0.75 + (i / 24) * 1.55) * Math.PI;
      retrace.push([
        x + Math.cos(a) * (rx + 2.1) + Math.sin(i * 1.3 + f) * 0.8,
        y + Math.sin(a) * (ry + 1.2)
      ]);
    }
    const contents = {
      [ground]: [
        stroke(
          [
            [66, 386],
            [133, 385.5],
            [207, 386.6],
            [277, 386],
            [353, 385],
            [434, 386.3],
            [508, 385.6],
            [574, 386]
          ],
          2.6,
          '#9a9389',
          92,
          0.65,
          false
        ),
        stroke(
          [
            [88, 388],
            [210, 387.6],
            [327, 388.7],
            [449, 387.3],
            [551, 388]
          ],
          1.5,
          '#b2aba1',
          94,
          0.35,
          false
        )
      ],
      [ball]: [
        stroke(contour, 5, '#49443e', 700 + f * 173, 0.95),
        stroke(retrace, 2.5, '#797168', 1100 + f * 91, 0.55)
      ]
    };
    if (squash) {
      contents[ball].push(
        stroke(
          [
            [x - 44, 380],
            [x - 50, 374]
          ],
          2.6,
          '#797168',
          2300 + f,
          0.6
        )
      );
      contents[ball].push(
        stroke(
          [
            [x + 43, 380],
            [x + 49, 374]
          ],
          2.6,
          '#797168',
          2400 + f,
          0.6
        )
      );
    }
    return { id: uid(), hold: 1, contents };
  });
}
