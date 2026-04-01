import { RENDERER_IDS } from "./types.js";
import { getDisplayableCssColor } from "../utils/color.js";

export class SdrCssRenderer {
	constructor() {
		this.id = RENDERER_IDS.SDR_CSS;
		this.container = null;
	}

	async init(container) {
		this.container = container;
		this.container.classList.remove("dish--image");
		this.container.classList.remove("dish--canvas");
	}

	render(state) {
		this.container.style.backgroundColor = getDisplayableCssColor(state.baseColorObject, state.hdrIntensity);
		this.container.style.filter = "none";
	}

	resize() {}

	destroy() {}
}
