import { ScenePaths } from './ScenePaths.js';

/**
 * Maps scroll position to scene.
 *
 * Scene anchors are `.scene-marker` elements carrying a
 * `data-scene` attribute. No anchors at all, throws.
 */
export class SceneMap {
	anchors = []; // anchor elements in document order
	offsets = []; // document-top offsets, parallel to anchors
	anchorPaths = []; // scene image paths for each anchor, may include duplicates
	images; // ScenePaths

	activationRatio = null;

	constructor(
		activationRatio = 0.35, // ratio of screen height from top of viewport that anchor must reach to display scene
	) {
		this.activationRatio = activationRatio;

		if (!this.#validateActivationRatio(this.activationRatio)) {
			throw new Error(`Invalid activation ratio: ${this.activationRatio}`);
		}

		// find scene-data anchors
		document.querySelectorAll('.scene-marker[data-scene]').forEach((el) => {
			this.anchors.push(el);
			this.anchorPaths.push(el.dataset.scene);
		});
		if (!this.anchors.length) {
			throw new Error('No scene anchors found in document.');
		}
		this.images = new ScenePaths(this.anchorPaths);
	}

	/**
	 * Records each anchor's offset from the top of the document.
	 *
	 * Call before the first sceneForScroll(), and again whenever layout
	 * may have moved the anchors (resize, webfont load). Rects are read
	 * before scrollY because the layout they force can move the scroll
	 * position, e.g. when the browser restores it on reload.
	 */
	measure() {
		const tops = this.anchors.map((el) => el.getBoundingClientRect().top);
		const scroll = window.scrollY;
		this.offsets = tops.map((t) => t + scroll);
	}

	/**
	 * Returns the image src of the scene for the current scroll position.
	 *
	 * Above the first anchor (the title block), this returns the first anchor's scene.
	 * At the bottom of the page, it returns the last anchor's scene,
	 * even if that anchor never reaches the activation line.
	 * Uses offsets from the last measure(); throws if never measured.
	 */
	sceneForScroll() {
		if (this.offsets.length !== this.anchors.length) {
			throw new Error('Anchors and offsets have different lengths. Must call .measure() before .sceneForScroll()');
		}

		const bottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
		if (bottom) return this.anchorPaths[this.anchors.length - 1];

		const line = window.scrollY + window.innerHeight * this.activationRatio;

		// The last anchor that has crossed the line; above them all, the first scene.
		const index = Math.max(0, this.offsets.findLastIndex((top) => top <= line));
		return this.anchorPaths[index];
	}

	#validateActivationRatio(n) {
		return Number.isFinite(n) && n >= 0 && n <= 1;
	}
}
