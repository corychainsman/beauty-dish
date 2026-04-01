import {
	getChromaSafeRelativeLuminanceMax,
	getMinimumRelativeLuminance,
	getTemperatureGraphSample
} from "../utils/colorPipeline.js";

var SAMPLE_WIDTH = 160;
var SAMPLE_HEIGHT = 128;

export class TemperatureBrightnessGraph {
	constructor(root, options) {
		this.root = root;
		this.options = options || {};
		this.stage = root.querySelector("#temperatureBrightnessGraphStage");
		this.canvas = root.querySelector("#temperatureBrightnessGraphCanvas");
		this.handle = root.querySelector("#temperatureBrightnessGraphHandle");
		this.notice = root.querySelector("#temperatureBrightnessGraphNotice");
		this.yMaxLabel = root.querySelector("#graphYMax");
		this.yMidLabel = root.querySelector("#graphYMid");
		this.yMinLabel = root.querySelector("#graphYMin");
		this.sampleCanvas = document.createElement("canvas");
		this.sampleCanvas.width = SAMPLE_WIDTH;
		this.sampleCanvas.height = SAMPLE_HEIGHT;
		this.sampleContext = this.sampleCanvas.getContext("2d");
		this.context = this.canvas.getContext("2d");
		this.renderState = null;
		this.selection = null;
		this.boundarySamples = [];
		this.minRelativeLuminance = getMinimumRelativeLuminance();
		this.maxRelativeLuminance = 1;
		this.dragging = false;
		this.cacheKey = null;

		this.handlePointerDown = this.handlePointerDown.bind(this);
		this.handlePointerMove = this.handlePointerMove.bind(this);
		this.handlePointerUp = this.handlePointerUp.bind(this);
		this.handleDoubleClick = this.handleDoubleClick.bind(this);

		this.stage.addEventListener("pointerdown", this.handlePointerDown);
		this.stage.addEventListener("pointermove", this.handlePointerMove);
		this.stage.addEventListener("pointerup", this.handlePointerUp);
		this.stage.addEventListener("pointercancel", this.handlePointerUp);
		this.stage.addEventListener("dblclick", this.handleDoubleClick);
	}

	render(graphState) {
		var previousOutputProfile = this.renderState ? this.renderState.outputProfile : null;
		this.renderState = Object.assign({}, graphState);
		this.maxRelativeLuminance = this.computeGlobalMaxRelativeLuminance(this.renderState.outputProfile);
		this.boundarySamples = this.buildBoundarySamples();
		this.updateLabels();
		this.root.classList.toggle("temperatureBrightnessGraph--disabled", !this.renderState.enabled);
		this.notice.classList.toggle("hidden", this.renderState.enabled);
		this.notice.textContent = this.renderState.disabledReason || "";

		if (previousOutputProfile !== this.renderState.outputProfile) {
			this.cacheKey = null;
		}

		this.drawCanvas();
	}

	setSelection(selection) {
		this.selection = this.clampSelection(selection);
		this.positionHandle();
	}

	destroy() {
		this.stage.removeEventListener("pointerdown", this.handlePointerDown);
		this.stage.removeEventListener("pointermove", this.handlePointerMove);
		this.stage.removeEventListener("pointerup", this.handlePointerUp);
		this.stage.removeEventListener("pointercancel", this.handlePointerUp);
		this.stage.removeEventListener("dblclick", this.handleDoubleClick);
	}

	handlePointerDown(event) {
		if (!this.renderState) {
			return;
		}

		this.dragging = true;
		this.stage.setPointerCapture(event.pointerId);
		this.updateFromPointer(event);
	}

	handlePointerMove(event) {
		if (!this.dragging || !this.renderState) {
			return;
		}

		this.updateFromPointer(event);
	}

	handlePointerUp(event) {
		if (!this.dragging) {
			return;
		}

		this.dragging = false;

		if (event.pointerId !== undefined && this.stage.hasPointerCapture(event.pointerId)) {
			this.stage.releasePointerCapture(event.pointerId);
		}
	}

	handleDoubleClick() {
		if (this.options.onReset) {
			this.options.onReset();
		}
	}

	updateFromPointer(event) {
		var rect = this.stage.getBoundingClientRect();
		var clampedX = clampValue(event.clientX - rect.left, 0, rect.width);
		var clampedY = clampValue(event.clientY - rect.top, 0, rect.height);
		var normalizedX = rect.width > 0 ? clampedX / rect.width : 0;
		var normalizedY = rect.height > 0 ? clampedY / rect.height : 0;
		var temperatureKelvin = interpolate(this.renderState.temperatureMin, this.renderState.temperatureMax, normalizedX);
		var relativeLuminance = this.maxRelativeLuminance - (normalizedY * (this.maxRelativeLuminance - this.minRelativeLuminance));
		var selection = this.clampSelection({
			temperatureKelvin: Math.round(temperatureKelvin),
			relativeLuminance: relativeLuminance
		});

		this.selection = selection;
		this.positionHandle();

		if (this.options.onChange) {
			this.options.onChange(selection);
		}
	}

	clampSelection(selection) {
		var temperatureKelvin = clampValue(selection.temperatureKelvin, this.renderState.temperatureMin, this.renderState.temperatureMax);
		var requestedRelativeLuminance = clampValue(selection.relativeLuminance, this.minRelativeLuminance, this.maxRelativeLuminance);
		var maximumRelativeLuminance = getChromaSafeRelativeLuminanceMax(
			window.chroma.temperature(temperatureKelvin),
			this.renderState.outputProfile
		);

		return {
			temperatureKelvin: Math.round(temperatureKelvin),
			relativeLuminance: Math.min(requestedRelativeLuminance, maximumRelativeLuminance)
		};
	}

	positionHandle() {
		if (!this.selection || !this.renderState) {
			return;
		}

		var stageWidth = this.stage.clientWidth || 1;
		var stageHeight = this.stage.clientHeight || 1;
		var normalizedX = (this.selection.temperatureKelvin - this.renderState.temperatureMin) / (this.renderState.temperatureMax - this.renderState.temperatureMin);
		var normalizedY = (this.maxRelativeLuminance - this.selection.relativeLuminance) / (this.maxRelativeLuminance - this.minRelativeLuminance || 1);

		this.handle.style.left = (normalizedX * stageWidth) + "px";
		this.handle.style.top = (normalizedY * stageHeight) + "px";
	}

	updateLabels() {
		var middle = this.minRelativeLuminance + ((this.maxRelativeLuminance - this.minRelativeLuminance) / 2);
		this.yMaxLabel.textContent = formatRelativeLuminance(this.maxRelativeLuminance);
		this.yMidLabel.textContent = formatRelativeLuminance(middle);
		this.yMinLabel.textContent = formatRelativeLuminance(this.minRelativeLuminance);
	}

	drawCanvas() {
		var stageWidth = Math.max(1, Math.round(this.stage.clientWidth || 320));
		var stageHeight = Math.max(1, Math.round(this.stage.clientHeight || 256));
		var devicePixelRatio = window.devicePixelRatio || 1;
		var nextCacheKey = [
			this.renderState.outputProfile,
			stageWidth,
			stageHeight,
			devicePixelRatio
		].join(":");

		this.canvas.width = Math.max(1, Math.round(stageWidth * devicePixelRatio));
		this.canvas.height = Math.max(1, Math.round(stageHeight * devicePixelRatio));
		this.canvas.style.width = stageWidth + "px";
		this.canvas.style.height = stageHeight + "px";
		this.context.setTransform(1, 0, 0, 1, 0, 0);
		this.context.scale(devicePixelRatio, devicePixelRatio);

		if (this.cacheKey !== nextCacheKey) {
			this.redrawSampleTexture();
			this.cacheKey = nextCacheKey;
		}

		this.context.clearRect(0, 0, stageWidth, stageHeight);
		this.context.imageSmoothingEnabled = true;
		this.context.drawImage(this.sampleCanvas, 0, 0, stageWidth, stageHeight);
		this.drawUnreachableOverlay(stageWidth, stageHeight);
		this.positionHandle();
	}

	redrawSampleTexture() {
		var imageData = this.sampleContext.createImageData(SAMPLE_WIDTH, SAMPLE_HEIGHT);
		var pointer = 0;

		for (var y = 0; y < SAMPLE_HEIGHT; y += 1) {
			var relativeLuminance = this.maxRelativeLuminance - ((y / (SAMPLE_HEIGHT - 1)) * (this.maxRelativeLuminance - this.minRelativeLuminance));

			for (var x = 0; x < SAMPLE_WIDTH; x += 1) {
				var temperatureKelvin = interpolate(
					this.renderState.temperatureMin,
					this.renderState.temperatureMax,
					x / (SAMPLE_WIDTH - 1)
				);
				var sample = getTemperatureGraphSample(temperatureKelvin, relativeLuminance, this.renderState.outputProfile);
				var encoded = sample.sdrEncodedSrgb;

				imageData.data[pointer] = Math.round(encoded.r * 255);
				imageData.data[pointer + 1] = Math.round(encoded.g * 255);
				imageData.data[pointer + 2] = Math.round(encoded.b * 255);
				imageData.data[pointer + 3] = 255;
				pointer += 4;
			}
		}

		this.sampleContext.putImageData(imageData, 0, 0);
	}

	drawUnreachableOverlay(stageWidth, stageHeight) {
		if (!this.boundarySamples.length || !hasVisibleUnreachableRegion(this.boundarySamples)) {
			return;
		}

		this.context.beginPath();
		this.context.moveTo(0, 0);
		this.context.lineTo(stageWidth, 0);

		for (var index = this.boundarySamples.length - 1; index >= 0; index -= 1) {
			var sample = this.boundarySamples[index];
			this.context.lineTo(sample.x * stageWidth, sample.y * stageHeight);
		}

		this.context.closePath();
		this.context.fillStyle = "rgba(16, 20, 24, 0.28)";
		this.context.fill();

		this.context.beginPath();
		for (var boundaryIndex = 0; boundaryIndex < this.boundarySamples.length; boundaryIndex += 1) {
			var boundarySample = this.boundarySamples[boundaryIndex];

			if (boundaryIndex === 0) {
				this.context.moveTo(boundarySample.x * stageWidth, boundarySample.y * stageHeight);
			} else {
				this.context.lineTo(boundarySample.x * stageWidth, boundarySample.y * stageHeight);
			}
		}
		this.context.strokeStyle = "rgba(0, 0, 0, 0.55)";
		this.context.lineWidth = 1;
		this.context.stroke();
	}

	buildBoundarySamples() {
		var samples = [];

		for (var index = 0; index < SAMPLE_WIDTH; index += 1) {
			var normalizedX = SAMPLE_WIDTH === 1 ? 0 : index / (SAMPLE_WIDTH - 1);
			var temperatureKelvin = interpolate(this.renderState.temperatureMin, this.renderState.temperatureMax, normalizedX);
			var relativeLuminance = getChromaSafeRelativeLuminanceMax(
				window.chroma.temperature(temperatureKelvin),
				this.renderState.outputProfile
			);
			var normalizedY = (this.maxRelativeLuminance - relativeLuminance) / (this.maxRelativeLuminance - this.minRelativeLuminance || 1);

			samples.push({
				x: normalizedX,
				y: clampValue(normalizedY, 0, 1)
			});
		}

		return samples;
	}

	computeGlobalMaxRelativeLuminance(outputProfile) {
		var maximum = getChromaSafeRelativeLuminanceMax(
			window.chroma.temperature(this.renderState.temperatureMin),
			outputProfile
		);

		for (var temperatureKelvin = this.renderState.temperatureMin; temperatureKelvin <= this.renderState.temperatureMax; temperatureKelvin += 50) {
			maximum = Math.max(
				maximum,
				getChromaSafeRelativeLuminanceMax(window.chroma.temperature(temperatureKelvin), outputProfile)
			);
		}

		return maximum;
	}
}

function clampValue(value, minValue, maxValue) {
	return Math.min(Math.max(value, minValue), maxValue);
}

function interpolate(minValue, maxValue, progress) {
	return minValue + ((maxValue - minValue) * progress);
}

function formatRelativeLuminance(value) {
	return value.toFixed(2) + "x";
}

function hasVisibleUnreachableRegion(boundarySamples) {
	for (var index = 0; index < boundarySamples.length; index += 1) {
		if (boundarySamples[index].y > 0.002) {
			return true;
		}
	}

	return false;
}
