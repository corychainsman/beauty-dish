import { RENDERER_IDS } from "./types.js";

var WGSL_SOURCE = [
	"struct Uniforms {",
	"  color : vec4f,",
	"  viewport : vec2f,",
	"};",
	"@group(0) @binding(0) var<uniform> uniforms : Uniforms;",
	"@vertex",
	"fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> @builtin(position) vec4f {",
	"  var positions = array<vec2f, 3>(",
	"    vec2f(-1.0, -3.0),",
	"    vec2f(-1.0, 1.0),",
	"    vec2f(3.0, 1.0)",
	"  );",
	"  let position = positions[vertexIndex];",
	"  return vec4f(position, 0.0, 1.0);",
	"}",
	"@fragment",
	"fn fragmentMain() -> @location(0) vec4f {",
	"  return uniforms.color;",
	"}"
].join("\n");

export class WebGpuHdrRenderer {
	constructor() {
		this.id = RENDERER_IDS.WEBGPU_HDR;
		this.container = null;
		this.canvas = null;
		this.context = null;
		this.device = null;
		this.pipeline = null;
		this.uniformBuffer = null;
		this.bindGroup = null;
		this.presentationFormat = "rgba16float";
	}

	async init(container) {
		this.container = container;
		this.canvas = document.createElement("canvas");
		this.canvas.className = "dishCanvas";
		this.canvas.setAttribute("aria-hidden", "true");
		this.container.classList.add("dish--canvas");
		this.container.appendChild(this.canvas);

		var adapter = await navigator.gpu.requestAdapter();
		if (!adapter) {
			throw new Error("WebGPU adapter unavailable");
		}

		this.device = await adapter.requestDevice();
		this.context = this.canvas.getContext("webgpu");
		if (!this.context) {
			throw new Error("WebGPU canvas context unavailable");
		}

		this.context.configure({
			device: this.device,
			format: this.presentationFormat,
			alphaMode: "opaque",
			colorSpace: "display-p3",
			toneMapping: {
				mode: "extended"
			}
		});

		this.uniformBuffer = this.device.createBuffer({
			label: "beauty-dish uniforms",
			size: 32,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		});

		var shaderModule = this.device.createShaderModule({
			code: WGSL_SOURCE
		});

		this.pipeline = this.device.createRenderPipeline({
			label: "beauty-dish pipeline",
			layout: "auto",
			vertex: {
				module: shaderModule,
				entryPoint: "vertexMain"
			},
			fragment: {
				module: shaderModule,
				entryPoint: "fragmentMain",
				targets: [{
					format: this.presentationFormat
				}]
			},
			primitive: {
				topology: "triangle-list"
			}
		});

		this.bindGroup = this.device.createBindGroup({
			layout: this.pipeline.getBindGroupLayout(0),
			entries: [{
				binding: 0,
				resource: {
					buffer: this.uniformBuffer
				}
			}]
		});
	}

	render(state) {
		var linearData = new Float32Array([
			state.baseColor.r * state.hdrIntensity,
			state.baseColor.g * state.hdrIntensity,
			state.baseColor.b * state.hdrIntensity,
			1,
			state.viewportWidth,
			state.viewportHeight,
			0,
			0
		]);

		this.device.queue.writeBuffer(this.uniformBuffer, 0, linearData);

		var commandEncoder = this.device.createCommandEncoder();
		var renderPass = commandEncoder.beginRenderPass({
			colorAttachments: [{
				view: this.context.getCurrentTexture().createView(),
				loadOp: "clear",
				storeOp: "store",
				clearValue: { r: 0, g: 0, b: 0, a: 1 }
			}]
		});

		renderPass.setPipeline(this.pipeline);
		renderPass.setBindGroup(0, this.bindGroup);
		renderPass.draw(3);
		renderPass.end();

		this.device.queue.submit([commandEncoder.finish()]);
	}

	resize(width, height) {
		var devicePixelRatio = window.devicePixelRatio || 1;
		this.canvas.width = Math.max(1, Math.round(width * devicePixelRatio));
		this.canvas.height = Math.max(1, Math.round(height * devicePixelRatio));
		this.canvas.style.width = width + "px";
		this.canvas.style.height = height + "px";
	}

	destroy() {
		if (this.context) {
			try {
				this.context.unconfigure();
			} catch (error) {
				console.warn("WebGPU context cleanup failed", error);
			}
		}
		if (this.canvas && this.canvas.parentNode) {
			this.canvas.parentNode.removeChild(this.canvas);
		}
		if (this.container) {
			this.container.classList.remove("dish--canvas");
		}
	}
}
