import { OUTPUT_PROFILES, RENDERER_IDS } from "./types.js";

export async function getRenderCapabilities(options) {
	var reasons = [];
	var reportsHighDynamicRange = false;
	var forceRenderer = options.forceRenderer || null;
	var hasWebGpu = !!navigator.gpu;
	var supportsDisplayP3Canvas = !!(window.CSS && window.CSS.supports && window.CSS.supports("color", "color(display-p3 1 1 1)"));
	var supportsExtendedToneMapping = false;
	var webGpuHdrSupported = false;
	var ultraHdrPathAllowed = false;

	try {
		reportsHighDynamicRange = !!(window.matchMedia && window.matchMedia("(dynamic-range: high)").matches);
	} catch (error) {
		reasons.push("dynamic-range media query probe failed: " + error.message);
	}

	if (hasWebGpu) {
		try {
			var adapter = await navigator.gpu.requestAdapter();
			if (adapter) {
				var device = await adapter.requestDevice();
				var canvas = document.createElement("canvas");
				var context = canvas.getContext("webgpu");

				if (context) {
					context.configure({
						device: device,
						format: "rgba16float",
						alphaMode: "opaque",
						colorSpace: "display-p3",
						toneMapping: {
							mode: "extended"
						}
					});
					context.unconfigure();
					supportsExtendedToneMapping = true;
					supportsDisplayP3Canvas = true;
					webGpuHdrSupported = true;
				} else {
					reasons.push("webgpu context unavailable");
				}
			} else {
				reasons.push("webgpu adapter unavailable");
			}
		} catch (error) {
			reasons.push("webgpu hdr probe failed: " + error.message);
		}
	} else {
		reasons.push("navigator.gpu unavailable");
	}

	if (!reportsHighDynamicRange) {
		reasons.push("display/browser did not report dynamic-range: high");
	}

	if (window.HTMLImageElement && "decoding" in HTMLImageElement.prototype) {
		ultraHdrPathAllowed = false;
		reasons.push("ultrahdr-image renderer is a placeholder fallback in this build");
	}

	return {
		reportsHighDynamicRange: reportsHighDynamicRange,
		hasWebGpu: hasWebGpu,
		supportsDisplayP3Canvas: supportsDisplayP3Canvas,
		supportsExtendedToneMapping: supportsExtendedToneMapping,
		webGpuHdrSupported: webGpuHdrSupported && reportsHighDynamicRange,
		ultraHdrPathAllowed: ultraHdrPathAllowed,
		outputProfile: webGpuHdrSupported && reportsHighDynamicRange ? OUTPUT_PROFILES.HDR_P3 : OUTPUT_PROFILES.SDR_SRGB,
		selectedRenderer: RENDERER_IDS.SDR_CSS,
		forcedRenderer: forceRenderer,
		reasons: reasons
	};
}
