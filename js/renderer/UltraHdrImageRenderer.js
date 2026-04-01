import { RENDERER_IDS } from "./types.js";
import { getDisplayableCssColor } from "../utils/color.js";

export class UltraHdrImageRenderer {
	constructor() {
		this.id = RENDERER_IDS.ULTRAHDR_IMAGE;
		this.container = null;
		this.image = null;
		this.pendingFrame = null;
	}

	async init(container) {
		this.container = container;
		this.image = document.createElement("img");
		this.image.alt = "";
		this.image.className = "dishImage";
		this.image.decoding = "async";
		this.image.setAttribute("aria-hidden", "true");
		this.container.classList.add("dish--image");
		this.container.appendChild(this.image);
	}

	render(state) {
		var cssColor = getDisplayableCssColor(state.baseColorObject, state.hdrIntensity);

		clearTimeout(this.pendingFrame);
		this.pendingFrame = window.setTimeout(() => {
			var svg = [
				"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 2 2' preserveAspectRatio='none'>",
				"<rect width='2' height='2' fill='" + cssColor + "' />",
				"</svg>"
			].join("");
			this.image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
		}, 90);
	}

	resize() {}

	destroy() {
		clearTimeout(this.pendingFrame);
		if (this.image && this.image.parentNode) {
			this.image.parentNode.removeChild(this.image);
		}
		this.container.classList.remove("dish--image");
	}
}
