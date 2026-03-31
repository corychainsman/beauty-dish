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
var MIN_BRIGHTNESS = 10;
var SDR_MAX_BRIGHTNESS = 100;
var HDR_MAX_BRIGHTNESS = 200;
var BRIGHTNESS_STEP = 5;
var hdrSupported = window.matchMedia && window.matchMedia("(dynamic-range: high)").matches;

updateColor(slider.value);
code_output.innerHTML = eval(code.value);
updateThumbnail();
applyBrightness();

slider.oninput = function(){
	updateColor(slider.value);
};

slider.ondblclick = function(){
	sliderReset();
};

toggleAdvanced.onclick = function() {
	advanced.classList.toggle("hidden");
	return false;
};

hdrToggle.onchange = function() {
	applyBrightness();
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
	dish.style.background = thumbnail.style.background;
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
	dish.style.backgroundColor = chroma.temperature(value);
	return;
}

function sliderReset() {
		slider.value = (parseInt(slider.min) + parseInt(slider.max))/2;
	updateColor(slider.value);
}

function updateThumbnail() {
	thumbnail.style.background = code_output.innerHTML;
}

function getBrightnessMax() {
	if (hdrToggle.checked && hdrSupported) {
		return HDR_MAX_BRIGHTNESS;
	}

	return SDR_MAX_BRIGHTNESS;
}

function applyBrightness() {
	var maxBrightness = getBrightnessMax();
	brightnessLevel = Math.min(Math.max(brightnessLevel, MIN_BRIGHTNESS), maxBrightness);

	dish.style.filter = "brightness(" + (brightnessLevel / 100) + ")";

	var hdrState = hdrToggle.checked ? (hdrSupported ? "HDR on" : "HDR requested (unsupported)") : "HDR off";
	brightnessStatus.innerHTML = "Brightness ➡️ " + brightnessLevel + "% (" + hdrState + ")";
}

function changeBrightness(delta) {
	brightnessLevel += delta;
	applyBrightness();
}
