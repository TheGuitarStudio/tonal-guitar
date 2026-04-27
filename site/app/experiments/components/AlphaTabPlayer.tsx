"use client";

import { useEffect, useRef, useState } from "react";

interface AlphaTabPlayerProps {
  alphaTex: string;
}

const ASSETS_BASE =
  "https://cdn.jsdelivr.net/npm/@coderline/alphatab@1.8.2/dist";

/**
 * Embeds an interactive alphaTab renderer + audio player. alphaTab is
 * browser-only (uses Web Audio + Worker), so we dynamically import it and
 * mount only on the client.
 */
export function AlphaTabPlayer({ alphaTex }: AlphaTabPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<unknown>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Mount alphaTab once.
  useEffect(() => {
    let cancelled = false;
    let api: any = null;

    (async () => {
      try {
        const alphaTab = await import("@coderline/alphatab");
        if (cancelled || !containerRef.current) return;

        api = new alphaTab.AlphaTabApi(containerRef.current, {
          core: {
            engine: "svg",
            fontDirectory: `${ASSETS_BASE}/font/`,
            tex: true,
            file: alphaTex,
          },
          display: {
            scale: 1,
            staveProfile: "ScoreTab",
          },
          player: {
            enablePlayer: true,
            enableCursor: true,
            enableUserInteraction: true,
            soundFont: `${ASSETS_BASE}/soundfont/sonivox.sf2`,
            scrollMode: 0, // off
          },
        });

        api.renderStarted.on(() => {
          if (!cancelled) setReady(true);
        });
        api.error.on((e: { message?: string } | string) => {
          if (cancelled) return;
          const msg =
            typeof e === "string" ? e : (e?.message ?? "Unknown alphaTab error");
          setError(msg);
        });
        api.playerStateChanged.on((e: { state: number }) => {
          if (cancelled) return;
          // 0 = paused, 1 = playing, 2 = stopped (alphaTab PlayerState enum)
          setIsPlaying(e.state === 1);
        });

        apiRef.current = api;
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        api?.destroy?.();
      } catch {
        // ignore
      }
      apiRef.current = null;
    };
    // intentionally only on mount — alphaTex updates handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render when alphaTex changes.
  useEffect(() => {
    const api = apiRef.current as { tex?: (s: string) => void } | null;
    if (api?.tex) api.tex(alphaTex);
  }, [alphaTex]);

  function togglePlay() {
    const api = apiRef.current as
      | { play?: () => void; pause?: () => void; isReadyForPlayback?: boolean }
      | null;
    if (!api) return;
    if (isPlaying) {
      api.pause?.();
    } else {
      api.play?.();
    }
  }

  function stop() {
    const api = apiRef.current as { stop?: () => void } | null;
    api?.stop?.();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={togglePlay}
          disabled={!ready || !!error}
          className="rounded-md border border-fd-border px-3 py-1 text-xs transition-colors hover:bg-fd-muted disabled:opacity-50"
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          onClick={stop}
          disabled={!ready || !!error}
          className="rounded-md border border-fd-border px-3 py-1 text-xs transition-colors hover:bg-fd-muted disabled:opacity-50"
        >
          Stop
        </button>
        <span className="text-xs text-fd-muted-foreground">
          {error
            ? `alphaTab error: ${error}`
            : ready
              ? "alphaTab ready"
              : "Loading alphaTab…"}
        </span>
      </div>
      <div
        ref={containerRef}
        className="rounded-md border border-fd-border bg-white p-2 dark:bg-neutral-100"
        style={{ minHeight: 200 }}
      />
    </div>
  );
}
