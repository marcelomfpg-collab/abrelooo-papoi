"use client";

import { animate, AnimatePresence, motion, type AnimationPlaybackControls } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Shape } from "canvas-confetti";

/* ───────────────────────── Ajustes rápidos ───────────────────────── */

/** Tiempo (ms) que hay que mantener presionado para llenar el corazón al 100%. */
const HOLD_DURATION_MS = 3500;

/** Segundo de la canción desde el que arranca al explotar (p. ej. el coro). */
const AUDIO_START_TIME = 0;

/** Ruta del audio dentro de /public. */
const AUDIO_SRC = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/media/your-man.mp3`;

const TEXTS = {
  hint: "Mantén presionado…",
  holding: "no sueltes…",
  title: "Te quiero",
  subtitle: "Holiii, sé que estás ocupada, pero solo vengo a recordarte cuánto te quiero.",
  muteLabel: "Silenciar música",
  unmuteLabel: "Activar música",
  tapForMusic: "toca para la música",
};

/* ─────────────────────────────────────────────────────────────────── */

const COLORS = ["#E63946", "#FF6B6B", "#FF8FA3", "#FFB4A2", "#FFCDB2", "#F4A261", "#E9C46A", "#D4AF37"];

const HEART_PATH =
  "M50 88 C22 68 6 50 6 32 C6 18 17 8 30 8 C39 8 46 13 50 21 C54 13 61 8 70 8 C83 8 94 18 94 32 C94 50 78 68 50 88 Z";

const CRACKS = [
  "M50 21 L48 29 L52 36 L48.5 44 L52 52 L49 61 L51.5 70 L50 88",
  "M50 44 L57 40 L62 43 L70 36",
  "M50 44 L43 39 L37 42 L29 35",
  "M51 55 L59 58 L66 55 L76 60",
  "M49 57 L41 61 L34 58 L25 61",
  "M51 68 L57 73 L62 71",
  "M49 68 L43 73 L38 71",
];

const SPARKLES = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2 + (i % 2 ? 0.25 : -0.1);
  const radius = 0.52 + ((i * 37) % 10) / 45;
  return {
    left: Math.round((50 + Math.cos(angle) * radius * 100) * 100) / 100,
    top: Math.round((47 + Math.sin(angle) * radius * 92) * 100) / 100,
    threshold: 0.3 + ((i * 53) % 60) / 100,
    speed: 7 + (i % 5) * 2.3,
    offset: i * 1.7,
    size: 10 + (i % 3) * 5,
  };
});

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Forma de latido "lub-dub" para una fase en [0, 1). */
function beatShape(f: number) {
  return Math.exp(-(((f - 0.1) / 0.06) ** 2)) + 0.55 * Math.exp(-(((f - 0.32) / 0.06) ** 2));
}

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  } catch {
    /* iOS / navegadores sin soporte: ignorar */
  }
}

type Phase = "idle" | "exploded";

export default function HeartSurprise() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [muted, setMuted] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [audioOk, setAudioOk] = useState(true);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<SVGCircleElement>(null);
  const cracksRef = useRef<SVGGElement>(null);
  const sparklesRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLSpanElement>(null);
  const holdHintRef = useRef<HTMLSpanElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const confettiRef = useRef<typeof import("canvas-confetti") | null>(null);

  const progressRef = useRef(0);
  const holdingRef = useRef(false);
  const explodedRef = useRef(false);
  const springRef = useRef<AnimationPlaybackControls | null>(null);
  const lastTouchRef = useRef(0);
  const holdStartRef = useRef({ time: 0, from: 0 });

  /* Precarga de audio y confetti */
  useEffect(() => {
    const audio = new Audio(AUDIO_SRC);
    audio.preload = "auto";
    audio.loop = true;
    audio.setAttribute("playsinline", "");
    audio.addEventListener("error", () => setAudioOk(false));
    audioRef.current = audio;

    import("canvas-confetti").then((m) => {
      confettiRef.current = m.default;
    });

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  /* ─── Clímax ─── */
  const explode = useCallback(() => {
    if (explodedRef.current) return;
    explodedRef.current = true;
    holdingRef.current = false;
    progressRef.current = 1;
    vibrate([70, 40, 140]);
    setPhase("exploded");

    const audio = audioRef.current;
    if (audio) {
      try {
        audio.currentTime = AUDIO_START_TIME;
      } catch {}
      audio.muted = false;
      audio.play().catch(() => setNeedsTap(true));
    }

    const confetti = confettiRef.current;
    if (!confetti) return;
    let heart: Shape | undefined;
    try {
      heart = confetti.shapeFromPath({ path: HEART_PATH });
    } catch {}
    const shapes: Shape[] = heart ? [heart, "circle"] : ["circle", "square"];
    const base = { colors: COLORS, origin: { x: 0.5, y: 0.47 }, disableForReducedMotion: false, zIndex: 40 };

    confetti({ ...base, particleCount: 170, spread: 360, startVelocity: 52, ticks: 240, gravity: 0.75, scalar: 1.15, shapes });
    confetti({ ...base, particleCount: 90, spread: 360, startVelocity: 28, ticks: 260, gravity: 0.5, scalar: 0.8, shapes: ["circle"] });
    setTimeout(() => {
      confetti({ ...base, particleCount: 60, angle: 60, spread: 70, startVelocity: 55, origin: { x: 0, y: 0.75 }, shapes });
      confetti({ ...base, particleCount: 60, angle: 120, spread: 70, startVelocity: 55, origin: { x: 1, y: 0.75 }, shapes });
    }, 280);

    const end = Date.now() + 2600;
    const drizzle = () => {
      confetti({ ...base, particleCount: 3, spread: 90, startVelocity: 8, gravity: 0.45, ticks: 320, scalar: 0.9, origin: { x: Math.random(), y: -0.05 }, shapes });
      if (Date.now() < end) requestAnimationFrame(drizzle);
    };
    setTimeout(drizzle, 700);
  }, []);

  /* ─── Bucle de animación (latido, llenado, grietas, destellos, vibración) ─── */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let phaseAcc = 0;
    let lastBeatIndex = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (explodedRef.current) return;

      if (holdingRef.current) {
        // Basado en tiempo real (no en frames) para que dure lo mismo aunque el celular pierda FPS.
        const { time, from } = holdStartRef.current;
        progressRef.current = Math.min(1, from + (now - time) / HOLD_DURATION_MS);
        if (progressRef.current >= 1) {
          explode();
          return;
        }
      }

      const p = progressRef.current; // puede ser < 0 durante el rebote elástico
      const pc = clamp01(p);
      const freq = 0.9 + 3.8 * Math.pow(pc, 1.25); // latidos por segundo
      phaseAcc += dt * freq;
      const beatIndex = Math.floor(phaseAcc);
      const beat = beatShape(phaseAcc - beatIndex);

      if (holdingRef.current && beatIndex !== lastBeatIndex) {
        vibrate([Math.round(14 + 26 * pc), 70, Math.round(8 + 16 * pc)]);
      }
      lastBeatIndex = beatIndex;

      const t = now / 1000;
      const shake = holdingRef.current && pc > 0.72 ? (pc - 0.72) * 10 : 0;
      const sx = shake ? (Math.random() - 0.5) * shake : 0;
      const sy = shake ? (Math.random() - 0.5) * shake : 0;
      const scale = 1 + 0.32 * p + beat * (0.035 + 0.075 * pc);

      const w = wrapperRef.current;
      if (w) {
        w.style.transform = `translate3d(${sx}px, ${sy}px, 0) scale(${scale})`;
        w.style.filter = `drop-shadow(0 0 ${6 + 46 * pc + beat * 10 * pc}px rgba(255, 140, 110, ${0.12 + 0.6 * pc}))`;
      }
      fillRef.current?.setAttribute("r", String(pc * 64));

      const crackP = clamp01((pc - 0.42) / 0.5);
      cracksRef.current?.querySelectorAll("path").forEach((el, i) => {
        const local = clamp01(crackP * 1.4 - i * 0.06);
        el.style.strokeDashoffset = String(1 - local);
        el.style.opacity = String(local > 0 ? 0.55 + 0.45 * Math.sin(t * 14 + i) * local : 0);
      });

      sparklesRef.current?.querySelectorAll<HTMLElement>("[data-sparkle]").forEach((el, i) => {
        const s = SPARKLES[i];
        const on = clamp01((pc - s.threshold) / 0.15);
        const flicker = 0.5 + 0.5 * Math.sin(t * s.speed + s.offset);
        el.style.opacity = String(on * flicker);
        el.style.transform = `translate(-50%, -50%) scale(${0.4 + on * flicker}) rotate(${t * 90 + s.offset * 40}deg)`;
      });

      if (glowRef.current) glowRef.current.style.opacity = String(pc * 0.75 + beat * 0.08 * pc);
      if (hintRef.current) hintRef.current.style.opacity = String(clamp01(1 - pc * 3));
      if (holdHintRef.current) holdHintRef.current.style.opacity = String(clamp01((pc - 0.3) * 4) * (0.55 + 0.25 * beat));

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [explode]);

  /* ─── Entrada: presionar / soltar ─── */
  const startHold = useCallback(() => {
    if (explodedRef.current || holdingRef.current) return;
    springRef.current?.stop();
    holdingRef.current = true;
    holdStartRef.current = { time: performance.now(), from: clamp01(progressRef.current) };

    // Desbloquea el audio dentro del gesto del usuario (iOS/Android): arranca en silencio.
    const audio = audioRef.current;
    if (audio && audio.paused) {
      audio.muted = true;
      try {
        audio.currentTime = AUDIO_START_TIME;
      } catch {}
      audio.play().catch(() => {});
    }
  }, []);

  const endHold = useCallback(() => {
    if (explodedRef.current || !holdingRef.current) return;
    holdingRef.current = false;
    audioRef.current?.pause();
    springRef.current = animate(progressRef.current, 0, {
      type: "spring",
      stiffness: 140,
      damping: 7,
      mass: 0.9,
      onUpdate: (v) => {
        if (!holdingRef.current) progressRef.current = v;
      },
    });
  }, []);

  useEffect(() => {
    const release = () => endHold();
    const onVisibility = () => document.hidden && endHold();
    window.addEventListener("blur", release);
    window.addEventListener("mouseup", release);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", release);
      window.removeEventListener("mouseup", release);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [endHold]);

  const onTouchStart = (e: React.TouchEvent) => {
    lastTouchRef.current = Date.now();
    if (e.touches.length >= 1) startHold();
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    lastTouchRef.current = Date.now();
    if (e.touches.length === 0) endHold();
  };
  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || Date.now() - lastTouchRef.current < 800) return; // evita el mouse emulado tras un toque
    startHold();
  };
  const onMouseUp = () => {
    if (Date.now() - lastTouchRef.current < 800) return;
    endHold();
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.muted = false;
      audio.play().then(() => {
        setNeedsTap(false);
        setMuted(false);
      }).catch(() => {});
      return;
    }
    audio.muted = !audio.muted;
    setMuted(audio.muted);
  };

  const exploded = phase === "exploded";

  return (
    <motion.main
      className="no-touch-ui fixed inset-0 flex h-dvh w-full items-center justify-center overflow-hidden"
      initial={false}
      animate={{ backgroundColor: exploded ? "#FAF8F5" : "#0F1115" }}
      transition={{ duration: 1.4, delay: exploded ? 0.15 : 0, ease: [0.22, 1, 0.36, 1] }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Halo cálido de fondo que crece con la carga */}
      <div
        ref={glowRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0"
        style={{
          background:
            "radial-gradient(circle at 50% 47%, rgba(255,170,130,0.55) 0%, rgba(230,57,70,0.22) 28%, rgba(15,17,21,0) 62%)",
        }}
      />

      {/* Corazón */}
      <div className="relative flex flex-col items-center">
        <div
          ref={wrapperRef}
          className="relative will-change-transform"
          style={{ width: "min(64vw, 300px)", aspectRatio: "1 / 1" }}
        >
          <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible" aria-hidden>
            <defs>
              <clipPath id="heart-clip">
                <path d={HEART_PATH} />
              </clipPath>
              <clipPath id="half-left">
                <rect x="-30" y="-30" width="80" height="160" />
              </clipPath>
              <clipPath id="half-right">
                <rect x="50" y="-30" width="80" height="160" />
              </clipPath>
              <radialGradient id="heart-core" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#FFF8EC" />
                <stop offset="22%" stopColor="#FFD3B6" />
                <stop offset="55%" stopColor="#FF7A7A" />
                <stop offset="100%" stopColor="#D62839" />
              </radialGradient>
              <filter id="crack-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="1.2" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <g id="heart-art">
                <path d={HEART_PATH} fill="#22161A" />
                <g clipPath="url(#heart-clip)">
                  <circle ref={fillRef} cx="50" cy="47" r="0" fill="url(#heart-core)" />
                </g>
                <g ref={cracksRef} filter="url(#crack-glow)" clipPath="url(#heart-clip)">
                  {CRACKS.map((d) => (
                    <path
                      key={d}
                      d={d}
                      pathLength={1}
                      fill="none"
                      stroke="#FFF6E5"
                      strokeWidth={1.1}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ strokeDasharray: 1, strokeDashoffset: 1, opacity: 0 }}
                    />
                  ))}
                </g>
                <path d={HEART_PATH} fill="none" stroke="#E8A598" strokeWidth={1.4} strokeLinejoin="round" />
              </g>
            </defs>

            {/* Dos mitades del mismo corazón: al explotar se abren */}
            <motion.g
              clipPath="url(#half-left)"
              style={{ transformBox: "fill-box", transformOrigin: "100% 100%" }}
              initial={false}
              animate={exploded ? { x: -46, y: 6, rotate: -24, opacity: 0 } : { x: 0, y: 0, rotate: 0, opacity: 1 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            >
              <use href="#heart-art" />
            </motion.g>
            <motion.g
              clipPath="url(#half-right)"
              style={{ transformBox: "fill-box", transformOrigin: "0% 100%" }}
              initial={false}
              animate={exploded ? { x: 46, y: 6, rotate: 24, opacity: 0 } : { x: 0, y: 0, rotate: 0, opacity: 1 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            >
              <use href="#heart-art" />
            </motion.g>
          </svg>

          {/* Destellos */}
          <div ref={sparklesRef} aria-hidden className="pointer-events-none absolute inset-0">
            {SPARKLES.map((s, i) => (
              <span
                key={i}
                data-sparkle
                className="absolute block opacity-0"
                style={{ left: `${s.left}%`, top: `${s.top}%`, width: `${s.size}px`, height: `${s.size}px` }}
              >
                <svg viewBox="0 0 20 20" className="h-full w-full">
                  <path d="M10 0 C11 7 13 9 20 10 C13 11 11 13 10 20 C9 13 7 11 0 10 C7 9 9 7 10 0 Z" fill="#FFE9C7" />
                </svg>
              </span>
            ))}
          </div>
        </div>

        {/* Texto de pista */}
        <AnimatePresence>
          {!exploded && (
            <motion.p
              className="relative mt-10 h-6 w-72 text-center text-[13px] tracking-[0.28em] text-[#E8D9C9] lowercase"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ duration: 1.2, delay: 0.4 }}
            >
              <motion.span
                ref={hintRef}
                className="absolute inset-0"
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              >
                {TEXTS.hint}
              </motion.span>
              <span ref={holdHintRef} className="absolute inset-0 italic opacity-0" style={{ fontFamily: "var(--font-serif)", letterSpacing: "0.12em", fontSize: 17 }}>
                {TEXTS.holding}
              </span>
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Destello de pantalla */}
      <AnimatePresence>
        {exploded && (
          <motion.div
            key="flash"
            aria-hidden
            className="pointer-events-none absolute inset-0 z-30 bg-[#FFF8EE]"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1.1, times: [0, 0.08, 1], ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      {/* Mensaje final */}
      <AnimatePresence>
        {exploded && (
          <motion.section
            key="message"
            className="absolute inset-0 z-20 flex flex-col items-center justify-center px-8 text-center"
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { delayChildren: 0.55, staggerChildren: 0.35 } } }}
          >
            <motion.svg
              viewBox="0 0 100 100"
              className="mb-6 h-7 w-7"
              variants={{ hidden: { opacity: 0, scale: 0.4 }, show: { opacity: 1, scale: 1 } }}
              transition={{ type: "spring", stiffness: 220, damping: 12 }}
              aria-hidden
            >
              <motion.path
                d={HEART_PATH}
                fill="#D62839"
                style={{ transformOrigin: "50% 50%" }}
                animate={{ scale: [1, 1.14, 1, 1.08, 1] }}
                transition={{ duration: 1.3, repeat: Infinity, times: [0, 0.12, 0.24, 0.36, 1] }}
              />
            </motion.svg>
            <motion.h1
              className="text-[clamp(3.6rem,17vw,7.5rem)] leading-none font-light text-[#2A1A1E]"
              style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.01em" }}
              variants={{ hidden: { opacity: 0, y: 18, filter: "blur(10px)" }, show: { opacity: 1, y: 0, filter: "blur(0px)" } }}
              transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
            >
              {TEXTS.title}
            </motion.h1>
            <motion.p
              className="mt-6 max-w-[22rem] text-[15px] leading-relaxed text-[#7A6560] italic"
              style={{ fontFamily: "var(--font-serif)", fontSize: 19 }}
              variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {TEXTS.subtitle}
            </motion.p>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Botón de música */}
      <AnimatePresence>
        {exploded && audioOk && (
          <motion.button
            key="mute"
            type="button"
            onClick={toggleMute}
            onTouchStart={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label={muted || needsTap ? TEXTS.unmuteLabel : TEXTS.muteLabel}
            className="absolute right-5 z-40 flex items-center gap-2 rounded-full border border-[#2A1A1E]/10 bg-white/60 px-3.5 py-2.5 text-[#2A1A1E]/70 shadow-[0_4px_20px_rgba(42,26,30,0.08)] backdrop-blur-md"
            style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom))", touchAction: "manipulation" }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2, duration: 0.8 }}
            whileTap={{ scale: 0.92 }}
          >
            {needsTap && <span className="text-[11px] tracking-[0.18em] lowercase">{TEXTS.tapForMusic}</span>}
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
              {muted || needsTap ? (
                <path d="M16 9.5l5 5M21 9.5l-5 5" />
              ) : (
                <>
                  <path d="M15.5 9.2a4 4 0 0 1 0 5.6" />
                  <path d="M18.2 6.8a7.5 7.5 0 0 1 0 10.4" />
                </>
              )}
            </svg>
          </motion.button>
        )}
      </AnimatePresence>
    </motion.main>
  );
}
