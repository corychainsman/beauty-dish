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
var HDR_CHROMA_SAFE_CHANNEL_CEILING = 1;
var EPSILON = 1e-6;

export function buildColorPipelineState(baseColorObject, brightnessLevel, outputProfile) {
	var uiEncodedSrgb = getUiEncodedSrgb(baseColorObject);
	var workingLinearP3 = linearSrgbToLinearDisplayP3(encodedSrgbToLinearSrgb(uiEncodedSrgb));
	var hdrChromaSafeScaleMax = getHdrChromaSafeScaleMax(workingLinearP3);
	var hdrChromaSafeBrightnessMax = 100 + (100 * Math.max(hdrChromaSafeScaleMax - 1, 0));
	var peakWhiteNits = DEFAULT_PAPER_WHITE_NITS * (outputProfile === OUTPUT_PROFILES.HDR_P3 ? hdrChromaSafeScaleMax : 1);
	var exposureScale = getExposureScale(brightnessLevel, outputProfile, hdrChromaSafeScaleMax);
	var exposureStops = Math.log2(Math.max(exposureScale, EPSILON));
	var sceneLinearP3 = scaleColor(workingLinearP3, exposureScale);
	var pipelineFlags = {
		hdrShoulderApplied: false,
		hdrHeadroomCapped: false,
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
		hdrChromaSafeScaleMax: hdrChromaSafeScaleMax,
		hdrChromaSafeBrightnessMax: hdrChromaSafeBrightnessMax,
		exposureStops: exposureStops,
		exposureScale: exposureScale,
		sceneLinearP3: sceneLinearP3,
		hdrDisplayLinearP3: hdrDisplayLinearP3,
		sdrLinearSrgb: sdrLinearSrgb,
		sdrCssColor: sdrCssColor,
		toneMapOperator: TONE_MAP_OPERATORS.ACES_FIT,
		paperWhiteNits: DEFAULT_PAPER_WHITE_NITS,
		peakWhiteNits: peakWhiteNits,
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

	var capped = capHdrColorPreservingChromaticity(sceneLinearP3, HDR_CHROMA_SAFE_CHANNEL_CEILING);

	if (!colorsEqual(capped, sceneLinearP3)) {
		pipelineFlags.hdrHeadroomCapped = true;
	}

	return safetyClamp(capped, 0, HDR_CHROMA_SAFE_CHANNEL_CEILING, pipelineFlags);
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

function capHdrColorPreservingChromaticity(color, peakRatio) {
	var maxChannel = Math.max(color.r, color.g, color.b);

	if (maxChannel <= peakRatio || maxChannel <= EPSILON) {
		return color;
	}

	return scaleColor(color, peakRatio / maxChannel);
}

function getHdrChromaSafeScaleMax(workingLinearP3) {
	var maxChannel = Math.max(workingLinearP3.r, workingLinearP3.g, workingLinearP3.b);

	if (maxChannel <= EPSILON) {
		return 1;
	}

	return Math.max(HDR_CHROMA_SAFE_CHANNEL_CEILING / maxChannel, 1);
}

function getExposureScale(brightnessLevel, outputProfile, hdrChromaSafeScaleMax) {
	if (brightnessLevel <= 100) {
		return Math.pow(2, (brightnessLevel - 100) / 50);
	}

	if (outputProfile !== OUTPUT_PROFILES.HDR_P3) {
		return 1;
	}

	var interpolation = (brightnessLevel - 100) / 100;

	return Math.pow(hdrChromaSafeScaleMax, interpolation);
}

function acesFitToneMap(value) {
	if (value <= 0) {
		return 0;
	}

	return clampValue((value * ((2.51 * value) + 0.03)) / (value * ((2.43 * value) + 0.59) + 0.14), 0, 1);
}

function toCssColor(encodedSrgb) {
	return "rgb(" + [
		Math.round(clampValue(encodedSrgb.r, 0, 1) * 255),
		Math.round(clampValue(encodedSrgb.g, 0, 1) * 255),
		Math.round(clampValue(encodedSrgb.b, 0, 1) * 255)
	].join(",") + ")";
}
