# Drawing, animation & reusable motifs

Wobble 1.10.0 development preview

## Draw comfortably

The existing stamp-brush chooser now has **Find a stamp brush** and up to six recent choices. Imported packs, saved settings and project stamp images use the same preset loader. Save a custom brush through the existing Draw controls; export the preset library for a portable backup. The 16 Odd Little Marks brushes are built in. Find them under Odd Little Marks in the stamp-brush chooser.

At narrow widths, use the settings/sliders button above the canvas to open Draw, Motion, Layers or Edit. **Close settings** returns the drawing space. **Focus canvas** hides the timeline and settings; its button remains available to restore them. Fit follows the available drawing area after layout changes, while manual zoom stays yours.

## Transform artwork across frames

Choose **Transform artwork…** near the canvas. Pick selected frames, the active clip or every frame, then the active unlocked layer or all unlocked layers. Offset, scale, rotate or flip around the canvas centre or a shared artwork centre. The preview shows the current frame at the start of its motion. Apply uses the same transform across the chosen drawings, with one Undo step.

The original drawing operations and motion remain editable inside a transform group. Locked layers stay unchanged; existing clipping relationships still apply. The transform changes source artwork rather than adding a new animation effect. Repeated transforms are combined where possible. Rendered output is still bounded by the canvas; artwork moved outside it is not visible.

## Keep your own motifs

Open **My motifs… → Keep motif…**. Name the active layer and choose current, selected or all frames. A clipping layer includes any base layers it needs. Custom brush images and placed artwork travel with it; unrelated layers and project audio are excluded.

The local shelf holds up to 20 motifs, 4 MB per motif and 20 MB total. **Export motif** saves a .jagomotif file that can be imported on another device. **Export editable .jago** in the Keep dialog makes a standalone drawing with an embedded cover. Keep explicit files as backups; a device/browser shelf is not a portable project folder. Remove from shelf has Undo while the gallery stays open.

Three placement modes make scope explicit:

- **Current pose on this frame:** adds new layers containing the saved pose only on the current frame.
- **Animation sampled onto existing frame timing:** keeps your FPS, frame identities and holds, sampling the motif at those times.
- **Create matching timing from this single frame:** repeats your current drawing behind the motif and adopts the motif's frame holds, FPS and loop direction. Starts from a single-frame drawing.

Motifs fit inside the receiving canvas without stretching or enlarging unnecessarily. Layers and clipping references get fresh identities; your existing layers stay intact. Live effects use the receiving drawing's motion master, so the standalone .jago is the exact independent source when you need its original global settings.

## Explore editable examples

**Explore examples…** includes three new original studies alongside the existing brush and shape projects. Previewing leaves your drawing unchanged; opening is one Undo step.

- **Creature broadcast:** eight drawn poses; keep its Moth layer as an animated motif.
- **Electric bloom:** twelve frames; transform the orbiting seeds across the sequence.
- **After hours:** eight poses with deliberate longer holds; reuse a moving character over a still background.

Examples/Authoring contains the editable .jago projects and their rendered PNG/GIF versions. The frame strip now shows milliseconds alongside the existing hold count. Timing & clips and the existing selected-frame tools remain the editors for holds, ranges and playback.

## Share the right result

The Sharing guide in detailed Help distinguishes editable .jago/motif sources from PNG, GIF, sprite-sheet and PNG-sequence outputs. Send to studio supplies rendered artwork or a sampled loop to supported destinations; including the original is a source backup, not editable layers in every receiving app. This preview does not add a direct live Pulse or Workshop link. Use a supported exported file in those tools where appropriate. Project audio is preview audio; image/GIF outputs are silent.

The illustrated PDF guide covers the base tools. This document describes the focused authoring update.


## Animated examples

Explore examples now contains After hours (a layered pixel-art kiosk scene), Creature broadcast (boiling ink and an animated cyclops) and Electric bloom (a moving illustrated botanical poster). Play preview animates one card at a time without changing your drawing. Each example opens as editable layers and frames, with one-step Undo. The Examples/Authoring folder contains portable projects, PNGs and silent GIF loops.
