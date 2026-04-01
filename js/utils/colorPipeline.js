import { OUTPUT_PROFILES, TONE_MAP_OPERATORS } from "../renderer/types.js";
import {
	LINEAR_SRGB_LUMINANCE_WEIGHTS,
	LINEAR_DISPLAY_P3_LUMINANCE_WEIGHTS,
	clampColor,
	clampValue,
	colorsEqual,
	dotColor,
	encodedSrgbToLinearSrgb,
	isColorWithinRange,
	linearDisplayP3ToLinearSrgb,
	linearSrgbToEncodedSrgb,
	linearSrgbToLinearDisplayP3,
	scaleColor
} from "./colorTransforms.js";

var DEFAULT_PAPER_WHITE_NITS = 203;
var DEFAULT_PEAK_WHITE_NITS = 1000;
var EPSILON = 1e-6;

export function buildColorPipelineState(baseColorObject, brightnessLevel, outputProfile) {
	var uiEncodedSrgb = getUiEncodedSrgb(baseColorObject);
	var workingLinearP3 = linearSrgbToLinearDisplayP3(encodedSrgbToLinearSrgb(uiEncodedSrgb));
	var exposureStops = (brightnessLevel - 100) / 50;
	var exposureScale = Math.pow(2, exposureStops);
	var sceneLinearP3 = scaleColor(workingLinearP3, exposureScale);
	var pipelineFlags = {
		hdrShoulderApplied: false,
		hdrGamutCompressed: false,
		sdrGamutCompressed: false,
		finalSafetyClamped: false
	};
	var toneMappedLinearP3 = toneMapDisplayP3ForSdr(sceneLinearP3);
	var sdrLinearSrgb = compressSdrGamut(linearDisplayP3ToLinearSrgb(toneMappedLinearP3), pipelineFlags);
	var sdrCssColor = toCssColor(linearSrgbToEncodedSrgb(sdrLinearSrgb));
	var hdrDisplayLinearP3 = buildHdrDisplayColor(sceneLinearP3, outputProfile, sdrLinearSrgb, pipelineFlags);

	return {
		outputProfile: outputProfile,
		uiEncodedSrgb: uiEncodedSrgb,
		workingLinearP3: workingLinearP3,
		exposureStops: exposureStops,
		exposureScale: exposureScale,
		sceneLinearP3: sceneLinearP3,
		hdrDisplayLinearP3: hdrDisplayLinearP3,
		sdrLinearSrgb: sdrLinearSrgb,
		sdrCssColor: sdrCssColor,
		toneMapOperator: TONE_MAP_OPERATORS.ACES_FIT,
		paperWhiteNits: DEFAULT_PAPER_WHITE_NITS,
		peakWhiteNits: DEFAULT_PEAK_WHITE_NITS,
		pipelineFlags: pipelineFlags
	};
}

function getUiEncodedSrgb(baseColorObject) {
	var rgb = baseColorObject.rgb();

	return {
		r: rgb[0] / 255,
		g: rgb[1] / 255,
		b: rgb[2] / 255
	};
}

function toneMapDisplayP3ForSdr(sceneLinearP3) {
	var luminance = dotColor(sceneLinearP3, LINEAR_DISPLAY_P3_LUMINANCE_WEIGHTS);
	var mappedLuminance = acesFitToneMap(luminance);
	var scale = luminance > EPSILON ? mappedLuminance / luminance : 0;

	return scaleColor(sceneLinearP3, scale);
}

function compressSdrGamut(linearSrgb, pipelineFlags) {
	var compressed = compressColorTowardsAchromatic(
		linearSrgb,
		LINEAR_SRGB_LUMINANCE_WEIGHTS,
		0,
		1
	);

	if (!colorsEqual(compressed, linearSrgb)) {
		pipelineFlags.sdrGamutCompressed = true;
	}

	return safetyClamp(compressed, 0, 1, pipelineFlags);
}

function buildHdrDisplayColor(sceneLinearP3, outputProfile, sdrLinearSrgb, pipelineFlags) {
	if (outputProfile !== OUTPUT_PROFILES.HDR_P3) {
		return linearSrgbToLinearDisplayP3(sdrLinearSrgb);
	}

	var peakRatio = DEFAULT_PEAK_WHITE_NITS / DEFAULT_PAPER_WHITE_NITS;
	var luminance = dotColor(sceneLinearP3, LINEAR_DISPLAY_P3_LUMINANCE_WEIGHTS);
	var mappedLuminance = applyHdrShoulder(luminance, peakRatio);
	var scale = luminance > EPSILON ? mappedLuminance / luminance : 0;
	var shouldered = scaleColor(sceneLinearP3, scale);

	if (Math.abs(mappedLuminance - luminance) > EPSILON) {
		pipelineFlags.hdrShoulderApplied = true;
	}

	var compressed = compressColorTowardsAchromatic(
		shouldered,
		LINEAR_DISPLAY_P3_LUMINANCE_WEIGHTS,
		0,
		peakRatio
	);

	if (!colorsEqual(compressed, shouldered)) {
		pipelineFlags.hdrGamutCompressed = true;
	}

	return safetyClamp(compressed, 0, peakRatio, pipelineFlags);
}

function safetyClamp(color, minValue, maxValue, pipelineFlags) {
	var clamped = clampColor(color, minValue, maxValue);

	if (!colorsEqual(clamped, color)) {
		pipelineFlags.finalSafetyClamped = true;
	}

	return clamped;
}

function compressColorTowardsAchromatic(color, luminanceWeights, minValue, maxValue) {
	if (isColorWithinRange(color, minValue, maxValue)) {
		return color;
	}

	var luminance = dotColor(color, luminanceWeights);
	var low = 0;
	var high = 1;
	var candidate = {
		r: luminance,
		g: luminance,
		b: luminance
	};

	for (var i = 0; i < 18; i += 1) {
		var midpoint = (low + high) / 2;
		var mixed = {
			r: luminance + ((color.r - luminance) * midpoint),
			g: luminance + ((color.g - luminance) * midpoint),
			b: luminance + ((color.b - luminance) * midpoint)
		};

		if (isColorWithinRange(mixed, minValue, maxValue)) {
			low = midpoint;
			candidate = mixed;
		} else {
			high = midpoint;
		}
	}

	return candidate;
}

function acesFitToneMap(value) {
	if (value <= 0) {
		return 0;
	}

	return clampValue((value * ((2.51 * value) + 0.03)) / (value * ((2.43 * value) + 0.59) + 0.14), 0, 1);
}

function applyHdrShoulder(value, peakRatio) {
	if (value <= 1) {
		return Math.max(value, 0);
	}

	var highlight = value - 1;
	var shoulderRange = peakRatio - 1;

	return 1 + ((shoulderRange * highlight) / (shoulderRange + highlight));
}

function toCssColor(encodedSrgb) {
	return "rgb(" + [
		Math.round(clampValue(encodedSrgb.r, 0, 1) * 255),
		Math.round(clampValue(encodedSrgb.g, 0, 1) * 255),
		Math.round(clampValue(encodedSrgb.b, 0, 1) * 255)
	].join(",") + ")";
}
