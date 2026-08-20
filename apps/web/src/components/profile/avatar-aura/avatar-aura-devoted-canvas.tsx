"use client";

import { useEffect, useRef } from "react";

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
	vUv = aPos * 0.5 + 0.5;
	gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

/**
 * Chromatic reel — RGB split radiating from the cursor plus iridescent
 * value-noise grain screened over the portrait.
 */
const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uSampler;
uniform vec2 uMouse;
uniform float uTime;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(
		mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
		mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
		f.y
	);
}

void main() {
	vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
	vec2 fromMouse = uv - uMouse;
	float dist = length(fromMouse);
	float pull = smoothstep(0.62, 0.0, dist) * 0.032;

	float r = texture2D(uSampler, uv + fromMouse * pull * 1.15).r;
	float g = texture2D(uSampler, uv).g;
	float b = texture2D(uSampler, uv - fromMouse * pull * 1.15).b;

	float grain = noise(uv * 110.0 + uTime * 1.1);
	vec3 iridescent = 0.5 + 0.5 * cos(6.2831 * (grain + uTime * 0.08) + vec3(0.0, 2.1, 4.2));
	vec3 color = vec3(r, g, b) + iridescent * grain * 0.18;

	// Prismatic rim bloom — stronger at portrait edge, follows cursor angle.
	float edge = smoothstep(0.28, 0.52, length(uv - 0.5));
	float angle = atan(fromMouse.y, fromMouse.x);
	vec3 rim = 0.5 + 0.5 * cos(angle * 2.0 + uTime * 0.6 + vec3(0.0, 2.4, 4.8));
	color += rim * edge * 0.22;

	gl_FragColor = vec4(color, 1.0);
}
`;

export function AvatarAuraDevotedCanvas({
	onWebglFailed,
}: {
	onWebglFailed: () => void;
}) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const failedRef = useRef(onWebglFailed);
	failedRef.current = onWebglFailed;

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		// The portrait <img> is a sibling inside the same clipped circle.
		const image = canvas.parentElement?.querySelector("img");
		if (!(image instanceof HTMLImageElement) || !image.complete) {
			failedRef.current();
			return;
		}

		const gl = canvas.getContext("webgl", {
			alpha: true,
			antialias: false,
			preserveDrawingBuffer: false,
		});
		if (!gl) {
			failedRef.current();
			return;
		}

		let raf = 0;
		const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

		try {
			const compile = (type: number, src: string) => {
				const shader = gl.createShader(type);
				if (!shader) throw new Error("shader alloc failed");
				gl.shaderSource(shader, src);
				gl.compileShader(shader);
				if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
					throw new Error(gl.getShaderInfoLog(shader) ?? "compile failed");
				}
				return shader;
			};
			const program = gl.createProgram();
			if (!program) throw new Error("program alloc failed");
			gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
			gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
			gl.linkProgram(program);
			if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
				throw new Error(gl.getProgramInfoLog(program) ?? "link failed");
			}
			// biome-ignore lint/correctness/useHookAtTopLevel: WebGL API — not a React hook
			gl.useProgram(program);

			const quad = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, quad);
			gl.bufferData(
				gl.ARRAY_BUFFER,
				new Float32Array([-1, -1, 3, -1, -1, 3]),
				gl.STATIC_DRAW,
			);
			const aPos = gl.getAttribLocation(program, "aPos");
			gl.enableVertexAttribArray(aPos);
			gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

			const texture = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			// Throws on cross-origin-tainted images → CSS holo fallback.
			gl.texImage2D(
				gl.TEXTURE_2D,
				0,
				gl.RGBA,
				gl.RGBA,
				gl.UNSIGNED_BYTE,
				image,
			);

			const size = canvas.parentElement?.getBoundingClientRect();
			const dpr = Math.min(window.devicePixelRatio || 1, 2);
			canvas.width = Math.max(1, Math.round((size?.width ?? 72) * dpr));
			canvas.height = Math.max(1, Math.round((size?.height ?? 72) * dpr));
			gl.viewport(0, 0, canvas.width, canvas.height);

			const uMouse = gl.getUniformLocation(program, "uMouse");
			const uTime = gl.getUniformLocation(program, "uTime");
			const start = performance.now();

			const onPointerMove = (event: PointerEvent) => {
				const rect = canvas.getBoundingClientRect();
				mouse.tx = (event.clientX - rect.left) / rect.width;
				mouse.ty = (event.clientY - rect.top) / rect.height;
			};
			window.addEventListener("pointermove", onPointerMove, { passive: true });

			const onContextLost = (event: Event) => {
				event.preventDefault();
				failedRef.current();
			};
			canvas.addEventListener("webglcontextlost", onContextLost);

			const frame = () => {
				// Lerp toward the cursor for a trailing, filmic response.
				mouse.x += (mouse.tx - mouse.x) * 0.12;
				mouse.y += (mouse.ty - mouse.y) * 0.12;
				gl.uniform2f(uMouse, mouse.x, mouse.y);
				gl.uniform1f(uTime, (performance.now() - start) / 1000);
				gl.drawArrays(gl.TRIANGLES, 0, 3);
				raf = requestAnimationFrame(frame);
			};
			raf = requestAnimationFrame(frame);

			return () => {
				cancelAnimationFrame(raf);
				window.removeEventListener("pointermove", onPointerMove);
				canvas.removeEventListener("webglcontextlost", onContextLost);
				gl.getExtension("WEBGL_lose_context")?.loseContext();
			};
		} catch {
			failedRef.current();
			return () => cancelAnimationFrame(raf);
		}
	}, []);

	return (
		<canvas
			ref={canvasRef}
			aria-hidden
			className="pointer-events-none absolute inset-0 size-full rounded-full"
		/>
	);
}
