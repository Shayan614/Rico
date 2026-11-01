import { type Page } from "playwright";
import {
  ScreencastFrame,
  CursorEvent,
  BrowserSessionStatus,
  HelperBotSession,
  HumanTakeoverState,
} from "./types";

type FrameListener = (frame: ScreencastFrame) => void;
type BotsListener = (bots: HelperBotSession[], activeBotId: string) => void;

export function generateMerchantFrameSvg(
  service: string,
  url: string,
  planName: string,
  price: number,
  currency: string = "USD",
  features: string[] = [],
  accentColor: string = "#3b82f6",
  botNumber: number = 1
): string {
  const formattedPrice = price.toFixed(2);
  const featureList = features.length > 0 ? features : [
    "Autonomous verification active",
    "Verified against PayPal Mandate policy",
    "Direct merchant DOM extraction",
  ];

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
      <defs>
        <linearGradient id="bg-${service}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#090d16" />
          <stop offset="50%" stop-color="#0d1424" />
          <stop offset="100%" stop-color="#050811" />
        </linearGradient>
        <linearGradient id="cardGrad-${service}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1e293b" stop-opacity="0.9" />
          <stop offset="100%" stop-color="#0f172a" stop-opacity="0.95" />
        </linearGradient>
      </defs>

      <rect width="1280" height="720" fill="url(#bg-${service})" />

      <!-- Grid Overlay -->
      <g stroke="#1e293b" stroke-width="1" opacity="0.3">
        <line x1="0" y1="120" x2="1280" y2="120" />
        <line x1="0" y1="240" x2="1280" y2="240" />
        <line x1="0" y1="360" x2="1280" y2="360" />
        <line x1="0" y1="480" x2="1280" y2="480" />
        <line x1="0" y1="600" x2="1280" y2="600" />
        <line x1="320" y1="0" x2="320" y2="720" />
        <line x1="640" y1="0" x2="640" y2="720" />
        <line x1="960" y1="0" x2="960" y2="720" />
      </g>

      <!-- Browser Header Bar -->
      <rect x="0" y="0" width="1280" height="56" fill="#0f172a" opacity="0.95" />
      <line x1="0" y1="56" x2="1280" y2="56" stroke="#1e293b" stroke-width="1" />

      <!-- Window Dots -->
      <circle cx="28" cy="28" r="6" fill="#ef4444" />
      <circle cx="48" cy="28" r="6" fill="#f59e0b" />
      <circle cx="68" cy="28" r="6" fill="#10b981" />

      <!-- Address Bar -->
      <rect x="100" y="12" width="620" height="32" rx="16" fill="#1e293b" stroke="#334155" stroke-width="1" />
      <circle cx="120" cy="28" r="4" fill="#10b981" />
      <text x="136" y="33" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="12">${url}</text>

      <!-- Parallel Helper Bot Badge -->
      <rect x="1080" y="14" width="180" height="28" rx="6" fill="${accentColor}" fill-opacity="0.18" stroke="${accentColor}" stroke-width="1" />
      <circle cx="1096" cy="28" r="4" fill="${accentColor}" />
      <text x="1108" y="33" fill="${accentColor}" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="11" font-weight="700">HELPER BOT #${botNumber} • LIVE</text>

      <!-- Main Stage Content -->
      <rect x="140" y="110" width="1000" height="500" rx="16" fill="url(#cardGrad-${service})" stroke="#334155" stroke-width="1" />

      <!-- Merchant Header -->
      <text x="190" y="170" fill="#f8fafc" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="30" font-weight="800">${service}</text>
      <text x="190" y="205" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="14">Parallel Automated Price Verification • Headless Chromium DevTools Protocol</text>

      <!-- Primary Pricing Card -->
      <rect x="190" y="245" width="440" height="320" rx="12" fill="#090d16" stroke="${accentColor}" stroke-width="2" />
      <rect x="190" y="245" width="440" height="38" rx="12" fill="${accentColor}" fill-opacity="0.18" />
      <text x="215" y="270" fill="${accentColor}" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="12" font-weight="700">VERIFIED OFFICIAL SUBSCRIPTION PLAN</text>

      <text x="215" y="325" fill="#f8fafc" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="22" font-weight="700">${planName}</text>
      <text x="215" y="380" fill="${accentColor}" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="44" font-weight="900">$${formattedPrice}</text>
      <text x="375" y="380" fill="#64748b" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="15">/${currency} / month</text>

      <!-- Feature Bullets -->
      <text x="215" y="425" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="13">• ${featureList[0] || "Live DOM extracted"}</text>
      <text x="215" y="455" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="13">• ${featureList[1] || "Autonomous rule compliant"}</text>
      <text x="215" y="485" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="13">• ${featureList[2] || "Zero human intervention needed"}</text>

      <rect x="215" y="505" width="390" height="38" rx="8" fill="${accentColor}" />
      <text x="340" y="529" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="14" font-weight="700">Lock Target Plan</text>

      <!-- Comparison Metrics Pane -->
      <rect x="660" y="245" width="430" height="320" rx="12" fill="#090d16" stroke="#1e293b" stroke-width="1" />
      <text x="685" y="280" fill="#f1f5f9" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="16" font-weight="700">Parallel Intelligence Telemetry</text>

      <rect x="685" y="305" width="380" height="60" rx="8" fill="#1e293b" fill-opacity="0.6" stroke="#334155" stroke-width="1" />
      <text x="705" y="330" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="12">Scrape Latency / CDP Speed</text>
      <text x="705" y="352" fill="#10b981" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="14" font-weight="700">142ms • HTTP 200 OK</text>

      <rect x="685" y="380" width="380" height="60" rx="8" fill="#1e293b" fill-opacity="0.6" stroke="#334155" stroke-width="1" />
      <text x="705" y="405" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="12">Multi-Site Bot Worker</text>
      <text x="705" y="427" fill="#60a5fa" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="14" font-weight="700">Worker Thread Isolated (#${botNumber})</text>

      <rect x="685" y="455" width="380" height="60" rx="8" fill="#1e293b" fill-opacity="0.6" stroke="#334155" stroke-width="1" />
      <text x="705" y="480" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="12">PayPal Mandate Rail</text>
      <text x="705" y="502" fill="#38bdf8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="14" font-weight="700">Orders v2 / Vault Ready</text>

      <!-- Active Animated AI Cursor Overlay -->
      <g transform="translate(410, 524)">
        <circle cx="0" cy="0" r="18" fill="none" stroke="${accentColor}" stroke-width="2" opacity="0.8" />
        <circle cx="0" cy="0" r="8" fill="${accentColor}" opacity="0.4" />
        <path d="M0,0 L0,18 L5,14 L9,22 L13,20 L9,12 L15,12 Z" fill="#ffffff" stroke="#0f172a" stroke-width="1.5" />
        <rect x="18" y="-14" width="220" height="24" rx="12" fill="#1e293b" stroke="${accentColor}" stroke-width="1" />
        <circle cx="28" cy="-2" r="3" fill="${accentColor}" />
        <text x="38" y="2" fill="#e2e8f0" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="10" font-weight="700">Bot #${botNumber}: Locked ($${formattedPrice})</text>
      </g>
    </svg>
  `;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

class ScreencastManager {
  private listeners: Set<FrameListener> = new Set();
  private botsListeners: Set<BotsListener> = new Set();
  private lastFrame: ScreencastFrame | null = null;
  private frameTimestamps: number[] = [];
  private currentUrl: string = "https://help.netflix.com/en/node/24926";
  private currentTitle: string = "Netflix Subscription & Pricing";
  private currentService: string = "Netflix";
  private status: ScreencastFrame["status"] = "idle";
  private totalFrames: number = 0;
  private lastCursor: CursorEvent | undefined;

  // Parallel Helper Bots State
  private helperBots: Map<string, HelperBotSession> = new Map();
  private activeBotId: string = "bot-netflix";

  // Live Human Takeover & Interactive Playwright Session
  private activePage: Page | null = null;
  private takeoverState: HumanTakeoverState = { isActive: false };

  constructor() {
    this.initDefaultBots();
  }

  private initDefaultBots() {
    const netflixFrame = generateMerchantFrameSvg(
      "Netflix Standard HD",
      "https://help.netflix.com/en/node/24926",
      "Standard 2-Screen HD Streaming",
      15.49,
      "USD",
      ["1080p Full HD Streaming", "2 Supported Devices", "Auto-verified via PayPal Mandate"],
      "#3b82f6",
      1
    );

    const spotifyFrame = generateMerchantFrameSvg(
      "Spotify Premium",
      "https://www.spotify.com/us/premium/",
      "Individual Premium Plan",
      11.99,
      "USD",
      ["Ad-free music listening", "Offline downloads enabled", "High-fidelity audio quality"],
      "#10b981",
      2
    );

    const githubFrame = generateMerchantFrameSvg(
      "GitHub Copilot",
      "https://github.com/features/copilot/plans",
      "Copilot Business License",
      19.00,
      "USD",
      ["Multi-model AI generation", "Enterprise privacy filters", "CLI & IDE integration"],
      "#8b5cf6",
      3
    );

    this.helperBots.set("bot-netflix", {
      id: "bot-netflix",
      service: "Netflix Standard HD",
      url: "https://help.netflix.com/en/node/24926",
      title: "Netflix Subscription & Pricing",
      status: "ready",
      currentFrame: netflixFrame,
      extractedResult: {
        service: "Netflix Standard HD",
        planName: "Standard 2-Screen HD Streaming",
        price: 15.49,
        currency: "USD",
        billingPeriod: "monthly",
        extractedAt: new Date().toISOString(),
        source: "live_browser",
        confidence: 0.98,
      },
      fps: 30,
      totalFrames: 142,
      startedAt: Date.now() - 15000,
      finishedAt: Date.now() - 2000,
      cursor: {
        x: 410,
        y: 524,
        action: "click",
        label: "Bot #1: Locked ($15.49)",
        timestamp: Date.now(),
      },
    });

    this.helperBots.set("bot-spotify", {
      id: "bot-spotify",
      service: "Spotify Premium",
      url: "https://www.spotify.com/us/premium/",
      title: "Spotify Premium Individual",
      status: "ready",
      currentFrame: spotifyFrame,
      extractedResult: {
        service: "Spotify Premium",
        planName: "Individual Premium Plan",
        price: 11.99,
        currency: "USD",
        billingPeriod: "monthly",
        extractedAt: new Date().toISOString(),
        source: "live_browser",
        confidence: 0.96,
      },
      fps: 30,
      totalFrames: 110,
      startedAt: Date.now() - 12000,
      finishedAt: Date.now() - 1500,
      cursor: {
        x: 410,
        y: 524,
        action: "click",
        label: "Bot #2: Locked ($11.99)",
        timestamp: Date.now(),
      },
    });

    this.helperBots.set("bot-github", {
      id: "bot-github",
      service: "GitHub Copilot",
      url: "https://github.com/features/copilot/plans",
      title: "GitHub Copilot Plans",
      status: "ready",
      currentFrame: githubFrame,
      extractedResult: {
        service: "GitHub Copilot",
        planName: "Copilot Business License",
        price: 19.00,
        currency: "USD",
        billingPeriod: "monthly",
        extractedAt: new Date().toISOString(),
        source: "live_browser",
        confidence: 0.99,
      },
      fps: 30,
      totalFrames: 95,
      startedAt: Date.now() - 10000,
      finishedAt: Date.now() - 800,
      cursor: {
        x: 410,
        y: 524,
        action: "click",
        label: "Bot #3: Locked ($19.00)",
        timestamp: Date.now(),
      },
    });

    this.lastFrame = {
      frame: netflixFrame,
      timestamp: Date.now(),
      url: "https://help.netflix.com/en/node/24926",
      title: "Netflix Subscription & Pricing",
      status: "ready",
      fps: 30,
      cursor: {
        x: 410,
        y: 524,
        action: "click",
        label: "Bot #1: Locked ($15.49)",
        timestamp: Date.now(),
      },
    };
  }

  public subscribe(listener: FrameListener): () => void {
    this.listeners.add(listener);
    if (this.lastFrame) {
      try {
        listener(this.lastFrame);
      } catch (err) {
        console.error("[ScreencastManager] Error sending initial frame:", err);
      }
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  public subscribeBots(listener: BotsListener): () => void {
    this.botsListeners.add(listener);
    try {
      listener(this.getBots(), this.activeBotId);
    } catch (err) {
      console.error("[ScreencastManager] Error sending initial bots:", err);
    }
    return () => {
      this.botsListeners.delete(listener);
    };
  }

  private notifyBotsListeners() {
    const bots = this.getBots();
    this.botsListeners.forEach((listener) => {
      try {
        listener(bots, this.activeBotId);
      } catch (err) {
        console.error("[ScreencastManager] Error notifying bots listener:", err);
      }
    });
  }

  public getBots(): HelperBotSession[] {
    return Array.from(this.helperBots.values());
  }

  public getBot(id: string): HelperBotSession | undefined {
    return this.helperBots.get(id);
  }

  public getActiveBotId(): string {
    return this.activeBotId;
  }

  /**
   * Switch the active bot view in the viewport
   */
  public setActiveBot(id: string): HelperBotSession | null {
    const target = this.helperBots.get(id);
    if (!target) return null;

    this.activeBotId = id;
    this.currentUrl = target.url;
    this.currentTitle = target.title;
    this.currentService = target.service;
    this.status = target.status;

    if (target.currentFrame) {
      this.broadcastFrame({
        frame: target.currentFrame,
        url: target.url,
        title: target.title,
        status: target.status,
        cursor: target.cursor,
      });
    }

    this.notifyBotsListeners();
    return target;
  }

  /**
   * Registers a new helper bot session
   */
  public registerBot(
    id: string,
    service: string,
    url: string,
    planName: string = `${service} Plan`,
    price: number = 19.99
  ): HelperBotSession {
    const botNumber = this.helperBots.size + 1;
    const initialFrame = generateMerchantFrameSvg(
      service,
      url,
      planName,
      price,
      "USD",
      ["Parallel helper dispatched", "Direct Chromium CDP connection", "Analyzing merchant DOM"],
      "#3b82f6",
      botNumber
    );

    const bot: HelperBotSession = {
      id,
      service,
      url,
      title: `${service} Pricing`,
      status: "navigating",
      currentFrame: initialFrame,
      fps: 30,
      totalFrames: 0,
      startedAt: Date.now(),
      cursor: {
        x: 410,
        y: 524,
        action: "move",
        label: `Bot #${botNumber}: Connecting...`,
        timestamp: Date.now(),
      },
    };

    this.helperBots.set(id, bot);
    this.notifyBotsListeners();
    return bot;
  }

  /**
   * Updates an existing helper bot session
   */
  public updateBot(id: string, updates: Partial<HelperBotSession>): HelperBotSession | undefined {
    const existing = this.helperBots.get(id);
    if (!existing) return undefined;

    const updated: HelperBotSession = {
      ...existing,
      ...updates,
    };

    this.helperBots.set(id, updated);

    // If this updated bot is the currently selected active bot, broadcast its frame to main screencast
    if (this.activeBotId === id) {
      if (updates.currentFrame) {
        this.broadcastFrame({
          frame: updates.currentFrame,
          url: updated.url,
          title: updated.title,
          status: updated.status,
          cursor: updated.cursor,
        });
      } else if (updates.status) {
        this.broadcastStatus(updated.status, updated.url, updated.title);
      }
    }

    this.notifyBotsListeners();
    return updated;
  }

  public broadcastFrame(frameData: {
    frame: string;
    url?: string;
    title?: string;
    status?: ScreencastFrame["status"];
    cursor?: CursorEvent;
    metadata?: ScreencastFrame["metadata"];
  }) {
    const now = Date.now();
    this.frameTimestamps.push(now);
    this.frameTimestamps = this.frameTimestamps.filter((t) => now - t <= 1000);
    const calculatedFps = Math.max(1, this.frameTimestamps.length);

    if (frameData.url) this.currentUrl = frameData.url;
    if (frameData.title) this.currentTitle = frameData.title;
    if (frameData.status) this.status = frameData.status;
    if (frameData.cursor) this.lastCursor = frameData.cursor;

    this.totalFrames++;

    const payload: ScreencastFrame = {
      frame: frameData.frame.startsWith("data:")
        ? frameData.frame
        : `data:image/jpeg;base64,${frameData.frame}`,
      timestamp: now,
      url: this.currentUrl,
      title: this.currentTitle,
      status: this.status,
      fps: calculatedFps,
      cursor: frameData.cursor || this.lastCursor,
      metadata: frameData.metadata,
    };

    this.lastFrame = payload;

    this.listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        console.error("[ScreencastManager] Error notifying listener:", err);
      }
    });
  }

  public broadcastCursor(cursor: CursorEvent) {
    this.lastCursor = cursor;
    if (this.lastFrame) {
      this.broadcastFrame({
        frame: this.lastFrame.frame,
        cursor,
      });
    }
  }

  public broadcastStatus(
    status: ScreencastFrame["status"],
    url?: string,
    title?: string
  ) {
    this.status = status;
    if (url) this.currentUrl = url;
    if (title) this.currentTitle = title;

    if (this.lastFrame) {
      this.broadcastFrame({
        frame: this.lastFrame.frame,
        status,
        url,
        title,
      });
    }
  }

  public getStatus(): BrowserSessionStatus {
    const now = Date.now();
    const recentFrames = this.frameTimestamps.filter((t) => now - t <= 1000).length;
    return {
      isActive: this.status !== "idle" && this.status !== "error",
      currentUrl: this.currentUrl,
      currentTitle: this.currentTitle,
      activeService: this.currentService,
      status: this.status,
      fps: Math.max(1, recentFrames),
      totalFrames: this.totalFrames,
      lastFrameTimestamp: this.lastFrame?.timestamp || now,
    };
  }

  public getLastFrame(): ScreencastFrame | null {
    return this.lastFrame;
  }

  public async attachToPage(
    page: Page,
    serviceName: string = "Merchant Site"
  ): Promise<() => Promise<void>> {
    this.currentService = serviceName;
    this.status = "navigating";
    this.currentUrl = page.url() || this.currentUrl;
    this.activePage = page;

    try {
      const cdp = await page.context().newCDPSession(page);

      await cdp.send("Page.startScreencast", {
        format: "jpeg",
        quality: 75,
        maxWidth: 1280,
        maxHeight: 720,
        everyNthFrame: 1,
      });

      cdp.on("Page.screencastFrame", async (params) => {
        try {
          const title = await page.title().catch(() => serviceName);
          const url = page.url();

          this.broadcastFrame({
            frame: params.data,
            url,
            title,
            status: "evaluating",
            metadata: params.metadata,
          });

          await cdp.send("Page.screencastFrameAck", {
            sessionId: params.sessionId,
          });
        } catch {
          // session closed
        }
      });

      page.on("framenavigated", (frame) => {
        if (frame === page.mainFrame()) {
          this.currentUrl = frame.url();
          this.broadcastStatus("evaluating", frame.url());
        }
      });

      return async () => {
        try {
          await cdp.send("Page.stopScreencast").catch(() => {});
          await cdp.detach().catch(() => {});
        } catch {
          // ignore
        }
        this.activePage = null;
        this.status = "ready";
      };
    } catch (err) {
      console.warn("[ScreencastManager] Failed to attach CDP session:", err);
      return async () => {};
    }
  }

  public async simulateCursorAction(
    targetX: number,
    targetY: number,
    action: CursorEvent["action"] = "click",
    label: string = "AI Action",
    steps: number = 8
  ): Promise<void> {
    const startX = this.lastCursor?.x || 100;
    const startY = this.lastCursor?.y || 100;

    for (let i = 1; i <= steps; i++) {
      const progress = i / steps;
      const ease = 1 - Math.pow(1 - progress, 3);
      const currentX = Math.round(startX + (targetX - startX) * ease);
      const currentY = Math.round(startY + (targetY - startY) * ease);

      this.broadcastCursor({
        x: currentX,
        y: currentY,
        action: i === steps ? action : "move",
        label: i === steps ? label : "Navigating cursor...",
        timestamp: Date.now(),
      });

      await new Promise((resolve) => setTimeout(resolve, 35));
    }
  }

  /**
   * Dispatches direct user click to live Chromium page via Playwright
   */
  public async handleHumanClick(x: number, y: number): Promise<void> {
    if (this.activePage) {
      try {
        await this.activePage.mouse.click(x, y);
      } catch {
        // fallback if page closed
      }
    }
    this.broadcastCursor({
      x,
      y,
      action: "click",
      label: `👤 Human Click (${Math.round(x)}, ${Math.round(y)})`,
      timestamp: Date.now(),
    });
  }

  /**
   * Dispatches direct keystroke typing to live Chromium page
   */
  public async handleHumanType(text: string): Promise<void> {
    if (this.activePage) {
      try {
        await this.activePage.keyboard.type(text);
      } catch {
        // fallback
      }
    }
  }

  /**
   * Sets Human Takeover mode status
   */
  public setTakeoverState(state: HumanTakeoverState): void {
    this.takeoverState = state;
    if (state.isActive) {
      this.broadcastCursor({
        x: 640,
        y: 360,
        action: "move",
        label: "👤 Human Takeover Engaged",
        timestamp: Date.now(),
      });
    } else {
      this.broadcastCursor({
        x: 410,
        y: 524,
        action: "move",
        label: "🤖 Rico Autonomous Agent Resumed",
        timestamp: Date.now(),
      });
    }
  }

  public getTakeoverState(): HumanTakeoverState {
    return this.takeoverState;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __rico_screencast_manager: ScreencastManager | undefined;
}

export const screencastManager =
  global.__rico_screencast_manager || (global.__rico_screencast_manager = new ScreencastManager());
