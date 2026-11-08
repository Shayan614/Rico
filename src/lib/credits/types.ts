export type FundingStage =
  | "BOOTSTRAPPED"
  | "PRE_SEED"
  | "SEED"
  | "SERIES_A";

export type ProgramCategory =
  | "CLOUD"
  | "ANALYTICS"
  | "AI_COMPUTE"
  | "PAYMENT_PROCESSING"
  | "PRODUCTIVITY"
  | "DEVTOOLS"
  | "EDUCATION";

export interface FounderProfile {
  name: string;
  companyName: string;
  websiteUrl?: string;
  foundedYear: number;
  fundingStage: FundingStage;
  totalFundingRaisedUsd: number;
  monthlyBurnRateUsd: number;
  cashRunwayMonths?: number;
  techStack: string[];
  productCategory: string;
  tagline: string;
  description: string;
  isStudentFounder?: boolean;
  universityName?: string;
  studentEmail?: string;
}

export interface CreditProgram {
  id: string;
  name: string;
  provider: string;
  category: ProgramCategory;
  maxCreditValueUsd: number;
  creditTermMonths: number;
  programUrl: string;
  badge: string;
  eligibility: {
    maxCompanyAgeYears?: number;
    maxFundingRaisedUsd?: number;
    allowedStages?: FundingStage[];
    requiresWebsite?: boolean;
    requiresEduEmail?: boolean;
  };
  overview: string;
  sampleQuestions: Array<{
    id: string;
    question: string;
    guideline: string;
  }>;
}

export interface MatchedCredit {
  program: CreditProgram;
  isEligible: boolean;
  matchScore: number; // 0 to 100
  estimatedValueUsd: number;
  runwayMonthsAdded: number;
  dilutionEquivalentPercent: number;
  eligibilityReasons: string[];
  disqualificationReasons: string[];
}

export interface CreditPitchDraft {
  programId: string;
  programName: string;
  answers: Record<string, string>;
  oneLinerPitch: string;
  readinessScore: number;
  generatedAt: string;
}

export interface CreditMatchingReport {
  profile: FounderProfile;
  totalEligiblePrograms: number;
  totalPotentialCreditsUsd: number;
  runwayExtensionMonths: number;
  dilutionSavedPercent: number;
  topMatches: MatchedCredit[];
  stackCostBeforeCreditsUsd: number;
  stackCostAfterCreditsUsd: number;
  generatedAt: string;
}
