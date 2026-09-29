# Let's make something move

Start with **New**, or open an example from **Help (?)** and have a play. New starts with a smooth 960 × 640 canvas. Choose another size or Pixel art canvas when you want it.

## Draw and pick colours

Choose a pen, pencil, marker, spray, stamp or shape from the toolbar. Size, opacity and the other controls follow your selected tool. **Reset brush defaults** is there if a brush starts feeling a bit odd.

Click a colour swatch to open the little colour panel. Pick a hue around the ring and a shade inside the square, or enter Hex or RGB values. Changes apply straight away. Keep drawing with it open, click the enlarge button for more room, or close it with × or Escape. The folded section has hue, saturation and brightness sliders.

The eyedropper picks from your canvas. **X** swaps your current and previous drawing colours.

## Add a wobble

**Wiggle new marks** decides whether new strokes have movement. The **Live motion** checkbox beside the canvas is linked to the one in Motion and turns the project's movement on or off. It does not remove the animation settings or replace the timeline's Play button. **Pause live motion** freezes the preview while you work.

In Motion, choose a wiggle type and adjust it. Classic gives lines a hand-redrawn feel. Sway rocks around a pivot; Ripple sends a wave along a mark; Flutter catches one end in a breeze. Breathe expands and contracts, Spring bounces and settles, and Drift follows a small path. Texture crawl changes grain inside textured stamp marks.

Use **Preview on active layer** to try a setup. Choose **Apply to layer** to move the whole layer, or **Apply to strokes** to give its individual strokes those settings. A saved motion preset is a shortcut to settings for one of these types.

For Sway or Breathe, use **Edit active layer settings** to load an existing movement. Turn on the pivot control and drag its cross, or choose **Place pivot on canvas**. Apply your settings to keep the change. The pendulum in the motion study is a good place to try this.

## Layers and shading

Layers keep parts of a drawing separate. Rename them, change their order, hide, lock, duplicate or adjust their opacity. **Import image** can place an image on its own layer or inside your current one.

**Base**, **Shadow** and **Light** are colour swatches for shading. Pick a colour, then use its **Use** button to draw with it. They do not recolour existing artwork. Alpha lock keeps new marks inside a layer's ink; a clipping layer keeps shading inside the layer beneath. Try the shading study to see this in practice.

## Select and move

Use rectangle selection, freehand lasso or the polygon lasso. For the polygon tool, click each corner, then press Enter, double-click, or click the first point to finish. Backspace removes a corner; Escape cancels.

Drag inside a selection to move it without changing tools. Drag its corners to resize, or its rotation handle to turn it. The selection outline shows the clipping boundary. Live marks keep their movement; imported flat images remain images.

Copy, cut and paste work on the active layer. The Move tool moves the selection when one exists, or the whole layer when there is no selection.

## Frames

Add a frame or duplicate one, then draw the next pose. **Play** runs the timeline. FPS sets its speed, and a frame's hold makes that drawing stay longer. Frame timing also lets you reorder frames and apply timing to every frame.

Onion skin shows neighbouring drawings, with pink before and blue after by default. Its settings let you choose how many to show, their opacity, or their original colours. Guides and onion skins are never exported.

## Pixels, guides and symmetry

**Pixel look** gives your drawing chunky pixel blocks. Choose a block size when starting a project or exporting. **Pixel art canvas** is for drawing directly on a small, true 1 px grid. Movement stays on that grid too.

Drawing aids include grids, thirds, a centre cross, isometric lines, perspective and an arc with time steps. Their settings control spacing, divisions or guide placement. The arc is a drawing guide, not an automatic animation path.

Mirror settings offer left/right, top/bottom, four-way and radial symmetry, with an adjustable centre. Spray has its own density, speckle size, spread, concentration and shape controls.

On a touchscreen, two fingers pan and zoom. Turn off finger drawing to pan with one finger while drawing with a pen. On desktop, use the Hand tool and zoom controls.

## Save and share

**Save** downloads an editable .jago project. Use **Open** to return to it. Autosaves and recovery snapshots are useful, but save a separate file for work you care about. Browser storage can disappear when browsing data is cleared and does not automatically transfer to the Windows app.

Export a GIF for a ready-to-share loop, a PNG for a still, or a sprite sheet or full-motion PNG sequence for other software. GIF has a limited colour palette; PNG keeps full colour and transparency. Export pixel size changes the output, not your original drawing.

Canvas sizes go up to 2048 pixels per side and 2,097,152 pixels in total. The New menu offers sizes within those limits. Larger canvases and lots of moving layers take more time to render.

For custom stamps and saved libraries, see [Make a little brush pack](Brush-packs.md).

## Windows

Extract the ZIP before opening the EXE. The app needs 64-bit Windows and Microsoft WebView2 Runtime. If Windows blocks this unsigned build, open Jago-Wobble-Studio.html in your browser instead.

The Windows app is portable. To remove it, delete the extracted app folder after saving your work. Drawings and presets stored in the app profile remain under `%LOCALAPPDATA%\Jago Loop Studio`; back up anything you want before removing that folder too.

## Handy keys

| Key | Tool or action |
| --- | --- |
| B / P / M / A | Pen / pencil / marker / spray |
| J | Stamp brush |
| E / F / I | Eraser / fill / eyedropper |
| U / K / W | Rectangle / freehand / polygon selection |
| V / H | Move / hand |
| Space | Play or pause frames |
| O | Onion skin |
| Ctrl+C / X / V | Copy / cut / paste selection |
| Ctrl+Z / Ctrl+Shift+Z | Undo / redo |
| Ctrl+S | Save project |

Themes and the other shortcuts are in **Help (?)**. Pick whichever colours make you want to draw.

## Paper size and the print table

Click the paper dimensions above the canvas to change its size. Keep artwork centred or anchored at the top left. This affects all frames, preserves layer motion and never stretches the marks. Artwork outside the page is cropped from the view and export, but remains in the project. Undo restores the earlier size.

**Wobble → Dither:** export a **PNG sequence ZIP**, then in Jago Dither Studio choose **Layers → + Wobble loop**. Add dither textures, printing inks and lettering to your animated drawing.

**Dither → Wobble:** export a **Wobble project** from Dither and open the **.jago** file here. Choose a single printed layer or separate ink layers, then add a drawing layer above it. Keep your original **.jagodither** project to edit its text, images and print settings.

Dither accepts loops up to 12 seconds. The return trip supports up to 48 frames; choose a lower transfer rate for longer loops. These transfers use rendered frames, so keep the original project from each studio for full editing.

