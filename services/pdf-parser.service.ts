import { extractOrderItemsFromPdfWithAI } from "@/lib/gemini";
import { ParsedOrderItem } from "@/types/product";

function parseTextFallback(text: string): ParsedOrderItem[] {
	const lines = text
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);

	return lines
		.map((line) => {
			const match = line.match(/(.+)\s+qtd[:\s]+(\d+(?:[.,]\d+)?)/i);
			if (!match) {
				return undefined;
			}

			return {
				rawDescription: match[1].trim(),
				quantity: Number(match[2].replace(",", ".")),
				confidence: 0.6,
			} as ParsedOrderItem;
		})
		.filter((item): item is ParsedOrderItem => Boolean(item));
}

export async function parseOrderPdf(params: {
	fileName: string;
	pdfBase64?: string;
}): Promise<ParsedOrderItem[]> {
	const { fileName, pdfBase64 } = params;
	if (!pdfBase64) {
		return [];
	}

	const aiItems = await extractOrderItemsFromPdfWithAI({ fileName, pdfBase64 });
	if (aiItems.length) {
		return aiItems;
	}

	const rawText = Buffer.from(pdfBase64, "base64").toString("utf-8");
	return parseTextFallback(rawText);
}
