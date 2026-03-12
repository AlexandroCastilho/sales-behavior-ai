import { GoogleGenerativeAI } from "@google/generative-ai";

import { AnalysisItemResult } from "@/types/analysis";
import { ParsedOrderItem, RiskLevel } from "@/types/product";

function getTimeoutMs(envName: "GEMINI_EXTRACT_TIMEOUT_MS" | "GEMINI_SUMMARY_TIMEOUT_MS", fallbackMs: number): number {
	const raw = process.env[envName];
	const parsed = raw ? Number(raw) : NaN;
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return fallbackMs;
	}
	return parsed;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
	let timeoutId: NodeJS.Timeout | undefined;
	const timeoutPromise = new Promise<never>((_, reject) => {
		timeoutId = setTimeout(() => reject(new Error(`Gemini timeout apos ${timeoutMs}ms.`)), timeoutMs);
	});

	try {
		return await Promise.race([promise, timeoutPromise]);
	} finally {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
	}
}

function extractJsonBlock(text: string): string | undefined {
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
	if (fenced?.[1]) {
		return fenced[1];
	}

	const objectMatch = text.match(/\{[\s\S]*\}/);
	return objectMatch?.[0];
}

function getModel() {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		return undefined;
	}

	const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
	const systemInstruction =
		process.env.GEMINI_SYSTEM_INSTRUCTION ||
		"Voce e um analista comercial B2B. Sempre siga o formato solicitado no prompt do usuario e use apenas os dados fornecidos na requisicao.";

	const client = new GoogleGenerativeAI(apiKey);
	return client.getGenerativeModel({ model: modelName, systemInstruction });
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
		const timeoutMs = getTimeoutMs("GEMINI_EXTRACT_TIMEOUT_MS", 10000);
		const prompt = `Extraia os itens de pedido deste arquivo e retorne SOMENTE JSON no formato: {"items":[{"rawDescription":"string","quantity":number,"unitPrice":number|null,"confidence":number}]}.`; 
		const result = await withTimeout(
			model.generateContent([
				prompt,
				{
					inlineData: {
						mimeType: "application/pdf",
						data: params.pdfBase64,
					},
				},
			]),
			timeoutMs,
		);

		const text = result.response.text().trim();
		const jsonText = extractJsonBlock(text) ?? text;
		const json = JSON.parse(jsonText) as { items?: ParsedOrderItem[] };
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
		const timeoutMs = getTimeoutMs("GEMINI_SUMMARY_TIMEOUT_MS", 8000);
		const result = await withTimeout(
			model.generateContent(
				[
					"Voce e um analista comercial. Gere um parecer curto em portugues (max 6 linhas), destacando riscos e motivos.",
					"Considere explicitamente os campos de historico por item (purchaseCount, averageQuantity, lastQuantity, lastPurchaseAt) ao justificar o risco.",
					JSON.stringify(params),
				].join("\n\n"),
			),
			timeoutMs,
		);
		return result.response.text().trim();
	} catch {
		return `Parecer automatico (fallback): risco ${params.overallRisk} para cliente ${params.clientId}.`; 
	}
}
