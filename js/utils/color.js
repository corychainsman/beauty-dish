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

export function getHdrIntensity(brightnessLevel) {
	if (brightnessLevel <= 100) {
		return Math.max(brightnessLevel, MIN_BRIGHTNESS) / 100;
	}

	return 1 + ((brightnessLevel - 100) / 100);
}

export function getDisplayableCssColor(baseColor, hdrIntensity) {
	var linearColor = getScaledLinearColor(baseColor, hdrIntensity);

	return chromaLib([
		linearChannelToSrgb(clamp01(linearColor.r)) * 255,
		linearChannelToSrgb(clamp01(linearColor.g)) * 255,
		linearChannelToSrgb(clamp01(linearColor.b)) * 255
	]).css();
}

export function getScaledLinearColor(baseColor, hdrIntensity) {
	var linearBaseColor = toLinearNormalizedColor(baseColor);

	return {
		r: linearBaseColor.r * hdrIntensity,
		g: linearBaseColor.g * hdrIntensity,
		b: linearBaseColor.b * hdrIntensity
	};
}

export function toLinearNormalizedColor(baseColor) {
	var rgb = baseColor.rgb();
	return {
		r: srgbChannelToLinear(rgb[0] / 255),
		g: srgbChannelToLinear(rgb[1] / 255),
		b: srgbChannelToLinear(rgb[2] / 255)
	};
}

export function colorToCss(value) {
	if (!chromaLib.valid(value)) {
		return null;
	}

	return chromaLib(value).css();
}

function clamp01(value) {
	return Math.min(Math.max(value, 0), 1);
}

function srgbChannelToLinear(value) {
	if (value <= 0.04045) {
		return value / 12.92;
	}

	return Math.pow((value + 0.055) / 1.055, 2.4);
}

function linearChannelToSrgb(value) {
	if (value <= 0.0031308) {
		return value * 12.92;
	}

	return (1.055 * Math.pow(value, 1 / 2.4)) - 0.055;
}
