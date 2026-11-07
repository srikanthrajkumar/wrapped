// Draws a motif with Paper's static mesh gradient (paper-shaders.ts). One WebGL2 context serves
// every still mark: a Schedule of forty cards must not open forty, and browsers stop at about
// sixteen. Each is drawn once into the GL canvas and copied into its own 2D canvas, so nothing
// keeps running after it is drawn. The one moving mark (first launch) draws in its own context,
// frame by frame, only while it is on screen. Without WebGL2, nothing is drawn and the caller's
// surface shows.

import { MAX_COLORS, staticMeshGradientShader, vertexShader } from './paper-shaders';
import { TONES, type MotifParams, type Tone } from './seed';

const UNIFORMS = [
  'u_resolution',
  'u_pixelRatio',
  'u_originX',
  'u_originY',
  'u_worldWidth',
  'u_worldHeight',
  'u_fit',
  'u_scale',
  'u_rotation',
  'u_offsetX',
  'u_offsetY',
  'u_colors',
  'u_colorsCount',
  'u_positions',
  'u_waveX',
  'u_waveXShift',
  'u_waveY',
  'u_waveYShift',
  'u_mixing',
  'u_grainMixer',
  'u_grainOverlay',
] as const;

interface Painter {
  gl: WebGL2RenderingContext;
  at: Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;
}

let painter: Painter | null | undefined;

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

/** A painter on `canvas`; null where WebGL2 isn't available. */
function makePainter(canvas: HTMLCanvasElement): Painter | null {
  try {
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, antialias: false });
    if (!gl) return null;
    const vertex = compile(gl, gl.VERTEX_SHADER, vertexShader);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, staticMeshGradientShader);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) return null;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const at = Object.fromEntries(
      UNIFORMS.map((name) => [name, gl.getUniformLocation(program, name)]),
    );
    return { gl, at: at as Painter['at'] };
  } catch {
    return null;
  }
}

/** The shared painter for still marks, made on first use. */
function getPainter(): Painter | null {
  if (painter && !painter.gl.isContextLost()) return painter;
  if (painter === null) return null;
  painter = makePainter(document.createElement('canvas'));
  return painter;
}

type Colour = [number, number, number, number];

/** Draws the mesh into the painter's own canvas, sized `W` × `H` device pixels. */
function draw(
  { gl, at }: Painter,
  params: MotifParams,
  palette: Record<Tone, Colour>,
  W: number,
  H: number,
  ratio: number,
) {
  if (gl.canvas.width !== W || gl.canvas.height !== H) {
    gl.canvas.width = W;
    gl.canvas.height = H;
  }
  gl.viewport(0, 0, W, H);
  gl.uniform2f(at.u_resolution, W, H);
  gl.uniform1f(at.u_pixelRatio, ratio);
  gl.uniform1f(at.u_originX, 0.5);
  gl.uniform1f(at.u_originY, 0.5);
  gl.uniform1f(at.u_worldWidth, 0);
  gl.uniform1f(at.u_worldHeight, 0);
  gl.uniform1f(at.u_fit, 2); // cover: the field fills any shape, a tile or a full-width shelf
  gl.uniform1f(at.u_scale, 1);
  gl.uniform1f(at.u_rotation, params.rotation);
  gl.uniform1f(at.u_offsetX, 0);
  gl.uniform1f(at.u_offsetY, 0);
  const colors = new Float32Array(MAX_COLORS * 4);
  params.tones.slice(0, MAX_COLORS).forEach((tone, i) => colors.set(palette[tone], i * 4));
  gl.uniform4fv(at.u_colors, colors);
  gl.uniform1f(at.u_colorsCount, Math.min(params.tones.length, MAX_COLORS));
  gl.uniform1f(at.u_positions, params.positions);
  gl.uniform1f(at.u_waveX, params.waveX);
  gl.uniform1f(at.u_waveXShift, params.waveXShift);
  gl.uniform1f(at.u_waveY, params.waveY);
  gl.uniform1f(at.u_waveYShift, params.waveYShift);
  gl.uniform1f(at.u_mixing, params.mixing);
  gl.uniform1f(at.u_grainMixer, params.grainMixer);
  gl.uniform1f(at.u_grainOverlay, params.grainOverlay);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

const toneCache = new Map<string, Record<Tone, Colour>>();

/**
 * The theme's tones as GL colours, read from --motif-<tone> through a 1px canvas once per theme
 * (a Schedule's forty tiles share one read).
 */
function tones(): Record<Tone, Colour> {
  const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  const cached = toneCache.get(theme);
  if (cached) return cached;
  const style = getComputedStyle(document.documentElement);
  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  probe.canvas.width = probe.canvas.height = 1;
  const out = {} as Record<Tone, Colour>;
  for (const tone of TONES) {
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = style.getPropertyValue(`--motif-${tone}`).trim() || 'transparent';
    probe.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
    out[tone] = [r! / 255, g! / 255, b! / 255, a! / 255];
  }
  toneCache.set(theme, out);
  return out;
}

/**
 * Draws the mark into `target` at its CSS size (`width` × `height`), at up to twice the
 * screen's pixels: a soft field gains nothing beyond. `soft` is the blur as a share of the
 * shorter side: 7% for the quiet marks, less where the folds should stay sharp. Returns false
 * when it couldn't draw.
 */
export function paintMotif(
  target: HTMLCanvasElement,
  params: MotifParams,
  width: number,
  height: number,
  soft = 0.07,
): boolean {
  if (width < 1 || height < 1) return false;
  const p = getPainter();
  const context = target.getContext('2d');
  if (!p || !context) return false;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(width * ratio);
  const h = Math.round(height * ratio);
  // The mesh weighs each colour by 1/distance, which leaves a sharp point at every colour's
  // centre: a streak or a pinhole where two tones meet. A blur scaled to the mark smooths them.
  // It is a CSS filter (Safari has no canvas filter), on a field drawn larger than the mark and
  // scaled up past its box, so the blur's soft edge falls outside and the caller's overflow
  // clips it.
  const blur = Math.max(2, Math.round(Math.min(w, h) * soft));
  const pad = blur * 2;
  const W = w + pad * 2;
  const H = h + pad * 2;
  draw(p, params, tones(), W, H, ratio);
  target.width = W;
  target.height = H;
  // Copied in the same task as the draw, so the GL canvas needs no preserved buffer.
  context.drawImage(p.gl.canvas, 0, 0);
  target.style.filter = `blur(${blur / ratio}px)`;
  // `scale`, not `transform`, which a fade-in animation would override while it runs.
  target.style.scale = `${W / w} ${H / h}`;
  return true;
}

/** The moving marks' painters, one per canvas, so a resize or a theme change reuses it. */
const moving = new WeakMap<HTMLCanvasElement, Painter>();

/**
 * Draws the mark into `target` itself (a canvas used for nothing else), and keeps it moving:
 * its folds drift back and forth on slow, unrelated periods, so it never visibly loops. At the
 * screen's own CSS pixels (a soft field needs no more), at most 30 frames a second, and not at
 * all while the page is hidden. Reduced motion, asked for while it moves, holds it on its frame;
 * a lost GL context stops it until the browser restores one. Returns a stop; false when it
 * couldn't draw.
 */
export function animateMotif(
  target: HTMLCanvasElement,
  params: MotifParams,
  width: number,
  height: number,
): (() => void) | false {
  if (width < 1 || height < 1) return false;
  const painterFor = () => {
    let p = moving.get(target);
    if (!p || p.gl.isContextLost()) {
      p = makePainter(target) ?? undefined;
      if (p) moving.set(target, p);
    }
    return p ?? null;
  };
  if (!painterFor()) return false;
  const palette = tones();
  const W = Math.round(width);
  const H = Math.round(height);
  const swing = (t: number, period: number, phase = 0) =>
    Math.sin((t / period + phase) * 2 * Math.PI);
  const frameAt = (now: number) => {
    const p = painterFor();
    if (!p || p.gl.isContextLost()) return;
    const t = now / 1000;
    draw(
      p,
      {
        ...params,
        waveXShift: params.waveXShift + 0.12 * swing(t, 14),
        waveYShift: params.waveYShift + 0.1 * swing(t, 11, 0.3),
        rotation: params.rotation + 8 * swing(t, 19, 0.6),
      },
      palette,
      W,
      H,
      1,
    );
  };
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let frame = 0;
  let last = 0;
  let running = false;
  const tick = (now: number) => {
    frame = requestAnimationFrame(tick);
    if (now - last < 33) return;
    last = now;
    frameAt(now);
  };
  const start = () => {
    if (running || still?.matches) return;
    running = true;
    frame = requestAnimationFrame(tick);
  };
  const halt = () => {
    running = false;
    cancelAnimationFrame(frame);
  };
  const onMotion = () => (still?.matches ? halt() : start());
  const onLost = (event: Event) => {
    event.preventDefault(); // so the browser may restore it
    halt();
  };
  const onRestored = () => {
    moving.delete(target);
    frameAt(performance.now());
    start();
  };
  frameAt(performance.now());
  start();
  still?.addEventListener?.('change', onMotion);
  target.addEventListener('webglcontextlost', onLost);
  target.addEventListener('webglcontextrestored', onRestored);
  return () => {
    halt();
    still?.removeEventListener?.('change', onMotion);
    target.removeEventListener('webglcontextlost', onLost);
    target.removeEventListener('webglcontextrestored', onRestored);
  };
}
