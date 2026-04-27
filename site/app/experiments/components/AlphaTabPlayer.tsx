"use client";

import { useEffect, useRef, useState } from "react";

interface AlphaTabPlayerProps {
  alphaTex: string;
}

const ASSETS_BASE =
  "https://cdn.jsdelivr.net/npm/@coderline/alphatab@1.8.2/dist";
const SCRIPT_SRC = `${ASSETS_BASE}/alphaTab.min.js`;

/**
 * Embeds an interactive alphaTab renderer + audio player.
 *
 * alphaTab is loaded from the CDN as a classical (UMD) script so its worker
 * construction path uses `core.scriptFile` instead of `import.meta.url`.
 * (Importing via npm in a Next.js bundle resolves `import.meta.url` to a
 * file:// path the browser refuses to load.)
 */
export function AlphaTabPlayer({ alphaTex }: AlphaTabPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<unknown>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let api: any = null;

    function init() {
      if (cancelled || !containerRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const at = (window as any).alphaTab;
      if (!at) {
        setError("alphaTab failed to load from CDN.");
        return;
      }

      api = new at.AlphaTabApi(containerRef.current, {
        core: {
          scriptFile: SCRIPT_SRC,
          fontDirectory: `${ASSETS_BASE}/font/`,
          engine: "svg",
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
          scrollMode: 0,
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
        setIsPlaying(e.state === 1);
      });

      apiRef.current = api;
      api.tex(alphaTex);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).alphaTab) {
      init();
    } else {
      let script = document.querySelector<HTMLScriptElement>(
        `script[data-alphatab="1"]`,
      );
      if (!script) {
        script = document.createElement("script");
        script.src = SCRIPT_SRC;
        script.async = true;
        script.dataset.alphatab = "1";
        document.head.appendChild(script);
      }
      script.addEventListener("load", init);
      script.addEventListener("error", () =>
        setError("Failed to load alphaTab from CDN."),
      );
    }

    return () => {
      cancelled = true;
      try {
        api?.destroy?.();
      } catch {
        // ignore
      }
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render when alphaTex changes (after initial load).
  useEffect(() => {
    const api = apiRef.current as { tex?: (s: string) => void } | null;
    if (api?.tex) api.tex(alphaTex);
  }, [alphaTex]);

  function togglePlay() {
    const api = apiRef.current as
      | { play?: () => void; pause?: () => void }
      | null;
    if (!api) return;
    if (isPlaying) api.pause?.();
    else api.play?.();
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
