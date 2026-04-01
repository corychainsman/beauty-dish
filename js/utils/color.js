var chromaLib = window.chroma;

var MIN_BRIGHTNESS = 10;
var SDR_MAX_BRIGHTNESS = 100;
var HDR_MAX_BRIGHTNESS = 200;

export {
	MIN_BRIGHTNESS,
	SDR_MAX_BRIGHTNESS,
	HDR_MAX_BRIGHTNESS
};

export function clampBrightnessLevel(level, hdrEnabled, hdrSupported) {
	var maxBrightness = hdrEnabled && hdrSupported ? HDR_MAX_BRIGHTNESS : SDR_MAX_BRIGHTNESS;
	return Math.min(Math.max(level, MIN_BRIGHTNESS), maxBrightness);
}

export function colorToCss(value) {
	if (!chromaLib.valid(value)) {
		return null;
	}

	return chromaLib(value).css();
}
