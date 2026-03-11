import { ParsedOrderItem, RiskLevel } from "./product";
import { ProductHistorySummary } from "./sales-history";

export type RuleCode =
	| "NEW_PRODUCT_FOR_CLIENT"
	| "QUANTITY_SPIKE"
	| "INSUFFICIENT_HISTORY";

export interface RuleFinding {
	code: RuleCode;
	message: string;
	severity: "INFO" | "WARN" | "CRITICAL";
}

export interface AnalysisItemResult {
	item: ParsedOrderItem;
	history?: ProductHistorySummary;
	findings: RuleFinding[];
	itemRisk: RiskLevel;
}

export interface AnalysisResult {
	clientId: string;
	runAt: string;
	overallRisk: RiskLevel;
	items: AnalysisItemResult[];
	aiSummary: string;
}

export interface AnalyzeOrderInput {
	clientId: string;
	fileName: string;
	userId?: string;
	pdfBase64?: string;
	parsedItems?: ParsedOrderItem[];
	persistResult?: boolean;
}
