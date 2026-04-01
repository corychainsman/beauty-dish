import { RenderController } from "./app/renderController.js";
import { TemperatureBrightnessGraph } from "./app/temperatureBrightnessGraph.js";
import { OUTPUT_PROFILES } from "./renderer/types.js";
import {
	buildColorPipelineState,
	getChromaSafeRelativeLuminanceMax,
	getMinimumRelativeLuminance,
	getReferenceRelativeLuminance
} from "./utils/colorPipeline.js";
import { linearDisplayP3ToLinearSrgb, linearSrgbToEncodedSrgb } from "./utils/colorTransforms.js";
import { createDebugReporter } from "./utils/debug.js";

var dish = document.getElementById("dish");
var picker = document.getElementById("picker");
var pickerForegroundElements = Array.prototype.slice.call(
	picker.querySelectorAll("h3, h5, p, label, #output, #code_output, .temperatureBrightnessGraphTitle")
);
var pickerLinks = Array.prototype.slice.call(picker.querySelectorAll("a"));
var pickerMutedElements = Array.prototype.slice.call(
	picker.querySelectorAll("small, .temperatureBrightnessGraphSubtitle, .temperatureBrightnessGraphYAxis, .temperatureBrightnessGraphXAxis")
);
var output = document.getElementById("output");
var brightnessStatus = document.getElementById("brightnessStatus");
var hdrToggle = document.getElementById("hdrToggle");
var toggleAdvanced = document.getElementById("toggleAdvanced");
var advanced = document.getElementById("advanced");
var code = document.getElementById("code");
var code_output = document.getElementById("code_output");
var thumbnail = document.getElementById("thumbnail");
var submit = document.getElementById("submit");
var webcamPreview = document.getElementById("webcamPreview");
var temperatureMinimum = 3000;
var temperatureMaximum = 8000;
var selectedTemperatureKelvin = Math.round((temperatureMinimum + temperatureMaximum) / 2);
var selectedRelativeLuminance = getReferenceRelativeLuminance();
var selectionMode = "temperature-graph";
var customBaseColor = null;
var BRIGHTNESS_STEP = 5;
var searchParams = new URLSearchParams(window.location.search);
var debugReporter = createDebugReporter(searchParams.get("debugHDR") === "1");
var renderController = new RenderController(dish, debugReporter, {
	forceRenderer: searchParams.get("renderer")
});
var temperatureBrightnessGraph = new TemperatureBrightnessGraph(document.getElementById("temperatureBrightnessGraph"), {
	temperatureMin: temperatureMinimum,
	temperatureMax: temperatureMaximum,
	onChange: function(selection) {
		applyTemperatureSelection(selection.temperatureKelvin, selection.relativeLuminance);
	},
	onReset: function() {
		resetTemperatureGraphSelection();
	}
});
var currentCapabilities = {
	reportsHighDynamicRange: false,
	outputProfile: OUTPUT_PROFILES.SDR_SRGB,
	selectedRenderer: null
};

syncTemperatureControls();
code_output.innerHTML = eval(code.value);
updateThumbnail();

renderController.init(getRenderState())
	.then(function(capabilities) {
		currentCapabilities = capabilities;
		applyRenderState();
	})
	.catch(function(error) {
		console.error("Renderer initialization failed", error);
		brightnessStatus.innerHTML = "Relative brightness: " + formatRelativeLuminance(selectedRelativeLuminance) + " (renderer init failed)";
	});

document.addEventListener("keydown", function(event) {
	if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
		return;
	}

	if (event.target === code) {
		return;
	}

	var rangeStep = Math.round((temperatureMaximum - temperatureMinimum) * 0.1);
	var nextValue = event.key === "ArrowRight" ? selectedTemperatureKelvin + rangeStep : selectedTemperatureKelvin - rangeStep;

	event.preventDefault();
	applyTemperatureSelection(nextValue, selectedRelativeLuminance);
});

toggleAdvanced.onclick = function() {
	advanced.classList.toggle("hidden");
	return false;
};

hdrToggle.onchange = function() {
	selectedRelativeLuminance = clampSelectedRelativeLuminance(
		selectedRelativeLuminance,
		getCurrentBaseColorObject(),
		getUiOutputProfile()
	);
	applyRenderState();
};

code.oninput = function() {
	code_output.innerHTML = eval(code.value);
	updateThumbnail();
};

code.onkeydown = function(event) {
	if (event.keyCode === 13 && event.metaKey) {
		submit.click();
	}
};

submit.onclick = function() {
	if (window.chroma.valid(thumbnail.style.background)) {
		customBaseColor = window.chroma(thumbnail.style.background);
		selectionMode = "custom-color";
		selectedRelativeLuminance = clampSelectedRelativeLuminance(
			selectedRelativeLuminance,
			getCurrentBaseColorObject(),
			getUiOutputProfile()
		);
		refreshTemperatureOutputLabel();
		applyRenderState();
	}
};

var videoContainer = document.getElementById("videoContainer");
var video = document.getElementById("videoElement");
webcamPreview.onclick = function() {
	if (navigator.mediaDevices.getUserMedia) {
		navigator.mediaDevices
			.getUserMedia({ video: { facingMode: "user" }, audio: false })
			.then(function(stream) {
				webcamPreview.classList.add("hidden");
				video.srcObject = stream;
				videoContainer.classList.remove("hidden");
			})
			.catch(function(error) {
				console.log("Something went wrong with the webcam preview: " + error);
			});
	}
};

window.addEventListener("keydown", function(event) {
	if (event.target === code) {
		return;
	}

	if (event.key === "ArrowUp") {
		event.preventDefault();
		changeRelativeLuminance(BRIGHTNESS_STEP / 100);
	}

	if (event.key === "ArrowDown") {
		event.preventDefault();
		changeRelativeLuminance(-BRIGHTNESS_STEP / 100);
	}
});

window.dragMoveListener = dragMoveListener;

interact("#videoContainer")
	.draggable({
		onmove: window.dragMoveListener,
		modifiers: [
			interact.modifiers.restrict({
				restriction: dish,
				elementRect: { top: 0, left: 0, bottom: 1, right: 1 }
			})
		]
	})
	.resizable({
		preserveAspectRatio: true,
		edges: {
			top: "#resizeWebcamPreview",
			right: "#resizeWebcamPreview"
		},
		modifiers: [
			interact.modifiers.restrictEdges({
				outer: "parent",
				endOnly: true
			})
		],
		inertia: false
	})
	.on("resizemove", function(event) {
		var target = event.target;
		var x = (parseFloat(target.getAttribute("data-x")) || 0);
		var y = (parseFloat(target.getAttribute("data-y")) || 0);

		target.style.width = event.rect.width + "px";
		target.style.height = event.rect.height + "px";

		x += event.deltaRect.left;
		y += event.deltaRect.bottom;

		target.style.webkitTransform = target.style.transform = "translate(" + x + "px," + y + "px)";

		target.setAttribute("data-x", x);
		target.setAttribute("data-y", y);
	});

function dragMoveListener(event) {
	var target = event.target;
	var x = (parseFloat(target.getAttribute("data-x")) || 0) + event.dx;
	var y = (parseFloat(target.getAttribute("data-y")) || 0) + event.dy;

	target.style.webkitTransform = target.style.transform = "translate(" + x + "px, " + y + "px)";

	target.setAttribute("data-x", x);
	target.setAttribute("data-y", y);
}

function updateThumbnail() {
	thumbnail.style.background = code_output.innerHTML;
}

function changeRelativeLuminance(delta) {
	selectedRelativeLuminance = clampSelectedRelativeLuminance(
		selectedRelativeLuminance + delta,
		getCurrentBaseColorObject(),
		getUiOutputProfile()
	);
	applyRenderState();
}

function getRenderState() {
	var baseColorObject = getCurrentBaseColorObject();
	var outputProfile = getUiOutputProfile();
	var clampedRelativeLuminance = clampSelectedRelativeLuminance(selectedRelativeLuminance, baseColorObject, outputProfile);
	var pipelineState = buildColorPipelineState(baseColorObject, clampedRelativeLuminance, outputProfile);

	selectedRelativeLuminance = clampedRelativeLuminance;

	return Object.assign({
		baseColorObject: baseColorObject,
		baseColorCss: baseColorObject.css(),
		relativeLuminance: clampedRelativeLuminance,
		selectionMode: selectionMode,
		temperatureKelvin: selectedTemperatureKelvin,
		hdrRequested: hdrToggle.checked,
		hdrSupported: outputProfile === OUTPUT_PROFILES.HDR_P3,
		rendererOutputProfile: currentCapabilities.outputProfile,
		viewportWidth: window.innerWidth,
		viewportHeight: window.innerHeight
	}, pipelineState);
}

function applyRenderState() {
	var state = getRenderState();
	var hdrState = state.hdrRequested ? (state.hdrSupported ? "HDR on" : "HDR requested (unsupported)") : "HDR off";

	if (renderController.currentRenderer) {
		renderController.resize(state.viewportWidth, state.viewportHeight);
		renderController.render(state);
	}

	temperatureBrightnessGraph.render({
		outputProfile: state.outputProfile,
		temperatureMin: temperatureMinimum,
		temperatureMax: temperatureMaximum,
		enabled: selectionMode === "temperature-graph",
		disabledReason: selectionMode === "custom-color" ? "Custom color active. Drag in the graph to return to temperature mode." : ""
	});
	temperatureBrightnessGraph.setSelection({
		temperatureKelvin: selectedTemperatureKelvin,
		relativeLuminance: selectedRelativeLuminance
	});
	applyPickerContrastTheme(state);

	debugReporter.update({
		outputProfile: state.outputProfile,
		relativeLuminance: formatRelativeLuminance(state.relativeLuminance),
		hdrChromaSafeRelativeLuminanceMax: formatRelativeLuminance(state.hdrChromaSafeRelativeLuminanceMax),
		exposureStops: state.exposureStops.toFixed(2),
		exposureScale: state.exposureScale.toFixed(2),
		toneMapOperator: state.toneMapOperator,
		paperWhiteNits: state.paperWhiteNits,
		peakWhiteNits: state.peakWhiteNits.toFixed(1),
		baseColor: state.baseColorCss,
		workingLinearP3: formatDebugColor(state.workingLinearP3),
		sceneLinearP3: formatDebugColor(state.sceneLinearP3),
		sdrLinearSrgb: formatDebugColor(state.sdrLinearSrgb),
		hdrDisplayLinearP3: formatDebugColor(state.hdrDisplayLinearP3),
		pipelineFlags: formatDebugFlags(state.pipelineFlags)
	});

	brightnessStatus.innerHTML = "Relative brightness: " + formatRelativeLuminance(state.relativeLuminance) + " (" + hdrState + ")";
}

window.addEventListener("resize", function() {
	applyRenderState();
});

window.addEventListener("orientationchange", function() {
	applyRenderState();
});

function formatDebugColor(color) {
	return [color.r, color.g, color.b].map(function(value) {
		return value.toFixed(3);
	}).join(", ");
}

function formatDebugFlags(flags) {
	return Object.keys(flags).filter(function(key) {
		return flags[key];
	}).join(", ") || "none";
}

function getCurrentBaseColorObject() {
	if (selectionMode === "custom-color" && customBaseColor) {
		return customBaseColor;
	}

	return window.chroma.temperature(selectedTemperatureKelvin);
}

function getUiOutputProfile() {
	return hdrToggle.checked && currentCapabilities.outputProfile === OUTPUT_PROFILES.HDR_P3 ? OUTPUT_PROFILES.HDR_P3 : OUTPUT_PROFILES.SDR_SRGB;
}

function clampSelectedRelativeLuminance(nextRelativeLuminance, baseColorObject, outputProfile) {
	return Math.min(
		Math.max(nextRelativeLuminance, getMinimumRelativeLuminance()),
		getChromaSafeRelativeLuminanceMax(baseColorObject, outputProfile)
	);
}

function applyTemperatureSelection(nextTemperatureKelvin, nextRelativeLuminance) {
	selectedTemperatureKelvin = Math.round(Math.min(Math.max(nextTemperatureKelvin, temperatureMinimum), temperatureMaximum));
	selectedRelativeLuminance = nextRelativeLuminance;
	selectionMode = "temperature-graph";
	customBaseColor = null;
	syncTemperatureControls();
	selectedRelativeLuminance = clampSelectedRelativeLuminance(
		selectedRelativeLuminance,
		getCurrentBaseColorObject(),
		getUiOutputProfile()
	);
	applyRenderState();
}

function resetTemperatureGraphSelection() {
	applyTemperatureSelection(
		(temperatureMinimum + temperatureMaximum) / 2,
		getReferenceRelativeLuminance()
	);
}

function syncTemperatureControls() {
	refreshTemperatureOutputLabel();
}

function refreshTemperatureOutputLabel() {
	output.textContent = selectionMode === "custom-color" ? "Custom" : (selectedTemperatureKelvin + "K");
}

function formatRelativeLuminance(value) {
	return value.toFixed(2) + "x";
}

function applyPickerContrastTheme(state) {
	var encodedColor = state.outputProfile === OUTPUT_PROFILES.HDR_P3
		? linearSrgbToEncodedSrgb(linearDisplayP3ToLinearSrgb(state.hdrDisplayLinearP3))
		: state.sdrEncodedSrgb;
	var red = Math.round(clampUnit(encodedColor.r) * 255);
	var green = Math.round(clampUnit(encodedColor.g) * 255);
	var blue = Math.round(clampUnit(encodedColor.b) * 255);
	var perceivedBrightness = Math.sqrt(
		(0.299 * red * red) +
		(0.587 * green * green) +
		(0.114 * blue * blue)
	);
	var useLightTheme = perceivedBrightness < 160;
	var foregroundColor = useLightTheme ? "#f8fafc" : "#101418";
	var mutedColor = useLightTheme ? "rgba(248, 250, 252, .86)" : "rgba(16, 20, 24, .8)";
	var linkColor = useLightTheme ? "#cfe1ff" : "#1d4ed8";

	picker.style.color = foregroundColor;
	pickerForegroundElements.forEach(function(element) {
		element.style.color = foregroundColor;
	});
	pickerLinks.forEach(function(link) {
		link.style.color = linkColor;
	});
	pickerMutedElements.forEach(function(element) {
		element.style.color = mutedColor;
	});
}

function clampUnit(value) {
	return Math.min(Math.max(value, 0), 1);
}
