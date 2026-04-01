import { RenderController } from "./app/renderController.js";
import { clampBrightnessLevel, getHdrIntensity, toLinearNormalizedColor } from "./utils/color.js";
import { createDebugReporter } from "./utils/debug.js";

var dish = document.getElementById("dish");
var slider = document.getElementById("slider");
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
var brightnessLevel = 100;
var BRIGHTNESS_STEP = 5;
var dishBaseColor = window.chroma.temperature(parseInt(slider.value || slider.min, 10));
var searchParams = new URLSearchParams(window.location.search);
var debugReporter = createDebugReporter(searchParams.get("debugHDR") === "1");
var renderController = new RenderController(dish, debugReporter, {
	forceRenderer: searchParams.get("renderer")
});
var currentCapabilities = {
	reportsHighDynamicRange: false
};

output.innerHTML = slider.value;
code_output.innerHTML = eval(code.value);
updateThumbnail();

renderController.init(getRenderState())
	.then(function(capabilities) {
		currentCapabilities = capabilities;
		applyRenderState();
	})
	.catch(function(error) {
		console.error("Renderer initialization failed", error);
		brightnessStatus.innerHTML = "Brightness ➡️ " + brightnessLevel + "% (renderer init failed)";
	});

slider.oninput = function(){
	updateColor(slider.value);
};

slider.ondblclick = function(){
	sliderReset();
};


document.addEventListener("keydown", function (event) {
	if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
		return;
	}

	if (event.target === code) {
		return;
	}

	var min = parseInt(slider.min);
	var max = parseInt(slider.max);
	var rangeStep = Math.round((max - min) * 0.1);
	var value = parseInt(slider.value);
	var nextValue = event.key === "ArrowRight" ? value + rangeStep : value - rangeStep;
	nextValue = Math.min(max, Math.max(min, nextValue));

	event.preventDefault();
	slider.value = nextValue;
	updateColor(nextValue);
});

toggleAdvanced.onclick = function() {
	advanced.classList.toggle("hidden");
	return false;
};

hdrToggle.onchange = function() {
	applyRenderState();
};

code.oninput = function(){
	code_output.innerHTML = eval(code.value);
	updateThumbnail();
};

code.onkeydown = function(e){
   if(e.keyCode == 13 && e.metaKey){
     submit.click();
   }
};

submit.onclick = function(){
	if (window.chroma.valid(thumbnail.style.background)) {
		dishBaseColor = window.chroma(thumbnail.style.background);
		applyRenderState();
	}
	slider.value = (parseInt(slider.min) + parseInt(slider.max))/2;
	output.innerHTML = "N/A";
};

var videoContainer = document.getElementById("videoContainer");
var video = document.getElementById("videoElement");
webcamPreview.onclick = function (){
	if (navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices
    .getUserMedia({ video: {facingMode: 'user'}, audio: false })
		.then(function(stream) {
      webcamPreview.classList.add("hidden");
      video.srcObject = stream;
      videoContainer.classList.remove("hidden");
		})
		.catch(function (error) {
			console.log("Something went wrong with the webcam preview: "+ error);
		});
	}
};

window.addEventListener("keydown", function(event) {
	if (event.key === "ArrowUp") {
		event.preventDefault();
		changeBrightness(BRIGHTNESS_STEP);
	}

	if (event.key === "ArrowDown") {
		event.preventDefault();
		changeBrightness(-BRIGHTNESS_STEP);
	}
});

window.dragMoveListener = dragMoveListener;

interact('#videoContainer')
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
		top   : '#resizeWebcamPreview',
		right : '#resizeWebcamPreview'
	  },
    modifiers: [
      // keep the edges inside the parent
      interact.modifiers.restrictEdges({
        outer: 'parent',
        endOnly: true,
      })
    ],
    inertia: false
  })
  .on('resizemove', function (event) {
    var target = event.target,
        x = (parseFloat(target.getAttribute('data-x')) || 0),
        y = (parseFloat(target.getAttribute('data-y')) || 0);

    // update the element's style
    target.style.width  = event.rect.width + 'px';
    target.style.height = event.rect.height + 'px';

    // translate when resizing from top or left edges
    x += event.deltaRect.left;
    y += event.deltaRect.bottom;

    target.style.webkitTransform = target.style.transform =
        'translate(' + x + 'px,' + y + 'px)';

    target.setAttribute('data-x', x);
    target.setAttribute('data-y', y);
    // target.textContent = Math.round(event.rect.width) + '\u00D7' + Math.round(event.rect.height);
  });

  function dragMoveListener (event) {
    var target = event.target,
        // keep the dragged position in the data-x/data-y attributes
        x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx,
        y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

    // translate the element
    target.style.webkitTransform =
    target.style.transform =
      'translate(' + x + 'px, ' + y + 'px)';

    // update the posiion attributes
    target.setAttribute('data-x', x);
    target.setAttribute('data-y', y);
  }

function updateColor(value) {
	output.innerHTML = value;
	dishBaseColor = window.chroma.temperature(parseInt(value, 10));
	applyRenderState();
	return;
}

function sliderReset() {
		slider.value = (parseInt(slider.min) + parseInt(slider.max))/2;
	updateColor(slider.value);
}

function updateThumbnail() {
	thumbnail.style.background = code_output.innerHTML;
}

function changeBrightness(delta) {
	brightnessLevel += delta;
	applyRenderState();
}

function getRenderState() {
	var hdrRequested = hdrToggle.checked;
	var hdrSupported = !!currentCapabilities.reportsHighDynamicRange;
	var clampedBrightness = clampBrightnessLevel(brightnessLevel, hdrRequested, hdrSupported);

	brightnessLevel = clampedBrightness;

	return {
		baseColorObject: dishBaseColor,
		baseColor: toLinearNormalizedColor(dishBaseColor),
		baseColorCss: dishBaseColor.css(),
		brightnessLevel: clampedBrightness,
		hdrRequested: hdrRequested,
		hdrSupported: hdrSupported,
		hdrIntensity: hdrRequested ? getHdrIntensity(clampedBrightness) : Math.min(clampedBrightness, 100) / 100,
		viewportWidth: window.innerWidth,
		viewportHeight: window.innerHeight
	};
}

function applyRenderState() {
	var state = getRenderState();
	var hdrState = state.hdrRequested ? (state.hdrSupported ? "HDR on" : "HDR requested (unsupported)") : "HDR off";

	if (renderController.currentRenderer) {
		renderController.resize(state.viewportWidth, state.viewportHeight);
		renderController.render(state);
	}

	debugReporter.update({
		brightness: state.brightnessLevel + "%",
		hdrIntensity: state.hdrIntensity.toFixed(2),
		baseColor: state.baseColorCss
	});

	brightnessStatus.innerHTML = "Brightness ➡️ " + state.brightnessLevel + "% (" + hdrState + ")";
}

window.addEventListener("resize", function() {
	applyRenderState();
});

window.addEventListener("orientationchange", function() {
	applyRenderState();
});
