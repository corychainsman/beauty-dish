export function createDebugReporter(enabled) {
	var overlay = document.getElementById("debugOverlay");
	var state = {
		enabled: enabled,
		data: {}
	};

	if (!enabled || !overlay) {
		return {
			enabled: enabled,
			update: function() {},
			log: function() {}
		};
	}

	function render() {
		overlay.classList.remove("hidden");
		overlay.textContent = [
			"HDR Debug",
			"renderer: " + (state.data.renderer || "pending"),
			"outputProfile: " + state.data.outputProfile,
			"forcedRenderer: " + (state.data.forcedRenderer || "auto"),
			"hdrMediaQuery: " + state.data.hdrMediaQuery,
			"hasWebGpu: " + state.data.hasWebGpu,
			"supportsDisplayP3Canvas: " + state.data.supportsDisplayP3Canvas,
			"supportsExtendedToneMapping: " + state.data.supportsExtendedToneMapping,
			"webGpuHdrSupported: " + state.data.webGpuHdrSupported,
			"ultraHdrPathAllowed: " + state.data.ultraHdrPathAllowed,
			"relativeLuminance: " + state.data.relativeLuminance,
			"hdrChromaSafeRelativeLuminanceMax: " + state.data.hdrChromaSafeRelativeLuminanceMax,
			"exposureStops: " + state.data.exposureStops,
			"exposureScale: " + state.data.exposureScale,
			"toneMapOperator: " + state.data.toneMapOperator,
			"paperWhiteNits: " + state.data.paperWhiteNits,
			"peakWhiteNits: " + state.data.peakWhiteNits,
			"baseColor: " + state.data.baseColor,
			"workingLinearP3: " + state.data.workingLinearP3,
			"sceneLinearP3: " + state.data.sceneLinearP3,
			"sdrLinearSrgb: " + state.data.sdrLinearSrgb,
			"hdrDisplayLinearP3: " + state.data.hdrDisplayLinearP3,
			"pipelineFlags: " + state.data.pipelineFlags,
			"reasons: " + (state.data.reasons && state.data.reasons.length ? state.data.reasons.join(" | ") : "none")
		].join("\n");
	}

	return {
		enabled: true,
		update: function(patch) {
			state.data = Object.assign({}, state.data, patch);
			render();
		},
		log: function(message, detail) {
			console.log("[HDR Debug]", message, detail || "");
		}
	};
}
