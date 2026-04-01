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
			"forcedRenderer: " + (state.data.forcedRenderer || "auto"),
			"hdrMediaQuery: " + state.data.hdrMediaQuery,
			"hasWebGpu: " + state.data.hasWebGpu,
			"webGpuHdrSupported: " + state.data.webGpuHdrSupported,
			"ultraHdrPathAllowed: " + state.data.ultraHdrPathAllowed,
			"brightness: " + state.data.brightness,
			"hdrIntensity: " + state.data.hdrIntensity,
			"baseColor: " + state.data.baseColor,
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
