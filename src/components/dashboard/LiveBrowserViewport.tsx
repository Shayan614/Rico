"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Lock,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  Maximize2,
  Minimize2,
  Terminal,
  Zap,
  Globe,
  Radio,
  CheckCircle2,
  Layers,
  Sparkles,
  Bot,
  TrendingDown,
  Check,
} from "lucide-react";
import { ScreencastFrame, CursorEvent, HelperBotSession, ParallelVerificationResult } from "@/lib/browser/types";

interface LiveBrowserViewportProps {
  onPlanSelected?: (service: string, price: number, planName: string) => void;
  className?: string;
}

const PRESET_MERCHANTS = [
  { name: "Netflix", url: "https://help.netflix.com/en/node/24926" },
  { name: "Spotify", url: "https://www.spotify.com/us/premium/" },
  { name: "GitHub", url: "https://github.com/features/copilot/plans" },
  { name: "AWS", url: "https://aws.amazon.com/pricing/" },
  { name: "ChatGPT", url: "https://openai.com/chatgpt/pricing/" },
];

export function LiveBrowserViewport({
  onPlanSelected,
  className = "",
}: LiveBrowserViewportProps) {
  const [currentFrame, setCurrentFrame] = useState<string | null>(null);
  const [activeUrl, setActiveUrl] = useState<string>(
    "https://help.netflix.com/en/node/24926"
  );
  const [inputUrl, setInputUrl] = useState<string>(
    "https://help.netflix.com/en/node/24926"
  );
  const [pageTitle, setPageTitle] = useState<string>(
    "Netflix Subscription & Pricing"
  );
  const [cursor, setCursor] = useState<CursorEvent | null>({
    x: 410,
    y: 524,
    action: "click",
    label: "Bot #1: Locked ($15.49)",
    timestamp: Date.now(),
  });
  const [fps, setFps] = useState<number>(30);
  const [status, setStatus] = useState<ScreencastFrame["status"]>("ready");
  const [totalFrames, setTotalFrames] = useState<number>(1);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showConsole, setShowConsole] = useState<boolean>(false);
  const [clickRipple, setClickRipple] = useState<{ x: number; y: number } | null>(
    null
  );

  // Parallel Helper Bots State
  const [bots, setBots] = useState<HelperBotSession[]>([]);
  const [activeBotId, setActiveBotId] = useState<string>("bot-netflix");
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [bestDeal, setBestDeal] = useState<ParallelVerificationResult["bestDeal"] | null>(null);

  const [cdpLogs, setCdpLogs] = useState<string[]>([
    "[CDP Engine] Initialized DevTools protocol session",
    "[Page.startScreencast] Format: JPEG, Max 1280x720 @ 30FPS",
    "[Parallel] 3 Helper Bots standby and ready for concurrent dispatch",
    "[Stream] Connected to /api/browser/screencast SSE",
  ]);

  const containerRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Append log entry
  const addLog = useCallback((msg: string) => {
    setCdpLogs((prev) => [
      ...prev.slice(-40),
      `[${new Date().toLocaleTimeString()}] ${msg}`,
    ]);
  }, []);

  // Fetch initial bots
  useEffect(() => {
    fetch("/api/browser/parallel")
      .then((res) => res.json())
      .then((data) => {
        if (data.bots && data.bots.length > 0) {
          setBots(data.bots);
          if (data.activeBotId) setActiveBotId(data.activeBotId);
        }
      })
      .catch((err) => console.warn("Failed to load initial helper bots:", err));
  }, []);

  // Connect to live SSE endpoint
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    function connect() {
      try {
        es = new EventSource("/api/browser/screencast");
        eventSourceRef.current = es;

        es.addEventListener("open", () => {
          setIsConnected(true);
          addLog("Connected to /api/browser/screencast SSE stream");
        });

        es.addEventListener("connected", (event) => {
          setIsConnected(true);
          try {
            const data = JSON.parse(event.data);
            if (data.info?.currentUrl) {
              setActiveUrl(data.info.currentUrl);
              setInputUrl(data.info.currentUrl);
            }
          } catch {
            // ignore
          }
        });

        es.addEventListener("frame", (event) => {
          try {
            const data: ScreencastFrame = JSON.parse(event.data);
            if (data.frame) {
              setCurrentFrame(data.frame);
            }
            if (data.url) {
              setActiveUrl(data.url);
              setInputUrl(data.url);
            }
            if (data.title) {
              setPageTitle(data.title);
            }
            if (data.fps) {
              setFps(data.fps);
            }
            if (data.status) {
              setStatus(data.status);
            }
            if (data.cursor) {
              setCursor(data.cursor);
              if (data.cursor.action === "click") {
                setClickRipple({ x: data.cursor.x, y: data.cursor.y });
                setTimeout(() => setClickRipple(null), 800);
              }
            }
            setTotalFrames((prev) => prev + 1);
          } catch (e) {
            console.error("Failed to parse screencast frame:", e);
          }
        });

        es.onerror = () => {
          setIsConnected(false);
          if (es) {
            es.close();
            es = null;
          }
          reconnectTimer = setTimeout(connect, 3000);
        };
      } catch (err) {
        console.error("SSE connection error:", err);
        reconnectTimer = setTimeout(connect, 3000);
      }
    }

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (es) {
        es.close();
      }
    };
  }, [addLog]);

  // Switch active helper bot tab
  const handleSelectBot = async (botId: string) => {
    setActiveBotId(botId);
    const targetBot = bots.find((b) => b.id === botId);
    if (targetBot) {
      if (targetBot.currentFrame) setCurrentFrame(targetBot.currentFrame);
      setActiveUrl(targetBot.url);
      setInputUrl(targetBot.url);
      setPageTitle(targetBot.title);
      if (targetBot.cursor) setCursor(targetBot.cursor);
      setStatus(targetBot.status);
    }

    try {
      await fetch("/api/browser/parallel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "select_bot", botId }),
      });
      addLog(`[Tab Switch] Switched Viewport to Helper Bot: ${targetBot?.service || botId}`);
    } catch {
      // ignore
    }
  };

  // Run parallel multi-site comparison
  const handleRunComparison = async (preset: "streaming" | "devtools" | "cloud" = "streaming") => {
    setIsComparing(true);
    addLog(`[Parallel Helper Bots] Dispatched concurrent workers for: ${preset.toUpperCase()}`);

    try {
      const res = await fetch("/api/browser/parallel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset }),
      });

      const data = await res.json();
      if (data.success && data.result) {
        setBots(data.result.bots);
        if (data.result.bestDeal) {
          setBestDeal(data.result.bestDeal);
          addLog(
            `[Parallel Result] Best deal found: ${data.result.bestDeal.service} at $${data.result.bestDeal.price}/mo (Save $${data.result.bestDeal.savingsVsHighest})`
          );
        }
      }
    } catch (err) {
      addLog(`[Parallel Error]: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsComparing(false);
    }
  };

  // Navigate to merchant URL using Playwright worker
  const handleNavigate = async (url: string, serviceName?: string) => {
    setIsNavigating(true);
    setStatus("navigating");
    addLog(`Initiating live navigation to: ${url}`);

    try {
      const res = await fetch("/api/browser/navigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, service: serviceName || "Merchant" }),
      });

      const data = await res.json();
      if (data.success && data.result) {
        addLog(
          `Extracted verified price: $${data.result.price} for ${data.result.service}`
        );
        setStatus("ready");
        if (onPlanSelected) {
          onPlanSelected(
            data.result.service,
            data.result.price,
            data.result.planName
          );
        }
      } else {
        addLog(`Navigation completed with status: ${data.result?.source || "ready"}`);
        setStatus("ready");
      }
    } catch (err) {
      addLog(`Navigation error: ${err instanceof Error ? err.message : String(err)}`);
      setStatus("error");
    } finally {
      setIsNavigating(false);
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;
    let urlToUse = inputUrl.trim();
    if (!urlToUse.startsWith("http://") && !urlToUse.startsWith("https://")) {
      urlToUse = `https://${urlToUse}`;
    }
    handleNavigate(urlToUse);
  };

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  const activeBot = bots.find((b) => b.id === activeBotId);

  return (
    <div
      ref={containerRef}
      className={`h-full flex flex-col bg-neutral-950 text-neutral-100 rounded-xl border border-neutral-800 shadow-xl overflow-hidden font-sans select-none ${className}`}
    >
      {/* 1. Zephium-Style Top Browser Toolbar */}
      <div className="h-11 px-3 bg-neutral-900/90 border-b border-neutral-800/80 flex items-center justify-between gap-2 shrink-0">
        {/* Left: Window Controls & Navigation Buttons */}
        <div className="flex items-center gap-2">
          {/* Mac-style Window Dots */}
          <div className="flex items-center gap-1.5 mr-1">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
              title="Back"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
              title="Forward"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleNavigate(activeUrl)}
              disabled={isNavigating}
              className={`p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors ${
                isNavigating ? "animate-spin text-blue-400" : ""
              }`}
              title="Refresh / Re-verify page"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Center: Address Bar with Secure TLS Padlock */}
        <form
          onSubmit={handleUrlSubmit}
          className="flex-1 max-w-xl mx-2 flex items-center"
        >
          <div className="w-full h-7 px-2.5 rounded-lg bg-neutral-950/80 border border-neutral-700/60 focus-within:border-blue-500/80 focus-within:ring-1 focus-within:ring-blue-500/30 flex items-center gap-2 transition-all shadow-inner">
            <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="Enter merchant URL (e.g., https://netflix.com/pricing)..."
              className="w-full bg-transparent text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none font-mono truncate"
            />
            {isNavigating && (
              <span className="text-[10px] text-blue-400 animate-pulse font-mono shrink-0">
                LOADING...
              </span>
            )}
          </div>
        </form>

        {/* Right: Live Stream Status Pills & Actions */}
        <div className="flex items-center gap-2">
          {/* Live 30FPS Screencast Badge */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono border ${
              isConnected
                ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                : "bg-amber-950/40 border-amber-500/30 text-amber-300"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
              }`}
            />
            <span>{fps} FPS LIVE CDP</span>
          </div>

          {/* Console / Telemetry Drawer Toggle */}
          <button
            type="button"
            onClick={() => setShowConsole((prev) => !prev)}
            className={`p-1.5 rounded text-xs transition-colors ${
              showConsole
                ? "bg-neutral-800 text-blue-400 border border-blue-500/40"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
            }`}
            title="Toggle CDP Telemetry Logs"
          >
            <Terminal className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* 2. Feature 2: Parallel Helper Bots Multi-Tab Strip */}
      <div className="px-3 py-1.5 bg-neutral-900/80 border-b border-neutral-800 flex items-center justify-between gap-2 overflow-x-auto scrollbar-none shrink-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-1 text-[10px] uppercase font-mono text-neutral-400 mr-1 shrink-0">
            <Bot className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
            <span className="font-semibold">Parallel Bots:</span>
          </div>

          {bots.map((bot, idx) => {
            const isSelected = activeBotId === bot.id;
            return (
              <button
                key={bot.id}
                type="button"
                onClick={() => handleSelectBot(bot.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all shrink-0 border ${
                  isSelected
                    ? "bg-blue-600 text-white border-blue-500 shadow-md font-semibold"
                    : "bg-neutral-800/80 hover:bg-neutral-800 border-neutral-700/60 text-neutral-300 hover:text-neutral-100"
                }`}
                title={`Click to switch live viewport to Bot #${idx + 1} (${bot.service})`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    bot.status === "navigating"
                      ? "bg-amber-400 animate-ping"
                      : bot.status === "ready"
                      ? "bg-emerald-400"
                      : "bg-blue-400"
                  }`}
                />
                <span>Bot #{idx + 1}:</span>
                <span className="truncate max-w-[90px]">{bot.service.split(" ")[0]}</span>
                {bot.extractedResult && (
                  <span
                    className={`text-[10px] px-1 py-0.2 rounded font-mono font-bold ${
                      isSelected ? "bg-black/40 text-emerald-300" : "bg-neutral-900 text-emerald-400"
                    }`}
                  >
                    ${bot.extractedResult.price.toFixed(2)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Parallel Comparison Launchers */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => handleRunComparison("streaming")}
            disabled={isComparing}
            className={`px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 transition-all ${
              isComparing ? "opacity-60 cursor-not-allowed" : ""
            }`}
            title="Launch concurrent helper bots to compare Netflix vs Spotify vs YouTube"
          >
            <Zap className="w-3 h-3 text-emerald-400" />
            <span>Compare Streaming</span>
          </button>

          <button
            type="button"
            onClick={() => handleRunComparison("devtools")}
            disabled={isComparing}
            className={`px-2 py-0.5 rounded text-[11px] font-medium bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-500/40 flex items-center gap-1 transition-all ${
              isComparing ? "opacity-60 cursor-not-allowed" : ""
            }`}
            title="Launch concurrent helper bots to compare GitHub Copilot vs ChatGPT Plus vs AWS"
          >
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span>Compare Dev Tools</span>
          </button>
        </div>
      </div>

      {/* Best Deal Intelligence Banner (if comparison completed) */}
      {bestDeal && (
        <div className="px-3 py-1.5 bg-emerald-950/30 border-b border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300 animate-in fade-in shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-0.5 rounded bg-emerald-500/20 text-emerald-400">
              <TrendingDown className="w-3.5 h-3.5" />
            </span>
            <span className="font-semibold">
              Best Rate Discovered:
            </span>
            <span className="text-white font-bold">
              {bestDeal.service} ({bestDeal.planName})
            </span>
            <span className="font-mono text-emerald-400 font-bold">
              ${bestDeal.price.toFixed(2)} {bestDeal.currency}/mo
            </span>
            {bestDeal.savingsVsHighest > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-200 font-mono">
                Saves ${bestDeal.savingsVsHighest.toFixed(2)}/mo
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (onPlanSelected) {
                onPlanSelected(bestDeal.service, bestDeal.price, bestDeal.planName);
              }
            }}
            className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] flex items-center gap-1 transition-colors shadow-xs"
          >
            <Check className="w-3 h-3" />
            <span>Lock Best Plan</span>
          </button>
        </div>
      )}

      {/* 3. Quick Preset Merchant Selector Bar */}
      <div className="px-3 py-1.5 bg-neutral-900/40 border-b border-neutral-800/60 flex items-center justify-between text-xs gap-2 shrink-0 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] uppercase font-mono text-neutral-500 tracking-wider flex items-center gap-1 mr-1">
            <Radio className="w-3 h-3 text-blue-400 animate-pulse" />
            Quick Inspect:
          </span>

          {PRESET_MERCHANTS.map((m) => (
            <button
              key={m.name}
              type="button"
              onClick={() => handleNavigate(m.url, m.name)}
              disabled={isNavigating}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                activeUrl.includes(m.name.toLowerCase())
                  ? "bg-blue-600 text-white shadow-xs font-semibold"
                  : "bg-neutral-800/70 hover:bg-neutral-800 text-neutral-300 hover:text-neutral-100 border border-neutral-700/40"
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2 text-[10px] text-neutral-400 font-mono shrink-0">
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3 text-purple-400" />
            <span>Parallel CDP Bots Active</span>
          </span>
          <span className="text-neutral-700">|</span>
          <span className="text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Zero Desktop Installs
          </span>
        </div>
      </div>

      {/* 4. Main Viewport Stage / Canvas Area */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[320px]">
        {/* Live Frame Screen */}
        {currentFrame ? (
          <div className="relative w-full h-full flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentFrame}
              alt="Live Browser Screencast Viewport"
              className="max-w-full max-h-full object-contain pointer-events-none"
            />

            {/* AI Clicking Cursor Overlay */}
            {cursor && (
              <div
                className="absolute pointer-events-none transition-all duration-150 ease-out z-30"
                style={{
                  left: `${(cursor.x / 1280) * 100}%`,
                  top: `${(cursor.y / 720) * 100}%`,
                  transform: "translate(-2px, -2px)",
                }}
              >
                {/* Click Ripple Wave */}
                {clickRipple && (
                  <div className="absolute -left-4 -top-4 w-9 h-9 rounded-full border-2 border-blue-400 bg-blue-500/30 animate-ping" />
                )}

                {/* SVG Pointer Arrow */}
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                >
                  <path
                    d="M3 3L10.07 19.97L12.58 12.58L19.97 10.07L3 3Z"
                    fill="#3b82f6"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>

                {/* AI Cursor Target Label Pill */}
                {cursor.label && (
                  <div className="absolute left-4 top-2 px-2 py-0.5 rounded-full bg-neutral-900/95 border border-blue-500 text-[10px] font-sans font-medium text-neutral-100 whitespace-nowrap shadow-lg flex items-center gap-1 animate-in fade-in duration-100 backdrop-blur-xs">
                    <Sparkles className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                    <span>{cursor.label}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Zap className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-200">
                Initializing Playwright CDP Screencaster...
              </p>
              <p className="text-xs text-neutral-500 mt-0.5">
                Connecting to Chromium DevTools Protocol stream
              </p>
            </div>
          </div>
        )}

        {/* Live Status Overlay Pill (Top Right) */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
          {activeBot && (
            <div className="bg-blue-950/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-blue-500/40 text-[10px] font-mono text-blue-300 font-semibold shadow-lg">
              Active: {activeBot.service.split(" ")[0]}
            </div>
          )}

          <div className="flex items-center gap-1.5 bg-neutral-950/85 backdrop-blur-md px-2.5 py-1 rounded-full border border-neutral-700/60 shadow-lg text-[10px] font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                status === "navigating"
                  ? "bg-amber-400 animate-ping"
                  : status === "evaluating"
                  ? "bg-blue-400 animate-pulse"
                  : "bg-emerald-400"
              }`}
            />
            <span className="text-neutral-300 uppercase">
              {status === "navigating"
                ? "Navigating..."
                : status === "evaluating"
                ? "Inspecting DOM..."
                : status === "extracting"
                ? "Extracting Price..."
                : "Live Stream Active"}
            </span>
          </div>
        </div>
      </div>

      {/* 5. Bottom Collapsible CDP Console / Telemetry Drawer */}
      {showConsole && (
        <div className="h-32 bg-neutral-950 border-t border-neutral-800 p-2.5 text-neutral-300 font-mono text-[11px] overflow-y-auto space-y-1 shrink-0 select-text">
          <div className="flex items-center justify-between pb-1 border-b border-neutral-800 text-[10px] text-neutral-500">
            <span>CHROME DEVTOOLS PROTOCOL &amp; PARALLEL WORKER LOGS</span>
            <span>Frames Streamed: {totalFrames}</span>
          </div>
          {cdpLogs.map((log, idx) => (
            <div key={idx} className="leading-tight text-neutral-400">
              {log}
            </div>
          ))}
        </div>
      )}

      {/* 6. Bottom Status Footer */}
      <div className="h-8 px-3 bg-neutral-900 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400 shrink-0">
        <div className="flex items-center gap-2 truncate max-w-md">
          <Globe className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
          <span className="truncate text-neutral-300" title={pageTitle}>
            {pageTitle || activeUrl}
          </span>
        </div>

        <div className="flex items-center gap-3 font-mono text-[10px] shrink-0">
          <span className="hidden sm:inline text-neutral-500">
            Active Bots: {bots.length}
          </span>
          <span className="text-neutral-600">|</span>
          <span className="text-neutral-400">Frames: {totalFrames}</span>
          <span className="text-neutral-600">|</span>
          <span className="text-emerald-400 font-semibold">{fps} FPS</span>
        </div>
      </div>
    </div>
  );
}
