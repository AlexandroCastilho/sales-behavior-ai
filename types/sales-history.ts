export interface SaleHistoryRecord {
	clientId: string;
	productId: string;
	quantity: number;
	soldAt: string;
}

export interface ProductHistorySummary {
	clientId: string;
	productId: string;
	purchaseCount: number;
	averageQuantity: number;
	lastQuantity?: number;
	lastPurchaseAt?: string;
}
