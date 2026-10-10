/**
 * A collection of all unique scene image paths.
 */
export class ScenePaths {
	#paths; // one per image, document order — for loading and the slideshow

	constructor(paths) {
		if (!paths?.length) throw new Error('No scene paths provided.');
		this.#paths = Object.freeze([...new Set(paths)]);
	}

	all() {
		return this.#paths;
	}
}
