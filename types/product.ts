export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "INCONCLUSIVE";

export interface Product {
	id: string;
	sku: string;
	name: string;
	aliases?: string[];
}

export interface OrderItemInput {
	rawDescription: string;
	quantity: number;
	unitPrice?: number;
}

export interface ParsedOrderItem {
	rawDescription: string;
	quantity: number;
	unitPrice?: number;
	matchedProductId?: string;
	matchedProductName?: string;
	confidence: number;
}
