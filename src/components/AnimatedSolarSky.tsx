import { useEffect, useRef, useState, useId } from "react";
import { Sun, Moon, Sunrise, Sunset, Play, Pause, Volume2, VolumeX, Eye, EyeOff, Sparkles, Sliders } from "lucide-react";

export type TimeOfDayPreset = "sunrise" | "midday" | "sunset" | "night";

interface Bird {
  x: number;
  y: number;
  speed: number;
  size: number;
  wingPhase: number;
  flapSpeed: number;
  glideTimer: number;
  altitudeOffset: number;
  flockId: number;
  opacity: number;
}

interface Star {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  twinkleSpeed: number;
  twinkleOffset: number;
}

interface Props {
  className?: string;
  initialPreset?: TimeOfDayPreset;
  showControls?: boolean;
  /** Hide the floating phase/time HUD badge (useful when the sky is a page background). */
  showHud?: boolean;
  autoPlay?: boolean;
  cycleDurationSeconds?: number;
  onTimeChange?: (timeOfDay: number) => void;
  children?: React.ReactNode;
}

export function AnimatedSolarSky({
  className = "",
  initialPreset = "sunset",
  showControls = true,
  showHud = true,
  autoPlay = true,
  cycleDurationSeconds = 45,
  onTimeChange,
  children,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Time of day: 0.0 = sunrise (06:00), 0.35 = midday (12:00), 0.70 = sunset (18:30), 0.95 = night (22:00)
  const initialTime =
    initialPreset === "sunrise" ? 0.08 :
    initialPreset === "midday" ? 0.36 :
    initialPreset === "sunset" ? 0.72 : 0.95;

  const [timeOfDay, setTimeOfDay] = useState<number>(initialTime);
  const [isPlaying, setIsPlaying] = useState<boolean>(autoPlay);
  const [showBirds, setShowBirds] = useState<boolean>(true);
  const [showGlint, setShowGlint] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [controlsExpanded, setControlsExpanded] = useState<boolean>(false);
  const [hideUI, setHideUI] = useState<boolean>(false);

  // Audio Context Ref for synthesized ambient sounds
  const audioCtxRef = useRef<AudioContext | null>(null);
  const soundNodesRef = useRef<{ windGain?: GainNode; filter?: BiquadFilterNode } | null>(null);

  const timeRef = useRef<number>(timeOfDay);
  timeRef.current = timeOfDay;

  const isPlayingRef = useRef<boolean>(isPlaying);
  isPlayingRef.current = isPlaying;

  const showBirdsRef = useRef<boolean>(showBirds);
  showBirdsRef.current = showBirds;

  const showGlintRef = useRef<boolean>(showGlint);
  showGlintRef.current = showGlint;

  // Synthesize gentle nature sound (breeze + bird chirps) via Web Audio API
  useEffect(() => {
    if (!soundEnabled) {
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.suspend();
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      // 1. Wind noise generator
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99 * b0 + white * 0.05;
        b1 = 0.98 * b1 + white * 0.05;
        b2 = 0.95 * b2 + white * 0.05;
        output[i] = (b0 + b1 + b2) * 0.3;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(320, ctx.currentTime);

      const windGain = ctx.createGain();
      windGain.gain.setValueAtTime(0.04, ctx.currentTime);

      whiteNoise.connect(filter);
      filter.connect(windGain);
      windGain.connect(ctx.destination);
      whiteNoise.start();

      // 2. Periodic bird chirping
      let chirpTimer: number | null = null;
      const playChirp = () => {
        if (!soundEnabled || ctx.state !== "running") return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        const baseFreq = 2200 + Math.random() * 800;
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.07);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, now + 0.16);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.035, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);

        const nextDelay = 2500 + Math.random() * 4500;
        chirpTimer = window.setTimeout(playChirp, nextDelay);
      };

      chirpTimer = window.setTimeout(playChirp, 1500);

      soundNodesRef.current = { windGain, filter };

      return () => {
        if (chirpTimer) clearTimeout(chirpTimer);
        try {
          whiteNoise.stop();
          whiteNoise.disconnect();
        } catch {
          // ignore
        }
      };
    } catch {
      // Audio autoplay policy or not supported
    }
  }, [soundEnabled]);

  // Main Canvas Animation Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrame = 0;
    let lastTimestamp = performance.now();

    // Generate stars for night sky
    const stars: Star[] = Array.from({ length: 90 }, () => ({
      x: Math.random(),
      y: Math.random() * 0.38, // top sky region
      radius: 0.6 + Math.random() * 1.4,
      alpha: 0.3 + Math.random() * 0.7,
      twinkleSpeed: 0.8 + Math.random() * 2.2,
      twinkleOffset: Math.random() * Math.PI * 2,
    }));

    // Generate initial flock of birds
    const createBird = (x: number, y: number, flockId = 1, sizeMultiplier = 1): Bird => ({
      x,
      y,
      speed: 0.00075 + Math.random() * 0.00045,
      size: (11 + Math.random() * 7) * sizeMultiplier,
      wingPhase: Math.random() * Math.PI * 2,
      flapSpeed: 7 + Math.random() * 4,
      glideTimer: Math.random() * 60,
      altitudeOffset: (Math.random() - 0.5) * 0.015,
      flockId,
      opacity: 0.75 + Math.random() * 0.25,
    });

    // 2 flocks: one main V-flock, one smaller pair
    const birds: Bird[] = [
      // Main V flock
      createBird(0.15, 0.12, 1, 1.0),
      createBird(0.12, 0.135, 1, 0.95),
      createBird(0.09, 0.15, 1, 0.9),
      createBird(0.11, 0.108, 1, 0.92),
      createBird(0.07, 0.122, 1, 0.85),
      createBird(0.04, 0.14, 1, 0.8),
      // Secondary soaring birds
      createBird(0.55, 0.07, 2, 0.8),
      createBird(0.58, 0.082, 2, 0.75),
      createBird(0.78, 0.18, 3, 1.15),
    ];

    let currentWidth = 0;
    let currentHeight = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      currentWidth = rect.width;
      currentHeight = rect.height;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    // Render loop
    const render = (now: number) => {
      const dt = Math.min((now - lastTimestamp) / 1000, 0.1);
      lastTimestamp = now;

      // Update time progression if playing
      if (isPlayingRef.current) {
        timeRef.current = (timeRef.current + dt / cycleDurationSeconds) % 1.0;
        setTimeOfDay(timeRef.current);
        onTimeChange?.(timeRef.current);
      }

      const t = timeRef.current;
      const w = currentWidth;
      const h = currentHeight;

      if (w > 0 && h > 0) {
        ctx.clearRect(0, 0, w, h);

        // Calculate Sun Position along an orbital arc across the sky
        // Sun starts low left (sunrise), arcs high center (noon), descends right (sunset), then dips below horizon (night)
        let sunX = 0;
        let sunY = 0;
        let sunVisible = false;
        let sunAltitude = 0; // 0 (horizon) to 1 (zenith)

        if (t <= 0.85) {
          // Daytime / Sunrise / Sunset phase
          const dayProgress = t / 0.85; // 0 to 1
          sunX = w * (0.08 + dayProgress * 0.84);
          // Parabolic arc for height: peaks at dayProgress ~ 0.45
          const arc = Math.sin(dayProgress * Math.PI);
          sunY = h * (0.32 - arc * 0.24); // between 8% and 32% height
          sunAltitude = arc;
          sunVisible = true;
        } else {
          // Night phase (sun below horizon, moon appears)
          sunVisible = false;
        }

        // ==========================================
        // 1. DYNAMIC ATMOSPHERIC SKY OVERLAYS
        // ==========================================
        // Sky tint & mood depending on timeOfDay
        let skyOverlayGrad: CanvasGradient;

        if (t < 0.2) {
          // Dawn / Sunrise: soft peach, apricot, warm golden rose
          const factor = t / 0.2;
          skyOverlayGrad = ctx.createLinearGradient(0, 0, 0, h * 0.45);
          skyOverlayGrad.addColorStop(0, `rgba(255, 140, 70, ${0.45 * (1 - factor * 0.3)})`);
          skyOverlayGrad.addColorStop(0.5, `rgba(255, 190, 110, ${0.35 * (1 - factor * 0.2)})`);
          skyOverlayGrad.addColorStop(1, "rgba(255, 220, 150, 0)");
          ctx.fillStyle = skyOverlayGrad;
          ctx.fillRect(0, 0, w, h * 0.5);
        } else if (t >= 0.2 && t < 0.6) {
          // Midday: crisp solar luminescence and subtle atmospheric haze
          skyOverlayGrad = ctx.createLinearGradient(0, 0, 0, h * 0.4);
          skyOverlayGrad.addColorStop(0, "rgba(255, 248, 220, 0.22)");
          skyOverlayGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
          ctx.fillStyle = skyOverlayGrad;
          ctx.fillRect(0, 0, w, h * 0.45);
        } else if (t >= 0.6 && t < 0.85) {
          // Golden Hour / Sunset: rich intense amber, fiery crimson and gold
          const sunsetProgress = (t - 0.6) / 0.25;
          const sunsetIntensity = Math.sin(sunsetProgress * Math.PI) * 0.6 + 0.2;
          skyOverlayGrad = ctx.createLinearGradient(0, 0, 0, h * 0.5);
          skyOverlayGrad.addColorStop(0, `rgba(255, 100, 40, ${sunsetIntensity * 0.6})`);
          skyOverlayGrad.addColorStop(0.4, `rgba(255, 160, 50, ${sunsetIntensity * 0.7})`);
          skyOverlayGrad.addColorStop(0.8, `rgba(245, 200, 90, ${sunsetIntensity * 0.4})`);
          skyOverlayGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = skyOverlayGrad;
          ctx.fillRect(0, 0, w, h * 0.6);
        } else {
          // Dusk / Night: deep indigo-blue veil, twinkling stars, soft moon glow
          const nightFactor = (t - 0.85) / 0.15;
          const nightOpacity = Math.min(0.78, 0.35 + nightFactor * 0.45);
          ctx.fillStyle = `rgba(10, 15, 35, ${nightOpacity})`;
          ctx.fillRect(0, 0, w, h);

          // Render Twinkling Stars
          ctx.save();
          stars.forEach((star) => {
            const twinkle = 0.4 + 0.6 * Math.sin(now * 0.003 * star.twinkleSpeed + star.twinkleOffset);
            ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha * twinkle * nightOpacity})`;
            ctx.beginPath();
            ctx.arc(star.x * w, star.y * h, star.radius, 0, Math.PI * 2);
            ctx.fill();
          });
          ctx.restore();

          // Gentle Crescent Moon
          const moonX = w * 0.82;
          const moonY = h * 0.14;
          const moonRadius = Math.min(w, h) * 0.038;
          ctx.save();
          // Moon glow
          const moonGlow = ctx.createRadialGradient(moonX, moonY, moonRadius * 0.5, moonX, moonY, moonRadius * 3.5);
          moonGlow.addColorStop(0, "rgba(220, 235, 255, 0.35)");
          moonGlow.addColorStop(1, "rgba(220, 235, 255, 0)");
          ctx.fillStyle = moonGlow;
          ctx.beginPath();
          ctx.arc(moonX, moonY, moonRadius * 3.5, 0, Math.PI * 2);
          ctx.fill();

          // Moon body
          ctx.fillStyle = "rgba(255, 252, 235, 0.9)";
          ctx.beginPath();
          ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
          ctx.fill();

          // Shadow carve to make crescent
          ctx.fillStyle = `rgba(10, 15, 35, ${nightOpacity * 0.95})`;
          ctx.beginPath();
          ctx.arc(moonX + moonRadius * 0.55, moonY - moonRadius * 0.25, moonRadius * 0.9, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // ==========================================
        // 2. SUN ORB, VOLUMETRIC RAYS & CORONA
        // ==========================================
        if (sunVisible) {
          ctx.save();

          // A. Soft Volumetric God Rays
          const numRays = 12;
          const rayAngleOffset = now * 0.00025;
          const rayRadius = Math.max(w, h) * 0.48;
          for (let i = 0; i < numRays; i++) {
            const angle = (i * Math.PI * 2) / numRays + rayAngleOffset;
            const spread = 0.14;
            const rayGrad = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, rayRadius);
            const rayAlpha = (0.05 + Math.sin(now * 0.001 + i) * 0.02) * (sunAltitude * 0.8 + 0.2);
            rayGrad.addColorStop(0, `rgba(255, 245, 210, ${rayAlpha * 1.5})`);
            rayGrad.addColorStop(0.5, `rgba(255, 210, 140, ${rayAlpha * 0.8})`);
            rayGrad.addColorStop(1, "rgba(255, 180, 80, 0)");

            ctx.fillStyle = rayGrad;
            ctx.beginPath();
            ctx.moveTo(sunX, sunY);
            ctx.arc(sunX, sunY, rayRadius, angle - spread, angle + spread);
            ctx.closePath();
            ctx.fill();
          }

          // B. Outer Atmospheric Corona
          const outerCoronaRadius = Math.min(w, h) * (0.28 + sunAltitude * 0.12);
          const coronaGrad = ctx.createRadialGradient(sunX, sunY, 5, sunX, sunY, outerCoronaRadius);
          if (t >= 0.6 && t < 0.85) {
            // Sunset deep orange-gold corona
            coronaGrad.addColorStop(0, "rgba(255, 255, 240, 0.95)");
            coronaGrad.addColorStop(0.12, "rgba(255, 210, 110, 0.8)");
            coronaGrad.addColorStop(0.35, "rgba(255, 130, 40, 0.45)");
            coronaGrad.addColorStop(0.7, "rgba(230, 70, 20, 0.18)");
            coronaGrad.addColorStop(1, "rgba(200, 50, 20, 0)");
          } else {
            // Daytime / Sunrise brilliant warm corona
            coronaGrad.addColorStop(0, "rgba(255, 255, 255, 1)");
            coronaGrad.addColorStop(0.15, "rgba(255, 245, 190, 0.85)");
            coronaGrad.addColorStop(0.4, "rgba(255, 215, 120, 0.38)");
            coronaGrad.addColorStop(0.75, "rgba(255, 180, 80, 0.12)");
            coronaGrad.addColorStop(1, "rgba(255, 160, 60, 0)");
          }

          ctx.fillStyle = coronaGrad;
          ctx.beginPath();
          ctx.arc(sunX, sunY, outerCoronaRadius, 0, Math.PI * 2);
          ctx.fill();

          // C. Inner Blazing Solar Core
          const sunCoreRadius = Math.min(w, h) * 0.038;
          const pulse = 1 + Math.sin(now * 0.002) * 0.04;
          const coreGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunCoreRadius * pulse);
          coreGrad.addColorStop(0, "#FFFFFF");
          coreGrad.addColorStop(0.65, "#FFF7D6");
          coreGrad.addColorStop(0.9, "#FFD066");
          coreGrad.addColorStop(1, "rgba(255, 175, 40, 0.8)");

          ctx.fillStyle = coreGrad;
          ctx.beginPath();
          ctx.arc(sunX, sunY, sunCoreRadius * pulse, 0, Math.PI * 2);
          ctx.fill();

          // D. Optical Lens Flares (traveling along ray connecting sun through viewport center)
          const centerX = w * 0.5;
          const centerY = h * 0.5;
          const flareVectorX = centerX - sunX;
          const flareVectorY = centerY - sunY;

          // Flare 1: Soft golden ring
          const flare1X = sunX + flareVectorX * 0.65;
          const flare1Y = sunY + flareVectorY * 0.65;
          const flare1Grad = ctx.createRadialGradient(flare1X, flare1Y, 2, flare1X, flare1Y, 32);
          flare1Grad.addColorStop(0, "rgba(255, 240, 180, 0.25)");
          flare1Grad.addColorStop(0.7, "rgba(255, 180, 90, 0.12)");
          flare1Grad.addColorStop(1, "rgba(255, 180, 90, 0)");
          ctx.fillStyle = flare1Grad;
          ctx.beginPath();
          ctx.arc(flare1X, flare1Y, 32, 0, Math.PI * 2);
          ctx.fill();

          // Flare 2: Warm magenta-amber secondary circle
          const flare2X = sunX + flareVectorX * 1.35;
          const flare2Y = sunY + flareVectorY * 1.35;
          const flare2Grad = ctx.createRadialGradient(flare2X, flare2Y, 1, flare2X, flare2Y, 48);
          flare2Grad.addColorStop(0, "rgba(255, 160, 200, 0.18)");
          flare2Grad.addColorStop(0.6, "rgba(255, 210, 120, 0.08)");
          flare2Grad.addColorStop(1, "rgba(255, 210, 120, 0)");
          ctx.fillStyle = flare2Grad;
          ctx.beginPath();
          ctx.arc(flare2X, flare2Y, 48, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }

        // ==========================================
        // 3. SOLAR PANEL ROOF SHIMMER & GLINT
        // ==========================================
        if (showGlintRef.current && sunVisible && sunAltitude > 0.15) {
          ctx.save();
          // The mansion roof solar panels are located around x: 30% to 82%, y: 45% to 75%
          const sweepX = w * (0.3 + (Math.sin(now * 0.0008) * 0.5 + 0.5) * 0.5);
          const sweepY = h * (0.52 + (Math.cos(now * 0.0007) * 0.5 + 0.5) * 0.18);

          // Specular glint burst
          const glintSize = 14 + Math.sin(now * 0.004) * 4;
          const glintGrad = ctx.createRadialGradient(sweepX, sweepY, 1, sweepX, sweepY, glintSize * 1.8);
          glintGrad.addColorStop(0, "rgba(255, 255, 255, 0.85)");
          glintGrad.addColorStop(0.3, "rgba(200, 245, 255, 0.5)");
          glintGrad.addColorStop(1, "rgba(100, 200, 255, 0)");
          ctx.fillStyle = glintGrad;
          ctx.beginPath();
          ctx.arc(sweepX, sweepY, glintSize * 1.8, 0, Math.PI * 2);
          ctx.fill();

          // 4-point solar glint star
          ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(sweepX - glintSize * 1.5, sweepY);
          ctx.lineTo(sweepX + glintSize * 1.5, sweepY);
          ctx.moveTo(sweepX, sweepY - glintSize * 1.5);
          ctx.lineTo(sweepX, sweepY + glintSize * 1.5);
          ctx.stroke();

          // Secondary subtle glint on adjacent panel string
          const subX = sweepX + w * 0.12;
          const subY = sweepY + h * 0.04;
          if (subX < w * 0.85) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
            ctx.beginPath();
            ctx.arc(subX, subY, 3, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        }

        // ==========================================
        // 4. REALISTIC FLYING BIRDS (FLOCK & GLIDE)
        // ==========================================
        if (showBirdsRef.current) {
          ctx.save();
          birds.forEach((bird) => {
            // Update bird position (drifting across the sky towards the right)
            bird.x += bird.speed * (dt * 60);

            // Flap vs. Glide cycle
            bird.glideTimer += dt * 60;
            const isGliding = (Math.floor(bird.glideTimer / 90) % 3) === 0;

            if (!isGliding) {
              bird.wingPhase += bird.flapSpeed * dt;
            } else {
              // Hold wing in graceful soaring posture
              bird.wingPhase = Math.PI * 0.1;
            }

            // Wrap around when bird flies off-screen to the right
            if (bird.x > 1.15) {
              bird.x = -0.15;
              bird.y = 0.05 + Math.random() * 0.22; // Stay in the open sky zone above trees
              bird.speed = 0.00065 + Math.random() * 0.0005;
              bird.size = 11 + Math.random() * 8;
            }

            // Calculate pixel position
            const bx = bird.x * w;
            const by = (bird.y + Math.sin(now * 0.0015 + bird.x * 4) * 0.012 + bird.altitudeOffset) * h;

            // Render bird silhouette with aerodynamic wing curving
            const wingY = Math.sin(bird.wingPhase) * (bird.size * 0.65);
            const birdColor = t > 0.85 ? "rgba(180, 195, 215, 0.7)" : `rgba(32, 24, 18, ${bird.opacity})`;

            ctx.save();
            ctx.translate(bx, by);
            // Slight tilt based on wing stroke and ascent
            const tilt = isGliding ? 0.06 : Math.cos(bird.wingPhase) * 0.08;
            ctx.rotate(tilt);

            ctx.strokeStyle = birdColor;
            ctx.lineWidth = Math.max(1.1, bird.size * 0.16);
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            ctx.beginPath();
            // Left wing curve
            ctx.moveTo(-bird.size, wingY);
            ctx.quadraticCurveTo(-bird.size * 0.45, -bird.size * 0.35 - wingY * 0.45, 0, 0);
            // Right wing curve
            ctx.quadraticCurveTo(bird.size * 0.45, -bird.size * 0.35 - wingY * 0.45, bird.size, wingY);
            ctx.stroke();

            // Tiny bird body dot
            ctx.fillStyle = birdColor;
            ctx.beginPath();
            ctx.arc(0, 0, Math.max(0.8, bird.size * 0.12), 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
          });
          ctx.restore();
        }
      }

      animFrame = requestAnimationFrame(render);
    };

    animFrame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrame);
      resizeObserver.disconnect();
    };
  }, [cycleDurationSeconds]);

  // Helper to format 24h simulated time
  const getFormattedTime = (t: number) => {
    // 0.0 = 06:00, 1.0 = 06:00 next day (24 hours span)
    const totalMinutes = (6 * 60 + t * 24 * 60) % (24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    return `${displayHours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")} ${ampm}`;
  };

  // Helper to compute live simulated Solar Output kW based on sun altitude
  const getSimulatedSolarKW = (t: number) => {
    if (t > 0.85) return "0.0 kW";
    const dayProgress = t / 0.85;
    const altitude = Math.sin(dayProgress * Math.PI);
    const kw = (Math.max(0, altitude) * 14.8).toFixed(1);
    return `${kw} kW`;
  };

  const getSimulatedPhaseLabel = (t: number) => {
    if (t < 0.18) return "Golden Sunrise 🌅";
    if (t < 0.55) return "High Solar Noon ☀️";
    if (t < 0.82) return "Golden Sunset 🌇";
    return "Starry Dusk / Night 🌌";
  };

  const setPreset = (preset: TimeOfDayPreset) => {
    const val =
      preset === "sunrise" ? 0.08 :
      preset === "midday" ? 0.36 :
      preset === "sunset" ? 0.72 : 0.95;
    setTimeOfDay(val);
    timeRef.current = val;
    onTimeChange?.(val);
  };

  const sliderId = useId();

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden bg-slate-900 ${className}`}
    >
      {/* 1. Underlying Photograph: Luxury Solar Mansion */}
      <img
        src="/solar-hero.jpg"
        alt="Solar Powered Modern Luxury Villa"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center select-none transition-opacity duration-1000"
      />

      {/* 2. Interactive Animation Canvas: Moving Sun, Corona, Rays, Lens Flares, Birds & Night Sky */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full select-none"
      />

      {/* 3. Floating HUD / Live Solar Generation Badge */}
      {showHud && !hideUI && (
        <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-2 rounded-xl border border-white/25 bg-slate-950/65 px-3 py-1.5 text-white backdrop-blur-md shadow-lg transition-all">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div className="text-left leading-tight">
              <p className="text-[10px] font-semibold tracking-wider uppercase text-slate-300">
                {getSimulatedPhaseLabel(timeOfDay)}
              </p>
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <span>{getFormattedTime(timeOfDay)}</span>
                <span className="text-slate-400">·</span>
                <span className="flex items-center gap-1 text-emerald-300">
                  <Sparkles className="h-3 w-3" /> {getSimulatedSolarKW(timeOfDay)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Ambient Scene Floating Controls */}
      {showControls && (
        <div className="absolute top-4 right-4 z-30 pointer-events-auto">
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-white/20 bg-slate-950/70 p-1 text-white backdrop-blur-md shadow-lg">
              <button
                type="button"
                onClick={() => setHideUI(!hideUI)}
                title={hideUI ? "Show UI" : "Hide UI for full view"}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition"
              >
                {hideUI ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                title={isPlaying ? "Pause Sun Movement" : "Resume Sun Movement"}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                  isPlaying ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30" : "text-slate-300 hover:bg-white/10"
                }`}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                title={soundEnabled ? "Mute Ambient Sound" : "Enable Ambient Nature Sound"}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                  soundEnabled ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30" : "text-slate-300 hover:bg-white/10"
                }`}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={() => setControlsExpanded(!controlsExpanded)}
                title="Scene Customization"
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                  controlsExpanded ? "bg-white/20 text-white" : "text-slate-300 hover:bg-white/10"
                }`}
              >
                <Sliders className="h-4 w-4" />
              </button>
            </div>

            {/* Expanded Controls Drawer */}
            {controlsExpanded && !hideUI && (
              <div className="w-72 rounded-2xl border border-white/20 bg-slate-950/85 p-3.5 text-white backdrop-blur-xl shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="text-xs font-semibold text-slate-200">Sun & Sky Controls</span>
                  <span className="text-[10px] font-mono text-amber-300">{getFormattedTime(timeOfDay)}</span>
                </div>

                {/* Time Scrubber Slider */}
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <label htmlFor={sliderId}>Time of Day</label>
                    <span className="font-mono text-slate-300">{Math.round(timeOfDay * 100)}%</span>
                  </div>
                  <input
                    id={sliderId}
                    type="range"
                    min="0"
                    max="1"
                    step="0.005"
                    value={timeOfDay}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setTimeOfDay(val);
                      timeRef.current = val;
                      onTimeChange?.(val);
                    }}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-700 accent-amber-400"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 px-0.5">
                    <span>Dawn</span>
                    <span>Noon</span>
                    <span>Sunset</span>
                    <span>Night</span>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="mt-3 grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPreset("sunrise")}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-1.5 text-[11px] font-medium text-amber-200 hover:bg-white/10 transition"
                  >
                    <Sunrise className="h-3.5 w-3.5 text-amber-400" /> Sunrise
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreset("midday")}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-1.5 text-[11px] font-medium text-yellow-200 hover:bg-white/10 transition"
                  >
                    <Sun className="h-3.5 w-3.5 text-yellow-400" /> Midday
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreset("sunset")}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-1.5 text-[11px] font-medium text-orange-200 hover:bg-white/10 transition"
                  >
                    <Sunset className="h-3.5 w-3.5 text-orange-400" /> Sunset
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreset("night")}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-1.5 text-[11px] font-medium text-indigo-200 hover:bg-white/10 transition"
                  >
                    <Moon className="h-3.5 w-3.5 text-indigo-400" /> Night
                  </button>
                </div>

                {/* Toggles */}
                <div className="mt-3 space-y-2 border-t border-white/10 pt-2.5 text-[11px]">
                  <label className="flex items-center justify-between text-slate-300 cursor-pointer">
                    <span>Flocking Birds</span>
                    <input
                      type="checkbox"
                      checked={showBirds}
                      onChange={(e) => setShowBirds(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-0"
                    />
                  </label>
                  <label className="flex items-center justify-between text-slate-300 cursor-pointer">
                    <span>Solar Panel Shimmer</span>
                    <input
                      type="checkbox"
                      checked={showGlint}
                      onChange={(e) => setShowGlint(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-0"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Forefront Children Content (e.g. Login form card, Hero text, etc.) */}
      {!hideUI && children && (
        <div className="relative z-10 flex min-h-full w-full items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}

