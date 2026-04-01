export var LINEAR_SRGB_LUMINANCE_WEIGHTS = {
	r: 0.21263900587151027,
	g: 0.7151686787677559,
	b: 0.07219231536073371
};

export var LINEAR_DISPLAY_P3_LUMINANCE_WEIGHTS = {
	r: 0.2289745640697488,
	g: 0.6917385218365064,
	b: 0.079286914093745
};

var LINEAR_SRGB_TO_XYZ_D65 = [
	[0.41239079926595934, 0.35758433938387796, 0.1804807884018343],
	[0.21263900587151027, 0.7151686787677559, 0.07219231536073371],
	[0.01933081871559185, 0.11919477979462599, 0.9505321522496607]
];

var XYZ_D65_TO_LINEAR_SRGB = [
	[3.240969941904521, -1.537383177570093, -0.498610760293],
	[-0.96924363628087, 1.87596750150772, 0.041555057407175],
	[0.055630079696993, -0.20397695888897, 1.056971514242878]
];

var LINEAR_DISPLAY_P3_TO_XYZ_D65 = [
	[0.4865709486482162, 0.26566769316909306, 0.1982172852343625],
	[0.2289745640697488, 0.6917385218365064, 0.079286914093745],
	[0, 0.04511338185890264, 1.043944368900976]
];

var XYZ_D65_TO_LINEAR_DISPLAY_P3 = [
	[2.493496911941425, -0.931383617919124, -0.402710784450716],
	[-0.829488969561574, 1.762664060318346, 0.023624685841943],
	[0.035845830243784, -0.076172389268041, 0.956884524007687]
];

export function clampValue(value, minValue, maxValue) {
	return Math.min(Math.max(value, minValue), maxValue);
}

export function clampColor(color, minValue, maxValue) {
	return {
		r: clampValue(color.r, minValue, maxValue),
		g: clampValue(color.g, minValue, maxValue),
		b: clampValue(color.b, minValue, maxValue)
	};
}

export function scaleColor(color, scalar) {
	return {
		r: color.r * scalar,
		g: color.g * scalar,
		b: color.b * scalar
	};
}

export function dotColor(color, weights) {
	return (color.r * weights.r) + (color.g * weights.g) + (color.b * weights.b);
}

export function isColorWithinRange(color, minValue, maxValue) {
	return color.r >= minValue && color.r <= maxValue &&
		color.g >= minValue && color.g <= maxValue &&
		color.b >= minValue && color.b <= maxValue;
}

export function colorsEqual(colorA, colorB, epsilon) {
	var threshold = epsilon || 1e-6;

	return Math.abs(colorA.r - colorB.r) <= threshold &&
		Math.abs(colorA.g - colorB.g) <= threshold &&
		Math.abs(colorA.b - colorB.b) <= threshold;
}

export function encodedSrgbToLinearSrgb(color) {
	return {
		r: srgbChannelToLinear(color.r),
		g: srgbChannelToLinear(color.g),
		b: srgbChannelToLinear(color.b)
	};
}

export function linearSrgbToEncodedSrgb(color) {
	return {
		r: linearChannelToSrgb(color.r),
		g: linearChannelToSrgb(color.g),
		b: linearChannelToSrgb(color.b)
	};
}

export function linearSrgbToXyz(color) {
	return applyMatrix(LINEAR_SRGB_TO_XYZ_D65, color);
}

export function xyzToLinearSrgb(color) {
	return applyMatrix(XYZ_D65_TO_LINEAR_SRGB, color);
}

export function linearDisplayP3ToXyz(color) {
	return applyMatrix(LINEAR_DISPLAY_P3_TO_XYZ_D65, color);
}

export function xyzToLinearDisplayP3(color) {
	return applyMatrix(XYZ_D65_TO_LINEAR_DISPLAY_P3, color);
}

export function linearSrgbToLinearDisplayP3(color) {
	return xyzToLinearDisplayP3(linearSrgbToXyz(color));
}

export function linearDisplayP3ToLinearSrgb(color) {
	return xyzToLinearSrgb(linearDisplayP3ToXyz(color));
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

function applyMatrix(matrix, color) {
	return {
		r: (matrix[0][0] * color.r) + (matrix[0][1] * color.g) + (matrix[0][2] * color.b),
		g: (matrix[1][0] * color.r) + (matrix[1][1] * color.g) + (matrix[1][2] * color.b),
		b: (matrix[2][0] * color.r) + (matrix[2][1] * color.g) + (matrix[2][2] * color.b)
	};
}
