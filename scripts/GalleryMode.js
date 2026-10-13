import { ScenePainter } from './ScenePainter.js';
import { ScenePaths } from './ScenePaths.js';

/**
 * Reports the scene on screen as gallery mode begins: its src, and a
 * promise that resolves true once its image is decoded, false if it
 * cannot be. The promise must not reject.
 *
 * @callback EnterGallery
 * @returns {{ src: string, ready: Promise<boolean> }}
 */

// The button icons are drawn rather than typed: font glyphs for them vary in
// size between fonts, and font metrics, not the button, decide where they sit.
// All four share one 24-unit grid, centered on (12, 12). The play triangle
// sits 1.5 units right of box-center because its weight is at its left edge.
const SVG_OPEN = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">';
const SUN_ICON = `${SVG_OPEN}<circle cx="12" cy="12" r="4.5" fill="currentColor"/>`
	+ '<path d="M19 12 L21.5 12 M12 19 L12 21.5 M5 12 L2.5 12 M12 5 L12 2.5'
	+ ' M16.95 16.95 L18.72 18.72 M7.05 16.95 L5.28 18.72 M7.05 7.05 L5.28 5.28 M16.95 7.05 L18.72 5.28"'
	+ ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
// Cloud is drawn centered on (12, 12), then scaled up 20% about that point.
const CLOUD_ICON = `${SVG_OPEN}<g fill="currentColor" transform="translate(12 12) scale(1.2) translate(-12 -12)">`
	+ '<circle cx="12.5" cy="11.5" r="5"/><circle cx="7" cy="14" r="3.5"/>'
	+ '<circle cx="17" cy="14" r="3.5"/><rect x="7" y="14" width="10" height="3.5"/></g></svg>';
const PLAY_ICON = `${SVG_OPEN}<path d="M7 4 L20 12 L7 20 Z" fill="currentColor"/></svg>`;
const PAUSE_ICON = `${SVG_OPEN}<rect x="6" y="4" width="4" height="16" fill="currentColor"/>`
	+ '<rect x="14" y="4" width="4" height="16" fill="currentColor"/></svg>';

/**
 * Turns the mural into a slideshow that steps through each
 * scene image once, in document order, wrapping at the end.
 *
 * Inserts its own controls at the start of <body>; the page must not
 * supply them:
 * - <button id="gallery-toggle">, or the G key, enters and exits gallery mode.
 * - <button id="gallery-pause">, or the P key, pauses and plays the slideshow.
 *   Outside gallery mode it does nothing; the stylesheet should hide it there.
 * Key repeats and Ctrl, Meta or Alt combinations are ignored.
 *
 * Toggling flips the `gallery-mode` class on <body>; the stylesheet
 * decides what it hides. Entering always starts the slideshow playing.
 * Play gives the scene on screen a fresh display time.
 */
export class GalleryMode {
	#scenePainter; // ScenePainter
	#paths;
	#onEnter; // callback - fires when entering gallery mode
	#onExit; // callback - fires when exiting gallery mode

	#toggleBtn; // #gallery-toggle, created by this class
	#pauseBtn; // #gallery-pause, created by this class

	#index = -1;
	#sceneDisplayTime; // ms - length of time to display each scene
	#sceneReady; // ready promise of the scene the slideshow is showing
	#isPaused = false;
	#run = 0; // increments on each enter, exit, pause and play; stale timers check it
	#displayTimer; // timer for next paint

	/**
	 * @param {ScenePainter} scenePainter
	 * @param {ScenePaths} scenePaths
	 * @param {EnterGallery} onEnter - called when slideshow starts
	 * @param {function} onExit  - called when slideshow stops
	 * @param {number} [sceneDisplayTime=10000] - ms each scene holds, timed from its decode
	 */
	constructor(
		scenePainter,
		scenePaths,
		onEnter,
		onExit,
		sceneDisplayTime = 10000,
	) {
		if (!(scenePainter instanceof ScenePainter)) throw new Error('scenePainter must be instance of ScenePainter');
		if (!(scenePaths instanceof ScenePaths)) throw new Error('scenePaths must be instance of ScenePaths');
		if (typeof onEnter !== 'function') throw new TypeError('GalleryMode needs an onEnter() callback.');
		if (typeof onExit !== 'function') throw new TypeError('GalleryMode needs an onExit() callback.');
		if (!(Number.isFinite(sceneDisplayTime) && sceneDisplayTime > 0)) {
			throw new TypeError('GalleryMode sceneDisplayTime must be a positive number.');
		}
		for (const id of ['gallery-toggle', 'gallery-pause']) {
			if (document.getElementById(id)) {
				throw new Error(`Remove #${id} from the page: GalleryMode inserts its own.`);
			}
		}

		this.#scenePainter = scenePainter;
		this.#paths = scenePaths.all();
		this.#onEnter = onEnter;
		this.#onExit = onExit;
		this.#sceneDisplayTime = sceneDisplayTime;

		// Each button is prepended, so the pause button, created second, comes
		// first in tab order, matching its place left of the toggle.
		this.#toggleBtn = this.#createButton('gallery-toggle', () => this.#toggleMode());
		this.#pauseBtn = this.#createButton('gallery-pause', () => this.#togglePause());
		this.#labelToggle(false);
		this.#labelPause(false);

		document.addEventListener('keydown', (e) => {
			if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
			if (e.key === 'g' || e.key === 'G') this.#toggleMode();
			else if (e.key === 'p' || e.key === 'P') this.#togglePause();
		});
	}

	/**
	 * Creates a button and puts it first in <body>. It is position: fixed, so
	 * placement only sets tab order: ahead of the text, as when it lived in the markup.
	 */
	#createButton(id, onClick) {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.id = id;
		btn.addEventListener('click', onClick);
		document.body.prepend(btn);
		return btn;
	}

	#labelToggle(isGallery) {
		this.#toggleBtn.innerHTML = isGallery ? CLOUD_ICON : SUN_ICON; // constants only
		this.#toggleBtn.title = isGallery ? 'Show text (or press G)' : 'Hide text (or press G)';
	}

	#labelPause(isPaused) {
		this.#pauseBtn.innerHTML = isPaused ? PLAY_ICON : PAUSE_ICON; // constants only
		this.#pauseBtn.title = isPaused ? 'Play slideshow (or press P)' : 'Pause slideshow (or press P)';
	}

	#toggleMode() {
		const isGallery = document.body.classList.toggle('gallery-mode');
		this.#labelToggle(isGallery);
		this.#isPaused = false; // never carried into or out of a visit
		this.#labelPause(false);
		this.#stopTimer();

		if (isGallery) {
			// Enter gallery mode
			const { src, ready } = this.#onEnter();
			this.#index = this.#paths.indexOf(src);
			this.#sceneReady = ready;
			void this.#setDisplayTimer(ready);
		} else {
			// Exit gallery mode
			this.#onExit();
		}
	}

	#togglePause() {
		if (!document.body.classList.contains('gallery-mode')) return;
		this.#isPaused = !this.#isPaused;
		this.#labelPause(this.#isPaused);
		this.#stopTimer();
		if (!this.#isPaused) {
			// Play: the scene on screen gets its full time again, from now
			// (or from its decode, if it is still decoding).
			void this.#setDisplayTimer(this.#sceneReady);
		}
	}

	/** Cancels the next step, including one still waiting on a decode. */
	#stopTimer() {
		clearTimeout(this.#displayTimer);
		this.#run++;
	}

	async #setDisplayTimer(imgReady) {
		const run = this.#run;
		await imgReady;
		if (run !== this.#run) {
			// exited, re-entered, paused or played while decoding
			return;
		}

		this.#displayTimer = setTimeout(() => {
			this.#index = (this.#index + 1) % this.#paths.length;
			const ready = this.#scenePainter.fadeTo(this.#paths[this.#index]);
			this.#sceneReady = ready;
			void this.#setDisplayTimer(ready);
		}, this.#sceneDisplayTime);
	}
}