declare module "posthog-js" {
  export interface PostHog {
    init(apiKey: string, options?: Record<string, unknown>): void;
    capture(event: string, properties?: Record<string, unknown>): void;
    identify(distinctId: string, userProperties?: Record<string, unknown>): void;
    reset(): void;
    onFeatureFlags?(callback: () => void): void;
    isFeatureEnabled?(key: string): boolean;
  }
  const posthog: PostHog;
  export default posthog;
}
