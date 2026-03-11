import { GoogleGenerativeAI } from "@google/generative-ai";

import { AnalysisItemResult } from "@/types/analysis";
import { ParsedOrderItem, RiskLevel } from "@/types/product";

function getModel() {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		return undefined;
	}

	const client = new GoogleGenerativeAI(apiKey);
	return client.getGenerativeModel({ model: "gemini-1.5-flash" });
}

export async function extractOrderItemsFromPdfWithAI(params: {
	fileName: string;
	pdfBase64: string;
}): Promise<ParsedOrderItem[]> {
	const model = getModel();
	if (!model) {
		return [];
	}

	try {
		const prompt = `Extraia os itens de pedido deste arquivo e retorne SOMENTE JSON no formato: {"items":[{"rawDescription":"string","quantity":number,"unitPrice":number|null,"confidence":number}]}.`; 
		const result = await model.generateContent([
			prompt,
			{
				inlineData: {
					mimeType: "application/pdf",
					data: params.pdfBase64,
				},
			},
		]);

		const text = result.response.text().trim();
		const json = JSON.parse(text) as { items?: ParsedOrderItem[] };
		return (json.items ?? []).filter((item) => Number.isFinite(item.quantity));
	} catch {
		return [];
	}
}

export async function generateAnalysisSummaryWithAI(params: {
	clientId: string;
	overallRisk: RiskLevel;
	itemResults: AnalysisItemResult[];
}): Promise<string> {
	const model = getModel();
	if (!model) {
		return `Parecer automatico (fallback): risco ${params.overallRisk} para cliente ${params.clientId}.`; 
	}

	try {
		const result = await model.generateContent(
			[
				"Voce e um analista comercial. Gere um parecer curto em portugues (max 6 linhas), destacando riscos e motivos.",
				JSON.stringify(params),
			].join("\n\n"),
		);
		return result.response.text().trim();
	} catch {
		return `Parecer automatico (fallback): risco ${params.overallRisk} para cliente ${params.clientId}.`; 
	}
}
