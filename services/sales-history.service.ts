import { ProductHistorySummary, SaleHistoryRecord } from "@/types/sales-history";
import { getPrismaClient } from "@/lib/prisma";

const inMemoryHistory: SaleHistoryRecord[] = [
	{
		clientId: "client-demo",
		productId: "prod-cafe-500g",
		quantity: 12,
		soldAt: "2026-01-10",
	},
	{
		clientId: "client-demo",
		productId: "prod-cafe-500g",
		quantity: 10,
		soldAt: "2026-02-05",
	},
	{
		clientId: "client-demo",
		productId: "prod-acucar-1kg",
		quantity: 8,
		soldAt: "2026-01-22",
	},
];

export async function getClientProductHistory(
	clientId: string,
	productId: string,
): Promise<ProductHistorySummary | undefined> {
	try {
		const prisma = getPrismaClient();
		const dbItems = await prisma.saleHistory.findMany({
			where: { clientId, productId },
			orderBy: { soldAt: "asc" },
			select: {
				quantity: true,
				soldAt: true,
			},
		});

		if (dbItems.length) {
			const quantitySum = dbItems.reduce((acc, item) => acc + item.quantity, 0);
			const lastPurchase = dbItems[dbItems.length - 1];

			return {
				clientId,
				productId,
				purchaseCount: dbItems.length,
				averageQuantity: quantitySum / dbItems.length,
				lastQuantity: lastPurchase.quantity,
				lastPurchaseAt: lastPurchase.soldAt.toISOString(),
			};
		}
	} catch {
		// Fallback local quando banco nao estiver disponivel.
	}

	const items = inMemoryHistory
		.filter((entry) => entry.clientId === clientId && entry.productId === productId)
		.sort((a, b) => (a.soldAt < b.soldAt ? -1 : 1));

	if (!items.length) {
		return undefined;
	}

	const quantitySum = items.reduce((acc, item) => acc + item.quantity, 0);
	const lastPurchase = items[items.length - 1];

	return {
		clientId,
		productId,
		purchaseCount: items.length,
		averageQuantity: quantitySum / items.length,
		lastQuantity: lastPurchase.quantity,
		lastPurchaseAt: lastPurchase.soldAt,
	};
}
