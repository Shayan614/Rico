import { PayPalConfigError, PayPalPaymentError } from "./errors";
import { PayPalOAuthToken } from "./types";

const SANDBOX_BASE_URL = "https://api-m.sandbox.paypal.com";
const LIVE_BASE_URL = "https://api-m.paypal.com";
const DEFAULT_TIMEOUT_MS = 30000;

export type PayPalMode = "real" | "mock";

class PayPalOAuthManager {
  private cachedToken: PayPalOAuthToken | null = null;

  public getEnvironment(): "sandbox" | "live" {
    return (process.env.PAYPAL_ENVIRONMENT || "sandbox").toLowerCase() === "live"
      ? "live"
      : "sandbox";
  }

  public getBaseUrl(): string {
    return this.getEnvironment() === "live" ? LIVE_BASE_URL : SANDBOX_BASE_URL;
  }

  public getClientId(): string {
    return process.env.PAYPAL_CLIENT_ID || "";
  }

  public getClientSecret(): string {
    return process.env.PAYPAL_CLIENT_SECRET || "";
  }

  public isLiveCredentialsConfigured(): boolean {
    const id = this.getClientId();
    const secret = this.getClientSecret();
    return (
      id.length > 10 &&
      secret.length > 10 &&
      !id.startsWith("your_") &&
      !id.startsWith("sandbox_mock") &&
      !secret.startsWith("your_") &&
      !secret.startsWith("sandbox_mock")
    );
  }

  /**
   * Decides between real PayPal calls and the simulator. Runtime failures never change the mode.
   * Without PAYPAL_MODE, missing credentials mean mock only outside production.
   */
  public getMode(): PayPalMode {
    const explicit = (process.env.PAYPAL_MODE || "").trim().toLowerCase();
    const hasCredentials = this.isLiveCredentialsConfigured();
    const isLiveEnvironment = this.getEnvironment() === "live";

    if (explicit === "mock") {
      if (isLiveEnvironment) {
        throw new PayPalConfigError("PAYPAL_MODE=mock cannot be used with PAYPAL_ENVIRONMENT=live.");
      }
      return "mock";
    }
    if (explicit === "real") {
      if (!hasCredentials) {
        throw new PayPalConfigError("PAYPAL_MODE=real requires PayPal credentials.");
      }
      return "real";
    }
    if (explicit) {
      throw new PayPalConfigError('PAYPAL_MODE must be "real" or "mock".');
    }
    if (hasCredentials) return "real";
    if (isLiveEnvironment || process.env.NODE_ENV === "production") {
      throw new PayPalConfigError(
        "PayPal credentials are missing. Configure them, or set PAYPAL_MODE=mock for a demo."
      );
    }
    return "mock";
  }

  public getTimeoutMs(): number {
    const configured = Number(process.env.PAYPAL_TIMEOUT_MS);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
  }

  /**
   * Retrieves an active OAuth2 Bearer token with automatic refresh
   */
  public async getAccessToken(): Promise<string> {
    const mode = this.getMode();
    const now = Date.now();

    // Check if token is still valid with 60 seconds grace period
    if (this.cachedToken && this.cachedToken.expires_at > now + 60000) {
      return this.cachedToken.access_token;
    }

    if (mode === "real") {
      const credentials = Buffer.from(
        `${this.getClientId()}:${this.getClientSecret()}`
      ).toString("base64");

      let response: Response;
      let data: Partial<PayPalOAuthToken> | null = null;
      try {
        response = await fetch(`${this.getBaseUrl()}/v1/oauth2/token`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: "grant_type=client_credentials",
          signal: AbortSignal.timeout(this.getTimeoutMs()),
        });
        if (response.ok) data = await response.json();
      } catch (err) {
        throw new PayPalPaymentError(
          `PayPal OAuth request failed: ${err instanceof Error ? err.name : "unknown error"}`,
          { kind: "UNKNOWN_OUTCOME", operation: "oauth" }
        );
      }

      if (!response.ok || !data?.access_token) {
        throw new PayPalPaymentError(`PayPal OAuth failed with HTTP ${response.status}`, {
          kind: "UNKNOWN_OUTCOME",
          operation: "oauth",
          httpStatus: response.status,
        });
      }

      this.cachedToken = {
        access_token: data.access_token,
        token_type: data.token_type || "Bearer",
        app_id: data.app_id || "APP-PAYPAL-SANDBOX",
        expires_in: data.expires_in || 32400,
        nonce: data.nonce || `nonce-${Date.now()}`,
        scope: data.scope || "https://uri.paypal.com/services/payments",
        expires_at: now + (data.expires_in || 32400) * 1000,
      };
      return this.cachedToken.access_token;
    }

    // High-fidelity Sandbox Token Generator
    const simulatedExpiresIn = 32400; // 9 hours
    const mockToken = `A21AA${Math.random()
      .toString(36)
      .substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}_SANDBOX_TOKEN`;

    this.cachedToken = {
      access_token: mockToken,
      token_type: "Bearer",
      app_id: "APP-PAYAGENT-SANDBOX-2026",
      expires_in: simulatedExpiresIn,
      nonce: `nonce-${Date.now()}`,
      scope: "https://uri.paypal.com/services/payments",
      expires_at: now + simulatedExpiresIn * 1000,
    };

    return this.cachedToken.access_token;
  }

  public clearCache(): void {
    this.cachedToken = null;
  }
}

export const payPalOAuth = new PayPalOAuthManager();
