export type AnalysisResponse = {
  overallRisk?: string;
  aiSummary?: string;
  items?: Array<{
    itemRisk?: string;
    item?: {
      rawDescription?: string;
      quantity?: number;
      matchedProductName?: string;
    };
    findings?: Array<{ message?: string }>;
  }>;
  message?: string;
  detail?: string;
  rawText?: string;
};
