// ============================================================
// VideoBackdrop — admin-app ambient background video.
//
// - Fixed full-screen layer BEHIND all app content: it only shows
//   where no component paints its own background, so the existing
//   theme (sidebar, header, cards, tables) is untouched.
// - Always muted — there is deliberately no audio.
// - Brightness is user-adjustable 0%–100% (0% = fully hidden).
//   Persisted per-browser in localStorage.
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, Sun, VideoIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const STORE_KEY = "solarops_video_backdrop";
const VIDEO_SRC = "media/solar-ops-background.mp4";

interface BackdropPrefs {
  brightness: number; // 0–100
  playing: boolean;
}

function loadPrefs(): BackdropPrefs {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as BackdropPrefs;
      return {
        brightness: Math.min(100, Math.max(0, Number(p.brightness) || 0)),
        playing: p.playing !== false,
      };
    }
  } catch { /* ignore corrupt prefs */ }
  return { brightness: 35, playing: true };
}

export default function VideoBackdrop() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [prefs, setPrefs] = useState<BackdropPrefs>(loadPrefs);
  const [panelOpen, setPanelOpen] = useState(false);
  const { brightness, playing } = prefs;

  const save = useCallback((next: BackdropPrefs) => {
    setPrefs(next);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  // keep the element in sync with prefs
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = 0;
    v.muted = true;
    if (playing && brightness > 0 && v.paused) void v.play().catch(() => setPrefs({ ...prefs, playing: false }));
    if ((!playing || brightness === 0) && !v.paused) v.pause();
  }, [playing, brightness, prefs]);

  const setBrightness = (n: number) => save({ ...prefs, brightness: Math.min(100, Math.max(0, n)) });

  return (
    <>
      {/* === The video layer (behind everything) === */}
      <video
        ref={videoRef}
        src={VIDEO_SRC}
        // No audio by design: muted + volume 0. Videos are looped ambient visuals.
        muted
        loop
        playsInline
        autoPlay={playing}
        preload="auto"
        disablePictureInPicture
        aria-hidden="true"
        className={cn(
          "pointer-events-none fixed inset-0 -z-10 h-full w-full object-cover no-print",
          brightness === 0 && "invisible",
        )}
        style={{ opacity: Math.max(0.12, brightness / 100) }}
      />
      {/* gentle theme-colored veil keeps green identity on top of the video */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-brand-700/45 via-slate-900/50 to-brand-950/55 no-print"
        style={{ opacity: brightness / 100 }}
      />

      {/* === Floating control pill (bottom-left — bottom-right is SolarBot's home) === */}
      <div className="fixed bottom-4 left-4 z-40 no-print">
        {panelOpen && (
          <div className="mb-2 w-60 rounded-xl border border-white/25 bg-slate-900/85 p-3 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <VideoIcon className="h-3.5 w-3.5 text-amber-300" />
                <p className="text-[11px] font-bold text-white">Background video</p>
              </div>
              <button
                onClick={() => save({ ...prefs, playing: !playing })}
                className="rounded-md p-1 text-slate-300 hover:bg-white/10 hover:text-white"
                title={playing ? "Pause video" : "Play video"}
              >
                {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <Sun className="h-3.5 w-3.5 shrink-0 text-amber-300" />
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="h-1.5 w-full cursor-pointer accent-amber-400"
                aria-label="Background brightness 0 to 100 percent"
              />
              <span className="w-9 shrink-0 text-right text-[10.5px] font-semibold text-amber-200">{brightness}%</span>
            </div>
            <p className="mt-1.5 text-[10px] leading-snug text-slate-400">
              0% hides the video entirely · no audio, ever
            </p>
          </div>
        )}
        <button
          onClick={() => setPanelOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/80 px-3 py-1.5 text-[11px] font-semibold text-white shadow-xl ring-1 ring-white/20 backdrop-blur-md hover:bg-slate-900 transition"
          title="Ambient video background settings"
        >
          <VideoIcon className="h-3.5 w-3.5 text-amber-300" />
          <span className="hidden sm:inline">Video bg · {brightness}%</span>
        </button>
      </div>
    </>
  );
}
