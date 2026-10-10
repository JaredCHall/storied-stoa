import { ImageLoader } from './ImageLoader.js';
import { SceneMap } from './SceneMap.js';
import { ScenePainter } from './ScenePainter.js';
import { GalleryMode } from './GalleryMode.js';
/**
 * Displays the correct scene for user scroll position.
 *
 * On scroll / resize, a scene must hold for settleMs before it's painted,
 * so fast scrolling doesn't crossfade through every scene it passes.
 */
export class SceneDirector {
	imageLoader; // ImageLoader
	sceneMap; // SceneMap
	scenePainter; // ScenePainter
	galleryMode; // GalleryMode

	#isAnimationFramePending; // bool, true when scroll's requestAnimationFrame is pending
	#activationRatio; // ratio of screen height from top of viewport that anchor must reach to display scene

	#isPaused = false;
	#settleMs; // ms a scene must hold before it's painted
	#candidate; // src of last selected scene or scene currently waiting out the settle
	#settleTimer;

	constructor(activationRatio = 0.35, settleMs = 500) {
		this.#activationRatio = activationRatio;
		this.#settleMs = settleMs;
	}

	/**
	 * Requests the first scene (painted once decoded) and sets up event listeners for future scene loads.
	 * Preloads additional images in the background. Handles page reflow on webfonts load.
	 */
	start() {
		this.sceneMap = new SceneMap(this.#activationRatio);
		this.imageLoader = new ImageLoader(this.sceneMap.images);
		this.scenePainter = new ScenePainter((src) => this.imageLoader.load(src));

		// Paint the first scene
		this.sceneMap.measure();
		const src = this.sceneMap.sceneForScroll();
		this.scenePainter.cutTo(src);
		this.#candidate = src;

		// Setup events
		window.addEventListener('resize', () => {
			if (this.#isPaused) return;
			this.sceneMap.measure();
			this.#onScroll();
		});
		window.addEventListener('scroll', () => {
			if (this.#isPaused) return;
			this.#onScroll();
		});

		// Handle page reflow on webfonts load and preload other images
		const preload = () => this.imageLoader.preloadFrom(this.#candidate);
		if (document.fonts?.ready) {
			document.fonts.ready.then(() => {
				// Webfonts land after first paint and shove every anchor down the page.
				this.sceneMap.measure();
				const src = this.sceneMap.sceneForScroll();
				if (src === this.#candidate) return; // reflow didn't change the scene
				clearTimeout(this.#settleTimer);
				this.#candidate = src;
				this.scenePainter.cutTo(src);
			}).finally(preload);
		} else {
			preload();
		}

		// Enable gallery mode
		this.galleryMode = new GalleryMode(
			this.scenePainter,
			this.sceneMap.images,
			() => this.#pause(),
			() => this.#resume(),
		);
	}

	/**
	 * Requests fadeTo for current scene once settleMs
	 * have been reached for the same candidate scene.
	 */
	#update() {
		this.#isAnimationFramePending = false;
		if (this.#isPaused) return;
		const src = this.sceneMap.sceneForScroll();
		if (src === this.#candidate) return; // same scene: let the clock run
		this.#candidate = src;
		clearTimeout(this.#settleTimer);
		this.#settleTimer = setTimeout(() => {
			this.scenePainter.fadeTo(src);
			this.imageLoader.preloadFrom(src); // re-center the queue on where the reader stopped
		}, this.#settleMs);
	}

	#onScroll() {
		if (this.#isAnimationFramePending) return;
		this.#isAnimationFramePending = true;
		requestAnimationFrame(() => {
			this.#update();
		});
	}

	/**
	 * Pauses the director on entering GalleryMode.
	 * Returns the held scene: its src, and a promise that resolves when it's decoded.
	 */
	#pause() {
		this.#isPaused = true;
		clearTimeout(this.#settleTimer);
		const held = this.scenePainter.hold();
		this.imageLoader.preloadForwardFrom(held.src);
		return held;
	}

	/** Resumes the director on exit from GalleryMode. */
	#resume() {
		const { src } = this.scenePainter.hold(); // drop the slideshow's queued scene
		this.sceneMap.measure(); // resizes were skipped while paused
		this.#candidate = src; // the scroll below starts from the held scene
		this.#isPaused = false;
		const i = this.sceneMap.anchorPaths.indexOf(src);
		this.sceneMap.anchors[i]?.scrollIntoView();
		this.imageLoader.preloadFrom(src);
	}
}
