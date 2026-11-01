import { type Page } from "playwright";
import {
  ScreencastFrame,
  CursorEvent,
  BrowserSessionStatus,
} from "./types";

type FrameListener = (frame: ScreencastFrame) => void;

class ScreencastManager {
  private listeners: Set<FrameListener> = new Set();
  private lastFrame: ScreencastFrame | null = null;
  private frameTimestamps: number[] = [];
  private currentUrl: string = "https://help.netflix.com/en/node/24926";
  private currentTitle: string = "Netflix Subscription & Pricing";
  private currentService: string = "Netflix";
  private status: ScreencastFrame["status"] = "idle";
  private totalFrames: number = 0;
  private lastCursor: CursorEvent | undefined;

  constructor() {
    this.initDefaultFrame();
  }

  private initDefaultFrame() {
    // Generate an initial high-fidelity Zephium-themed standby frame
    const svgStandby = `
      <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#090d16" />
            <stop offset="50%" stop-color="#0d1424" />
            <stop offset="100%" stop-color="#050811" />
          </linearGradient>
          <linearGradient id="cardGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#1e293b" stop-opacity="0.8" />
            <stop offset="100%" stop-color="#0f172a" stop-opacity="0.9" />
          </linearGradient>
          <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#3b82f6" />
            <stop offset="100%" stop-color="#06b6d4" />
          </linearGradient>
        </defs>

        <rect width="1280" height="720" fill="url(#bg)" />

        <!-- Grid Lines -->
        <g stroke="#1e293b" stroke-width="1" opacity="0.3">
          <line x1="0" y1="120" x2="1280" y2="120" />
          <line x1="0" y1="240" x2="1280" y2="240" />
          <line x1="0" y1="360" x2="1280" y2="360" />
          <line x1="0" y1="480" x2="1280" y2="480" />
          <line x1="0" y1="600" x2="1280" y2="600" />
          <line x1="256" y1="0" x2="256" y2="720" />
          <line x1="512" y1="0" x2="512" y2="720" />
          <line x1="768" y1="0" x2="768" y2="720" />
          <line x1="1024" y1="0" x2="1024" y2="720" />
        </g>

        <!-- Browser Header Bar Mock -->
        <rect x="0" y="0" width="1280" height="56" fill="#0f172a" opacity="0.95" />
        <line x1="0" y1="56" x2="1280" y2="56" stroke="#1e293b" stroke-width="1" />

        <!-- Window Dots -->
        <circle cx="28" cy="28" r="6" fill="#ef4444" />
        <circle cx="48" cy="28" r="6" fill="#f59e0b" />
        <circle cx="68" cy="28" r="6" fill="#10b981" />

        <!-- Address Bar -->
        <rect x="100" y="12" width="600" height="32" rx="16" fill="#1e293b" stroke="#334155" stroke-width="1" />
        <circle cx="120" cy="28" r="4" fill="#10b981" />
        <text x="136" y="33" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="13">https://help.netflix.com/en/node/24926 (CDP Screencast Engine Ready)</text>

        <!-- Status Tag -->
        <rect x="1120" y="14" width="140" height="28" rx="6" fill="#0284c7" fill-opacity="0.2" stroke="#0284c7" stroke-width="1" />
        <circle cx="1136" cy="28" r="4" fill="#38bdf8" />
        <text x="1148" y="33" fill="#38bdf8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="12" font-weight="600">30 FPS CDP STREAM</text>

        <!-- Hero Content -->
        <rect x="160" y="120" width="960" height="480" rx="16" fill="url(#cardGrad)" stroke="#334155" stroke-width="1" />

        <text x="210" y="180" fill="#f8fafc" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="28" font-weight="700">Rico Autonomous Headless CDP Viewport</text>
        <text x="210" y="215" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="15">Zephium-Inspired Clean Screencasting • Direct Chromium DevTools Protocol</text>

        <!-- Plan Pricing Cards -->
        <!-- Card 1: Standard Plan -->
        <rect x="210" y="260" width="280" height="270" rx="12" fill="#090d16" stroke="#3b82f6" stroke-width="2" />
        <rect x="210" y="260" width="280" height="36" rx="12" fill="#3b82f6" fill-opacity="0.15" />
        <text x="230" y="284" fill="#60a5fa" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="13" font-weight="600">MOST POPULAR • TARGET PLAN</text>
        <text x="230" y="335" fill="#f8fafc" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="20" font-weight="600">Standard HD</text>
        <text x="230" y="380" fill="#38bdf8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="34" font-weight="800">$15.49</text>
        <text x="355" y="380" fill="#64748b" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="14">/month</text>
        <text x="230" y="420" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="13">• 1080p Full HD Streaming</text>
        <text x="230" y="445" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="13">• 2 Supported Devices</text>
        <text x="230" y="470" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="13">• Auto-verified with PayPal Mandate</text>

        <rect x="230" y="490" width="240" height="32" rx="6" fill="#2563eb" />
        <text x="300" y="511" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="13" font-weight="600">Selected Plan</text>

        <!-- Card 2: Premium Plan -->
        <rect x="520" y="260" width="260" height="270" rx="12" fill="#090d16" stroke="#1e293b" stroke-width="1" />
        <text x="540" y="335" fill="#f8fafc" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="20" font-weight="600">Premium 4K + HDR</text>
        <text x="540" y="380" fill="#f1f5f9" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="34" font-weight="800">$22.99</text>
        <text x="665" y="380" fill="#64748b" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="14">/month</text>
        <text x="540" y="420" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="13">• Ultra HD 4K + Spatial Audio</text>
        <text x="540" y="445" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="13">• 4 Supported Devices</text>
        <text x="540" y="470" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="13">• Exceeds $20.00 Budget Cap</text>

        <!-- Card 3: Standard with Ads -->
        <rect x="810" y="260" width="260" height="270" rx="12" fill="#090d16" stroke="#1e293b" stroke-width="1" />
        <text x="830" y="335" fill="#f8fafc" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="20" font-weight="600">Standard with Ads</text>
        <text x="830" y="380" fill="#f1f5f9" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="34" font-weight="800">$6.99</text>
        <text x="930" y="380" fill="#64748b" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="14">/month</text>
        <text x="830" y="420" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="13">• 1080p Full HD Streaming</text>
        <text x="830" y="445" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="13">• Ad-supported tier</text>
        <text x="830" y="470" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="13">• Lowest monthly commitment</text>

        <!-- Active AI Cursor Demo -->
        <g transform="translate(350, 506)">
          <!-- Click Ripple -->
          <circle cx="0" cy="0" r="16" fill="none" stroke="#60a5fa" stroke-width="2" opacity="0.8" />
          <circle cx="0" cy="0" r="8" fill="#3b82f6" opacity="0.3" />
          <!-- Pointer Cursor -->
          <path d="M0,0 L0,18 L5,14 L9,22 L13,20 L9,12 L15,12 Z" fill="#ffffff" stroke="#0f172a" stroke-width="1.5" />
          <!-- Label Pill -->
          <rect x="18" y="-14" width="160" height="24" rx="12" fill="#1e293b" stroke="#3b82f6" stroke-width="1" />
          <circle cx="28" cy="-2" r="3" fill="#38bdf8" />
          <text x="36" y="2" fill="#e2e8f0" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="10" font-weight="600">AI Cursor: Target Locked</text>
        </g>
      </svg>
    `;

    const base64Svg = Buffer.from(svgStandby).toString("base64");
    this.lastFrame = {
      frame: `data:image/svg+xml;base64,${base64Svg}`,
      timestamp: Date.now(),
      url: this.currentUrl,
      title: this.currentTitle,
      status: "ready",
      fps: 30,
      cursor: {
        x: 350,
        y: 506,
        action: "click",
        label: "AI Cursor: Target Locked ($15.49/mo)",
        timestamp: Date.now(),
      },
    };
  }

  public subscribe(listener: FrameListener): () => void {
    this.listeners.add(listener);
    // Send immediate current state
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
    // Keep timestamps from the last 1000ms
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

  /**
   * Attaches direct CDP Screencasting to a live Playwright page
   */
  public async attachToPage(
    page: Page,
    serviceName: string = "Merchant Site"
  ): Promise<() => Promise<void>> {
    this.currentService = serviceName;
    this.status = "navigating";
    this.currentUrl = page.url() || this.currentUrl;

    try {
      const cdp = await page.context().newCDPSession(page);

      // Start Screencast at 30FPS quality 75
      await cdp.send("Page.startScreencast", {
        format: "jpeg",
        quality: 75,
        maxWidth: 1280,
        maxHeight: 720,
        everyNthFrame: 1,
      });

      // Handle live incoming screencast frames
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

          // Acknowledge frame to receive next frame continuously
          await cdp.send("Page.screencastFrameAck", {
            sessionId: params.sessionId,
          });
        } catch {
          // session may be closing
        }
      });

      // Track URL updates
      page.on("framenavigated", (frame) => {
        if (frame === page.mainFrame()) {
          this.currentUrl = frame.url();
          this.broadcastStatus("evaluating", frame.url());
        }
      });

      // Return cleanup function
      return async () => {
        try {
          await cdp.send("Page.stopScreencast").catch(() => {});
          await cdp.detach().catch(() => {});
        } catch {
          // ignore cleanup errors
        }
        this.status = "ready";
      };
    } catch (err) {
      console.warn("[ScreencastManager] Failed to attach CDP session:", err);
      return async () => {};
    }
  }

  /**
   * Simulates visual AI cursor movement and clicking over an element coordinate
   */
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
      // Smooth ease-out curve
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
}

// Global Singleton to ensure Next.js hot reloads preserve instance
declare global {
  // eslint-disable-next-line no-var
  var __rico_screencast_manager: ScreencastManager | undefined;
}

export const screencastManager =
  global.__rico_screencast_manager || (global.__rico_screencast_manager = new ScreencastManager());
