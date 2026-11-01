export interface ScrapedPriceResult {
  service: string;
  url?: string;
  planName: string;
  price: number;
  currency: string;
  billingPeriod: string;
  extractedAt: string;
  source: "live_browser" | "cache_fallback";
  confidence: number;
  rawText?: string;
}

export interface BrowserScrapeOptions {
  headless?: boolean;
  timeoutMs?: number;
  serviceUrl?: string;
}

export interface MerchantPricingProfile {
  name: string;
  defaultUrl: string;
  planName: string;
  baselinePrice: number;
  currency: string;
  billingPeriod: string;
  priceSelectors: string[];
}


export interface CursorEvent {
  x: number;
  y: number;
  action: "move" | "click" | "scroll" | "type";
  label?: string;
  timestamp: number;
}

export interface ScreencastFrame {
  frame: string; // base64 JPEG
  timestamp: number;
  url: string;
  title: string;
  status: "idle" | "navigating" | "evaluating" | "extracting" | "ready" | "error";
  fps: number;
  cursor?: CursorEvent;
  metadata?: {
    offsetTop?: number;
    pageScaleFactor?: number;
    deviceWidth?: number;
    deviceHeight?: number;
    scrollOffsetX?: number;
    scrollOffsetY?: number;
  };
}

export interface BrowserSessionStatus {
  isActive: boolean;
  currentUrl: string;
  currentTitle: string;
  activeService?: string;
  status: "idle" | "navigating" | "evaluating" | "extracting" | "ready" | "error";
  fps: number;
  totalFrames: number;
  lastFrameTimestamp: number;
  lastExtractedPrice?: number;
}

