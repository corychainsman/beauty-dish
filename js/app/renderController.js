import { getRenderCapabilities } from "../renderer/capabilities.js";
import { getOutputProfileForRenderer, selectRenderer } from "../renderer/selectRenderer.js";
import { WebGpuHdrRenderer } from "../renderer/WebGpuHdrRenderer.js";
import { UltraHdrImageRenderer } from "../renderer/UltraHdrImageRenderer.js";
import { SdrCssRenderer } from "../renderer/SdrCssRenderer.js";
import { RENDERER_IDS } from "../renderer/types.js";

var RENDERER_CONSTRUCTORS = {};
RENDERER_CONSTRUCTORS[RENDERER_IDS.WEBGPU_HDR] = WebGpuHdrRenderer;
RENDERER_CONSTRUCTORS[RENDERER_IDS.ULTRAHDR_IMAGE] = UltraHdrImageRenderer;
RENDERER_CONSTRUCTORS[RENDERER_IDS.SDR_CSS] = SdrCssRenderer;

export class RenderController {
	constructor(container, debugReporter, options) {
		this.container = container;
		this.debugReporter = debugReporter;
		this.options = options || {};
		this.capabilities = null;
		this.currentRenderer = null;
		this.currentState = null;
	}

	async init(initialState) {
		var capabilities = await getRenderCapabilities(this.options);
		var selection = selectRenderer(capabilities);
		var orderedRenderers = selection.orderedRenderers;
		var reasons = selection.reasons.slice();

		capabilities.selectedRenderer = selection.selectedRenderer;
		capabilities.outputProfile = selection.outputProfile;
		capabilities.reasons = reasons;
		this.capabilities = capabilities;

		this.debugReporter.update({
			renderer: capabilities.selectedRenderer,
			outputProfile: capabilities.outputProfile,
			forcedRenderer: capabilities.forcedRenderer || "auto",
			hdrMediaQuery: capabilities.reportsHighDynamicRange,
			hasWebGpu: capabilities.hasWebGpu,
			supportsDisplayP3Canvas: capabilities.supportsDisplayP3Canvas,
			supportsExtendedToneMapping: capabilities.supportsExtendedToneMapping,
			webGpuHdrSupported: capabilities.webGpuHdrSupported,
			ultraHdrPathAllowed: capabilities.ultraHdrPathAllowed,
			reasons: reasons
		});

		for (var i = 0; i < orderedRenderers.length; i += 1) {
			var rendererId = orderedRenderers[i];

			try {
				await this.mountRenderer(rendererId, initialState);
				this.capabilities.selectedRenderer = rendererId;
				this.capabilities.outputProfile = getOutputProfileForRenderer(rendererId, this.capabilities);
				this.debugReporter.update({
					renderer: rendererId,
					outputProfile: this.capabilities.outputProfile,
					reasons: reasons
				});
				return this.capabilities;
			} catch (error) {
				reasons.push("renderer init failed for " + rendererId + ": " + error.message);
				this.debugReporter.log("renderer init failed", {
					renderer: rendererId,
					error: error
				});
			}
		}

		throw new Error("No renderer could be initialized");
	}

	async mountRenderer(rendererId, state) {
		this.destroyRenderer();

		var RendererConstructor = RENDERER_CONSTRUCTORS[rendererId];
		if (!RendererConstructor) {
			throw new Error("Unknown renderer: " + rendererId);
		}

		this.currentRenderer = new RendererConstructor();
		await this.currentRenderer.init(this.container);
		this.resize(state.viewportWidth, state.viewportHeight);
		this.render(state);
	}

	render(state) {
		this.currentState = state;
		if (!this.currentRenderer) {
			return;
		}

		this.currentRenderer.render(state);
	}

	resize(width, height) {
		if (!this.currentRenderer) {
			return;
		}

		this.currentRenderer.resize(width, height);
	}

	destroyRenderer() {
		if (this.currentRenderer) {
			this.currentRenderer.destroy();
			this.currentRenderer = null;
		}
	}
}
