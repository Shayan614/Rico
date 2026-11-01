"use client";

import type { PostHog } from "posthog-js";

let posthogInstance: PostHog | null = null;
let isPostHogInitialized = false;

export async function initPostHogClient() {
  if (typeof window === "undefined" || isPostHogInitialized) return;

  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const apiHost =
    process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

  if (
    apiKey &&
    apiKey.trim().length > 5 &&
    !apiKey.includes("your_posthog_project_api_key")
  ) {
    try {
      const posthogModule = await import("posthog-js");
      const ph = (posthogModule.default || posthogModule) as unknown as PostHog;
      ph.init(apiKey, {
        api_host: apiHost,
        capture_pageview: true,
        capture_pageleave: true,
        autocapture: true,
        session_recording: {
          recordCrossOriginIframes: true,
        },
        loaded: () => {
          if (process.env.NODE_ENV === "development") {
            console.log("✅ PostHog client initialized successfully");
          }
        },
      });
      posthogInstance = ph;
      isPostHogInitialized = true;
    } catch (err) {
      console.warn("Failed to initialize PostHog client:", err);
    }
  } else {
    // Development fallback mock
    isPostHogInitialized = true;
  }
}

export function captureClientEvent(
  eventName: string,
  properties?: Record<string, unknown>
) {
  if (typeof window === "undefined") return;

  if (posthogInstance && (posthogInstance as unknown as { __loaded?: boolean }).__loaded) {
    posthogInstance.capture(eventName, properties);
  } else if (process.env.NODE_ENV === "development") {
    console.log(`[PostHog Client Telemetry] ${eventName}`, properties || {});
  }
}

export function trackMandateTriggered(mandateId: string, service: string) {
  captureClientEvent("mandate_triggered_by_user", {
    mandate_id: mandateId,
    service,
    source: "dashboard_ui",
  });
}

export function trackReceiptViewed(orderId: string, service: string) {
  captureClientEvent("receipt_viewed", {
    order_id: orderId,
    service,
  });
}

export function trackApprovalDecision(
  service: string,
  approved: boolean,
  price: number
) {
  captureClientEvent("manual_approval_decision", {
    service,
    decision: approved ? "APPROVED" : "REJECTED",
    price,
  });
}

export const posthog = {
  onFeatureFlags: (callback: () => void) => {
    if (posthogInstance && typeof posthogInstance.onFeatureFlags === "function") {
      posthogInstance.onFeatureFlags(callback);
    }
  },
  isFeatureEnabled: (key: string): boolean => {
    if (posthogInstance && typeof posthogInstance.isFeatureEnabled === "function") {
      return Boolean(posthogInstance.isFeatureEnabled(key));
    }
    return false;
  },
  capture: (eventName: string, properties?: Record<string, unknown>) => {
    captureClientEvent(eventName, properties);
  },
};
