import { RENDERER_IDS } from "./types.js";

export async function getRenderCapabilities(options) {
	var reasons = [];
	var reportsHighDynamicRange = false;
	var forceRenderer = options.forceRenderer || null;
	var hasWebGpu = !!navigator.gpu;
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
		webGpuHdrSupported: webGpuHdrSupported && reportsHighDynamicRange,
		ultraHdrPathAllowed: ultraHdrPathAllowed,
		selectedRenderer: RENDERER_IDS.SDR_CSS,
		forcedRenderer: forceRenderer,
		reasons: reasons
	};
}
