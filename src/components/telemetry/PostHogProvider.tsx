"use client";

import React, { useEffect } from "react";
import { initPostHogClient } from "@/lib/telemetry/posthog-client";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPostHogClient();
  }, []);

  return <>{children}</>;
}
