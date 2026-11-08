import { db } from "@/db";
import { mandates, MandateRecord } from "@/db/schema";
import { MatchedMandateInfo } from "./types";

export class MandateMatcher {
  private cachedMandates: MandateRecord[] | null = null;
  private lastFetchTime: number = 0;
  private readonly cacheTtlMs: number = 10000;

  /**
   * Fetch active mandates from SQLite with cached TTL
   */
  private async getActiveMandates(): Promise<MandateRecord[]> {
    const now = Date.now();
    if (this.cachedMandates && now - this.lastFetchTime < this.cacheTtlMs) {
      return this.cachedMandates;
    }

    try {
      const records = await db.select().from(mandates);
      this.cachedMandates = records;
      this.lastFetchTime = now;
      return records;
    } catch {
      // Return empty if DB is locked or in disconnected mock environment
      return this.cachedMandates || [];
    }
  }

  /**
   * Normalize vendor or service string for fuzzy matching
   */
  public normalizeServiceName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\b(inc|llc|ltd|corp|corporation|technologies|services|com|co)\b/gi, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();
  }

  /**
   * Cross-match invoice vendor and amount against active mandates
   */
  public async matchInvoiceToMandate(
    vendorName: string,
    invoiceTotalUsd: number
  ): Promise<MatchedMandateInfo | undefined> {
    const activeMandates = await this.getActiveMandates();
    if (activeMandates.length === 0) return undefined;

    const normalizedVendor = this.normalizeServiceName(vendorName);

    // Look for matching service
    const matchedMandate = activeMandates.find((m) => {
      const normalizedMandate = this.normalizeServiceName(m.service);
      return (
        normalizedVendor.includes(normalizedMandate) ||
        normalizedMandate.includes(normalizedVendor)
      );
    });

    if (!matchedMandate) return undefined;

    const ceiling = matchedMandate.budgetCeiling;
    const discrepancyUsd = Number((invoiceTotalUsd - ceiling).toFixed(2));
    const exceedsCeiling = invoiceTotalUsd > ceiling;

    let status: MatchedMandateInfo["status"] = "WITHIN_BUDGET";
    if (exceedsCeiling) {
      const ratio = invoiceTotalUsd / ceiling;
      status = ratio >= 1.2 || matchedMandate.strictMode ? "ANOMALY_HOLD" : "EXCEEDS_BUDGET";
    }

    return {
      mandateId: matchedMandate.id,
      service: matchedMandate.service,
      budgetCeiling: ceiling,
      exceedsCeiling,
      discrepancyUsd,
      status,
    };
  }
}

export const mandateMatcher = new MandateMatcher();
