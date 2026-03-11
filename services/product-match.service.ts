import { ParsedOrderItem, Product } from "@/types/product";
import { getPrismaClient } from "@/lib/prisma";

const productsCatalog: Product[] = [
	{
		id: "prod-cafe-500g",
		sku: "CAFE-500",
		name: "Cafe Torrado 500g",
		aliases: ["cafe 500", "cafe 500g"],
	},
	{
		id: "prod-acucar-1kg",
		sku: "ACUCAR-1K",
		name: "Acucar Cristal 1kg",
		aliases: ["acucar 1kg", "acucar cristal"],
	},
];

function normalize(text: string): string {
	return text
		.normalize("NFD")
		.replace(/[^\w\s-]/g, "")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.trim();
}

export async function matchOrderItemsToProducts(
	items: ParsedOrderItem[],
): Promise<ParsedOrderItem[]> {
	let catalog: Product[] = productsCatalog;

	try {
		const prisma = getPrismaClient();
		const dbProducts = await prisma.product.findMany({
			select: { id: true, sku: true, name: true, aliases: true },
		});
		if (dbProducts.length) {
			catalog = dbProducts;
		}
	} catch {
		// Fallback local quando banco nao estiver disponivel.
	}

	return items.map((item) => {
		const normalizedDescription = normalize(item.rawDescription);

		const matched = catalog.find((product) => {
			const names = [product.name, ...(product.aliases ?? [])].map(normalize);
			return names.some((name) => normalizedDescription.includes(name));
		});

		if (!matched) {
			return {
				...item,
				confidence: item.confidence || 0.4,
			};
		}

		return {
			...item,
			matchedProductId: matched.id,
			matchedProductName: matched.name,
			confidence: Math.max(item.confidence, 0.9),
		};
	});
}
