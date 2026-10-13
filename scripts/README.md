# Mural scripts

A scrolling text with a painted backdrop. As the reader scrolls, the scene behind the text crossfades to match the passage. Gallery mode turns the scenes into a slideshow.

The scripts are ES modules with no dependencies and no build step.

## What a page needs

The script throws at startup if any required piece is missing.

```html
<head>
    <link rel="stylesheet" href="mural.css">
    <script type="module" src="js/index.js"></script>
</head>
<body>
<div id="scene-a"></div>
<div id="scene-b" class="hidden"></div>

<h2 class="scene-marker" data-scene="img/prologue.jpg">Prologue</h2>
<p>…</p>
<h2 class="scene-marker" data-scene="img/parodos.jpg">Parodos</h2>
<p>…</p>
</body>
```

- **Scene anchors** (required): `.scene-marker` elements with a `data-scene` image path. There must be at least one.
- **Two layers** (required): `#scene-a` and `#scene-b`. Images are inserted into them as `<img>` children, which replace whatever the layer held. `#scene-a` is painted first, so `#scene-b` should start hidden.
- **No `#gallery-toggle` or `#gallery-pause`** in the page. The script inserts both buttons at the start of `<body>` and throws if either is already there. Style them by those ids.
- **`type="module"`** on the script tag, because the files use `import`.

## What the stylesheet needs

```css
#scene-a, #scene-b {
    position: fixed;
    inset: 0;
    transition: opacity 1.5s ease-in-out; /* required; sets the fade length */
}
.hidden { opacity: 0; } /* required */
#scene-a img, #scene-b img { width: 100%; height: 100%; object-fit: cover; }

body.gallery-mode .text { opacity: 0; } /* yours to define */
```

- The layers need a transition with a duration above zero. The script reads the first listed `transition-duration` from `#scene-a` at startup and uses it as the crossfade length. Link the stylesheet in `<head>` so it has loaded by then.
- `.hidden` must set `opacity: 0`. The crossfade works by moving that class between the layers.
- Gallery mode only toggles `gallery-mode` on `<body>`. Hiding the text is up to the stylesheet. The `.text` selector above is a placeholder.
- The script doesn't hide `#gallery-pause` outside gallery mode; the stylesheet should (`mural.css` does).
- For swipes, gallery mode should set `touch-action: pan-y pinch-zoom` on `<html>` and `<body>`, so the browser leaves sideways drags to the script (`mural.css` does).
- Only the two required rules are fixed. The rest of this CSS is a starting point.

## Scene paths

- Each `data-scene` value is used as the image's `src`, so it resolves relative to the page.
- Several anchors can share an image. It is loaded once and appears once in the slideshow.
- Paths are compared as plain strings, so `img/a.jpg` and `./img/a.jpg` count as two images. Write each path the same way everywhere.

## Behavior

- **Scrolling:** a scene becomes current when its anchor crosses a line 30% of the way down the viewport (set in `index.js`). Above the first anchor, the first scene shows. At the bottom of the page, the last scene shows even if its anchor never reached the line. A scene must stay current for 500 ms before it fades in, so fast scrolling doesn't flash through every scene in between.
- **Loading:** the first scene is cut in with no fade once it decodes. The others preload one at a time, nearest to the reader first.
- **Gallery mode:** toggled by the button or the G key. It starts from the scene on screen and shows each image for 10 s, in document order, wrapping at the end. The pause button or the P key pauses and plays it; play gives the scene on screen a fresh 10 s. The Right and Left arrow keys step forward and back, one scene per press, wrapping at both ends; each step gives the new scene a fresh 10 s, and a step while paused stays paused. Outside gallery mode the arrows keep their usual page behavior. On touch screens, a quick sideways swipe steps too: left for the next scene, right for the previous. Mouse drags don't count. Entering always starts playing. On exit, the page scrolls to the first anchor that uses the scene on screen.
- **Failures:** an image that won't decode logs `Mural: failed to decode …`, and the previous scene stays up.

## Settings

| Setting | Where | Default |
|---|---|---|
| Activation line | `new SceneDirector(0.3)` in `index.js` | 0.35 in the class; `index.js` passes 0.3 |
| Settle time | `SceneDirector` constructor, 2nd argument | 500 ms |
| Gallery time per scene | `GalleryMode` constructor, 5th argument (`SceneDirector` doesn't pass it) | 10000 ms |
| Fade length | CSS `transition` on the layers | none; required |
| Swipe thresholds | `SWIPE_*` constants at the top of `GalleryMode.js` | 50 px sideways, within 500 ms, at least 1.5× more sideways than vertical |

## Files

| File | Role |
|---|---|
| `index.js` | Entry point; starts a `SceneDirector` on `DOMContentLoaded`. |
| `SceneDirector.js` | Coordinates the others: scroll and resize handling, the settle delay, pausing for gallery mode. |
| `SceneMap.js` | Finds the anchors and maps scroll position to a scene. |
| `ScenePaths.js` | The deduplicated list of image paths, in document order. |
| `ImageLoader.js` | Fetches and decodes each image once; runs the preload queue. |
| `ScenePainter.js` | Paints scenes on the two layers: crossfades and cuts. |
| `GalleryMode.js` | The slideshow, its toggle, and its pause button. |