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

/**
 * Turns the mural into a slideshow that steps through each
 * scene image once, in document order, wrapping at the end.
 *
 * Inserts its own toggle, a <button id="gallery-toggle">, at the start of
 * <body>; the page must not supply one. Toggled by that button or the
 * G key (key repeats and Ctrl, Meta or Alt combinations are ignored).
 * Toggling flips the `gallery-mode` class on <body>; the stylesheet
 * decides what it hides.
 */
export class GalleryMode {
	#scenePainter; // ScenePainter
	#paths;
	#onEnter; // callback - fires when entering gallery mode
	#onExit; // callback - fires when exiting gallery mode

	#toggleBtn; // #gallery-toggle, created by this class

	#index = -1;
	#sceneDisplayTime; // ms - length of time to display each scene
	#run = 0; // increments on each gallery enter / exit
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
		if (document.getElementById('gallery-toggle')) {
			throw new Error('Remove #gallery-toggle from the page: GalleryMode inserts its own.');
		}

		this.#scenePainter = scenePainter;
		this.#paths = scenePaths.all();
		this.#onEnter = onEnter;
		this.#onExit = onExit;
		this.#sceneDisplayTime = sceneDisplayTime;

		this.#toggleBtn = this.#createButton('gallery-toggle', () => this.#toggleMode());
		this.#labelToggle(false);

		document.addEventListener('keydown', (e) => {
			if (!e.repeat && (e.key === 'g' || e.key === 'G') && !(e.ctrlKey || e.metaKey || e.altKey)) {
				this.#toggleMode();
			}
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
		this.#toggleBtn.textContent = isGallery ? '\u2601' : '\u2600'; // ☁ : ☀
		this.#toggleBtn.title = isGallery ? 'Show text (or press G)' : 'Hide text (or press G)';
	}

	#toggleMode() {
		const isGallery = document.body.classList.toggle('gallery-mode');
		this.#labelToggle(isGallery);

		if (isGallery) {
			// Enter gallery mode
			this.#run++;
			const { src, ready } = this.#onEnter();
			this.#index = this.#paths.indexOf(src);
			void this.#setDisplayTimer(ready);
		} else {
			// Exit gallery mode
			clearTimeout(this.#displayTimer);
			this.#run++;
			this.#onExit();
		}
	}

	async #setDisplayTimer(imgReady) {
		const run = this.#run;
		await imgReady;
		if (run !== this.#run) {
			// exited or re-entered while decoding
			return;
		}

		this.#displayTimer = setTimeout(() => {
			this.#index = (this.#index + 1) % this.#paths.length;
			const ready = this.#scenePainter.fadeTo(this.#paths[this.#index]);
			void this.#setDisplayTimer(ready);
		}, this.#sceneDisplayTime);
	}
}