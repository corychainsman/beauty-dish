export var RENDERER_IDS = {
	WEBGPU_HDR: "webgpu-hdr",
	ULTRAHDR_IMAGE: "ultrahdr-image",
	SDR_CSS: "sdr-css"
};

export var OUTPUT_PROFILES = {
	HDR_P3: "hdr-p3",
	SDR_SRGB: "sdr-srgb"
};

export var TONE_MAP_OPERATORS = {
	ACES_FIT: "aces-fit"
};

export var RENDERER_ORDER = [
	RENDERER_IDS.WEBGPU_HDR,
	RENDERER_IDS.ULTRAHDR_IMAGE,
	RENDERER_IDS.SDR_CSS
];
