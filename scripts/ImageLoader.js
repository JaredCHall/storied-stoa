import { ScenePaths } from './ScenePaths.js';

/**
 * Loads and caches scene images so each is fetched and decoded only once.
 *
 * load() returns a src's cache entry, creating it on first call: an Image
 * element and a `ready` promise that resolves true when decoded, false on
 * failure. The promise never rejects, so callers can await it without
 * try/catch. Only registered paths can be loaded; an unknown src throws.
 * load() is the urgent path: it starts at once, outside the queue.
 *
 * Background preloading runs through a queue, one image at a time.
 * preloadFrom() and preloadForwardFrom() build common orders for it.
 * Reordering does not cancel an image already in flight: it finishes
 * before the new front of the queue begins.
 */
export class ImageLoader {
	paths; // registered image paths, deduplicated, in document order
	loads = new Map(); // src → { img, ready }

	#pending = []; // srcs waiting to preload, front first
	#running = false; // true while #drain() is working through #pending

	constructor(scenePaths) {
		if (!(scenePaths instanceof ScenePaths)) throw new Error('scenePaths must be instance of ScenePaths');
		this.paths = scenePaths.all(); // One entry per image, even if several passages share it.
	}

	/**
	 * Returns the cache entry for src, starting its load if needed.
	 * @param {string} src
	 * @returns {{ img: HTMLImageElement, ready: Promise<boolean> }}
	 */
	load(src) {
		let entry = this.loads.get(src);
		if (!entry) {
			if (!this.paths.includes(src)) throw new Error(`Image not registered with ImageLoader: ${src}`);
			const img = new Image();
			img.src = src;
			entry = {
				img,
				ready: img.decode().then(
					() => true,
					() => {
						this.loads.delete(src);
						return false;
					}, // failed: next load() starts fresh
				),
			};
			this.loads.set(src, entry);
		}
		return entry;
	}

	/**
	 * Queues every registered image nearest to src first;
	 * on a tie, the later scene goes first. For reading.
	 */
	preloadFrom(src) {
		const start = this.#indexOf(src);
		const order = this.paths.map((_, i) => i)
			.sort((a, b) => Math.abs(a - start) - Math.abs(b - start) || b - a);
		this.#prioritize(order.map((i) => this.paths[i]));
	}

	/**
	 * Queues every registered image in document order starting after src,
	 * wrapping past the end, src itself last. For the gallery slideshow.
	 */
	preloadForwardFrom(src) {
		const start = this.#indexOf(src);
		const n = this.paths.length;
		const order = Array.from({ length: n }, (_, k) => this.paths[(start + 1 + k) % n]);
		this.#prioritize(order);
	}

	/**
	 * Replaces the preload queue with the given order and starts the worker if it is idle.
	 */
	#prioritize(order) {
		this.#pending = [...order];
		if (!this.#running) void this.#drain();
	}

	/** Works through #pending one image at a time, rereading it each step so reorders take effect. */
	async #drain() {
		this.#running = true;
		try {
			while (this.#pending.length) {
				await this.load(this.#pending.shift()).ready;
			}
		} finally {
			this.#running = false;
		}
	}

	#indexOf(src) {
		const i = this.paths.indexOf(src);
		if (i < 0) throw new Error(`Unknown image ${src}`);
		return i;
	}
}
