import { OUTPUT_PROFILES, RENDERER_IDS, RENDERER_ORDER } from "./types.js";

export function selectRenderer(capabilities) {
	var reasons = capabilities.reasons.slice();
	var orderedRenderers = RENDERER_ORDER.slice();
	var forcedRenderer = capabilities.forcedRenderer;
	var selectedRenderer = RENDERER_IDS.SDR_CSS;

	if (forcedRenderer) {
		if (orderedRenderers.indexOf(forcedRenderer) !== -1) {
			reasons.push("renderer forced via query parameter: " + forcedRenderer);
			selectedRenderer = forcedRenderer;
		} else {
			reasons.push("unknown forced renderer ignored: " + forcedRenderer);
		}
	} else if (capabilities.webGpuHdrSupported) {
		selectedRenderer = RENDERER_IDS.WEBGPU_HDR;
		reasons.push("selected webgpu-hdr: hdr media query and hdr canvas configure probe succeeded");
	} else if (capabilities.ultraHdrPathAllowed) {
		selectedRenderer = RENDERER_IDS.ULTRAHDR_IMAGE;
		reasons.push("selected ultrahdr-image fallback");
	} else {
		reasons.push("selected sdr-css fallback");
	}

	return {
		selectedRenderer: selectedRenderer,
		orderedRenderers: buildAttemptOrder(selectedRenderer),
		outputProfile: getOutputProfileForRenderer(selectedRenderer, capabilities),
		reasons: reasons
	};
}

export function getOutputProfileForRenderer(rendererId, capabilities) {
	if (rendererId === RENDERER_IDS.WEBGPU_HDR && capabilities.webGpuHdrSupported) {
		return OUTPUT_PROFILES.HDR_P3;
	}

	return OUTPUT_PROFILES.SDR_SRGB;
}

function buildAttemptOrder(selectedRenderer) {
	var selectedIndex = RENDERER_ORDER.indexOf(selectedRenderer);

	if (selectedIndex === -1) {
		return RENDERER_ORDER.slice();
	}

	return RENDERER_ORDER.slice(selectedIndex);
}
