"use client";

import posthog from "posthog-js";

let isPostHogInitialized = false;

export function initPostHogClient() {
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
      posthog.init(apiKey, {
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

  if (posthog.__loaded) {
    posthog.capture(eventName, properties);
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

export { posthog };
