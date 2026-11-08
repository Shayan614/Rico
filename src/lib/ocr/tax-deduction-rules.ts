import { ExpenseCategory, TaxDeductionInfo } from "./types";

export interface TaxRule {
  category: ExpenseCategory;
  isDeductible: boolean;
  deductionPercentage: number;
  taxSchedule: string;
  taxCode: string;
  guidelines: string;
}

export const TAX_DEDUCTION_RULES: Record<ExpenseCategory, TaxRule> = {
  SAAS_SUBSCRIPTION: {
    category: "SAAS_SUBSCRIPTION",
    isDeductible: true,
    deductionPercentage: 100,
    taxSchedule: "IRS Schedule C Line 27a (Other Expenses)",
    taxCode: "SEC-179-SAAS",
    guidelines: "100% deductible as ordinary and necessary operational business software expense.",
  },
  CLOUD_INFRASTRUCTURE: {
    category: "CLOUD_INFRASTRUCTURE",
    isDeductible: true,
    deductionPercentage: 100,
    taxSchedule: "IRS Schedule C Line 27a (Hosting & Cloud Services)",
    taxCode: "SEC-162-CLOUD",
    guidelines: "100% deductible hosting, server, and cloud compute expenditure.",
  },
  OFFICE_EQUIPMENT: {
    category: "OFFICE_EQUIPMENT",
    isDeductible: true,
    deductionPercentage: 100,
    taxSchedule: "IRS Schedule C Line 22 (Supplies) & Form 4562",
    taxCode: "SEC-179-EQUIP",
    guidelines: "100% deductible under de minimis safe harbor or Section 179 expensing.",
  },
  TRAVEL_TRANSPORT: {
    category: "TRAVEL_TRANSPORT",
    isDeductible: true,
    deductionPercentage: 100,
    taxSchedule: "IRS Schedule C Line 24a (Travel)",
    taxCode: "SEC-162-TRAVEL",
    guidelines: "100% deductible business airfare, lodging, and transit (excluding personal stays).",
  },
  MEALS_ENTERTAINMENT: {
    category: "MEALS_ENTERTAINMENT",
    isDeductible: true,
    deductionPercentage: 50,
    taxSchedule: "IRS Schedule C Line 24b (Deductible Meals)",
    taxCode: "SEC-274-MEALS-50",
    guidelines: "50% deductible for business meals with clients, partners, or during business travel.",
  },
  PROFESSIONAL_SERVICES: {
    category: "PROFESSIONAL_SERVICES",
    isDeductible: true,
    deductionPercentage: 100,
    taxSchedule: "IRS Schedule C Line 17 (Legal and Professional Services)",
    taxCode: "SEC-162-PRO",
    guidelines: "100% deductible accounting, legal, compliance, and consulting retainers.",
  },
  MARKETING_ADVERTISING: {
    category: "MARKETING_ADVERTISING",
    isDeductible: true,
    deductionPercentage: 100,
    taxSchedule: "IRS Schedule C Line 8 (Advertising)",
    taxCode: "SEC-162-ADS",
    guidelines: "100% deductible online ads, sponsorships, SEO, and promotional campaigns.",
  },
  UTILITIES_COMMUNICATION: {
    category: "UTILITIES_COMMUNICATION",
    isDeductible: true,
    deductionPercentage: 100,
    taxSchedule: "IRS Schedule C Line 25 (Utilities)",
    taxCode: "SEC-162-UTIL",
    guidelines: "100% deductible dedicated business internet, telephony, and web utilities.",
  },
  OTHER: {
    category: "OTHER",
    isDeductible: false,
    deductionPercentage: 0,
    taxSchedule: "Non-deductible / General Ledger",
    taxCode: "NON-DED-GEN",
    guidelines: "Uncategorized personal or miscellaneous expense requiring manual accountant review.",
  },
};

/**
 * Infer category and calculate tax deduction for a line item description
 */
export function evaluateTaxDeduction(
  description: string,
  amount: number,
  categoryHint?: ExpenseCategory
): { category: ExpenseCategory; taxDeduction: TaxDeductionInfo } {
  const desc = description.toLowerCase();
  let category: ExpenseCategory = categoryHint || "OTHER";

  if (!categoryHint) {
    if (
      desc.includes("cloud") ||
      desc.includes("aws") ||
      desc.includes("google cloud") ||
      desc.includes("azure") ||
      desc.includes("server") ||
      desc.includes("render") ||
      desc.includes("supabase") ||
      desc.includes("database") ||
      desc.includes("hosting")
    ) {
      category = "CLOUD_INFRASTRUCTURE";
    } else if (
      desc.includes("saas") ||
      desc.includes("subscription") ||
      desc.includes("software") ||
      desc.includes("github") ||
      desc.includes("figma") ||
      desc.includes("notion") ||
      desc.includes("slack") ||
      desc.includes("netflix") ||
      desc.includes("spotify") ||
      desc.includes("openai") ||
      desc.includes("copilot") ||
      desc.includes("deepseek") ||
      desc.includes("linear") ||
      desc.includes("posthog") ||
      desc.includes("adobe")
    ) {
      category = "SAAS_SUBSCRIPTION";
    } else if (
      desc.includes("meal") ||
      desc.includes("restaurant") ||
      desc.includes("dinner") ||
      desc.includes("lunch") ||
      desc.includes("coffee") ||
      desc.includes("starbucks") ||
      desc.includes("uber eats") ||
      desc.includes("doordash") ||
      desc.includes("catering")
    ) {
      category = "MEALS_ENTERTAINMENT";
    } else if (
      desc.includes("flight") ||
      desc.includes("airline") ||
      desc.includes("hotel") ||
      desc.includes("uber") ||
      desc.includes("lyft") ||
      desc.includes("airbnb") ||
      desc.includes("train")
    ) {
      category = "TRAVEL_TRANSPORT";
    } else if (
      desc.includes("ad") ||
      desc.includes("advertising") ||
      desc.includes("marketing") ||
      desc.includes("meta ads") ||
      desc.includes("google ads") ||
      desc.includes("sponsorship")
    ) {
      category = "MARKETING_ADVERTISING";
    } else if (
      desc.includes("legal") ||
      desc.includes("accounting") ||
      desc.includes("attorney") ||
      desc.includes("cpa") ||
      desc.includes("consulting")
    ) {
      category = "PROFESSIONAL_SERVICES";
    } else if (
      desc.includes("laptop") ||
      desc.includes("monitor") ||
      desc.includes("keyboard") ||
      desc.includes("hardware") ||
      desc.includes("desk") ||
      desc.includes("chair") ||
      desc.includes("apple")
    ) {
      category = "OFFICE_EQUIPMENT";
    } else if (
      desc.includes("internet") ||
      desc.includes("phone") ||
      desc.includes("telecom") ||
      desc.includes("verizon") ||
      desc.includes("at&t")
    ) {
      category = "UTILITIES_COMMUNICATION";
    }
  }

  const rule = TAX_DEDUCTION_RULES[category] || TAX_DEDUCTION_RULES.OTHER;
  const deductibleAmount = Number(
    ((amount * rule.deductionPercentage) / 100).toFixed(2)
  );

  return {
    category,
    taxDeduction: {
      isDeductible: rule.isDeductible,
      deductionPercentage: rule.deductionPercentage,
      deductibleAmount,
      taxSchedule: rule.taxSchedule,
      taxCode: rule.taxCode,
      guidelines: rule.guidelines,
    },
  };
}
