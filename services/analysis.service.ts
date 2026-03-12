import { generateAnalysisSummaryWithAI } from "@/lib/gemini";
import { getPrismaClient } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { AnalysisItemResult, AnalysisResult, AnalyzeOrderInput, RuleFinding } from "@/types/analysis";
import { ParsedOrderItem, RiskLevel } from "@/types/product";

import { matchOrderItemsToProducts } from "./product-match.service";
import { parseOrderPdf } from "./pdf-parser.service";
import { getClientProductHistory } from "./sales-history.service";

async function resolveClientId(clientIdOrCode: string): Promise<string> {
	try {
		const prisma = getPrismaClient();

		const byId = await prisma.client.findUnique({
			where: { id: clientIdOrCode },
			select: { id: true },
		});

		if (byId) {
			return byId.id;
		}

		const byCode = await prisma.client.findFirst({
			where: {
				code: {
					equals: clientIdOrCode,
					mode: "insensitive",
				},
			},
			select: { id: true },
		});

		if (byCode) {
			return byCode.id;
		}
	} catch {
		// Se banco nao estiver disponivel, segue com valor original para fallback local.
	}

	return clientIdOrCode;
}

function determineItemRisk(findings: RuleFinding[]): RiskLevel {
	if (findings.some((finding) => finding.severity === "CRITICAL")) {
		return "HIGH";
	}

	if (findings.some((finding) => finding.severity === "WARN")) {
		return "MEDIUM";
	}

	if (findings.some((finding) => finding.severity === "INFO")) {
		return "INCONCLUSIVE";
	}

	return "LOW";
}

function determineOverallRisk(items: AnalysisItemResult[]): RiskLevel {
	const risks = items.map((item) => item.itemRisk);
	if (risks.includes("HIGH")) return "HIGH";
	if (risks.includes("MEDIUM")) return "MEDIUM";
	if (risks.includes("INCONCLUSIVE")) return "INCONCLUSIVE";
	return "LOW";
}

function buildRuleFindings(
	item: ParsedOrderItem,
	history?: Awaited<ReturnType<typeof getClientProductHistory>>,
): RuleFinding[] {
	const findings: RuleFinding[] = [];

	if (!item.matchedProductId) {
		findings.push({
			code: "NEW_PRODUCT_FOR_CLIENT",
			message: "Produto nao identificado no cadastro do cliente.",
			severity: "WARN",
		});
		return findings;
	}

	if (!history) {
		findings.push({
			code: "NEW_PRODUCT_FOR_CLIENT",
			message: "Produto nunca comprado por este cliente.",
			severity: "WARN",
		});
		findings.push({
			code: "INSUFFICIENT_HISTORY",
			message: "Sem historico suficiente para conclusao confiavel.",
			severity: "INFO",
		});
		return findings;
	}

	if (history.purchaseCount < 2) {
		findings.push({
			code: "INSUFFICIENT_HISTORY",
			message: "Historico insuficiente: menos de 2 compras anteriores.",
			severity: "INFO",
		});
	}

	if (item.quantity > history.averageQuantity * 2.5) {
		findings.push({
			code: "QUANTITY_SPIKE",
			message: `Quantidade ${item.quantity} acima de 2.5x da media historica (${history.averageQuantity.toFixed(
				2,
			)}).`,
			severity: "CRITICAL",
		});
	}

	return findings;
}

async function saveAnalysisResult(params: {
	input: AnalyzeOrderInput;
	overallRisk: RiskLevel;
	aiSummary: string;
	itemResults: AnalysisItemResult[];
}) {
	const { input, overallRisk, aiSummary, itemResults } = params;
	const prisma = getPrismaClient();

	await prisma.analysisRun.create({
		data: {
			clientId: input.clientId,
			userId: input.userId,
			fileName: input.fileName,
			overallRisk,
			aiSummary,
			items: {
				create: itemResults.map((result) => ({
					productId: result.item.matchedProductId,
					rawDescription: result.item.rawDescription,
					quantity: result.item.quantity,
					confidence: result.item.confidence,
					itemRisk: result.itemRisk,
					findingsJson: JSON.parse(
						JSON.stringify({ findings: result.findings }),
					) as Prisma.InputJsonValue,
				})),
			},
		},
	});
}

export async function analyzeOrder(input: AnalyzeOrderInput): Promise<AnalysisResult> {
	const resolvedClientId = await resolveClientId(input.clientId);
	const parsedFromPdf = input.parsedItems ?? (await parseOrderPdf({ fileName: input.fileName, pdfBase64: input.pdfBase64 }));
	const matchedItems = await matchOrderItemsToProducts(parsedFromPdf);

	const itemResults = await Promise.all(
		matchedItems.map(async (item) => {
			const history = item.matchedProductId
				? await getClientProductHistory(resolvedClientId, item.matchedProductId)
				: undefined;

			const findings = buildRuleFindings(item, history);

			return {
				item,
				history,
				findings,
				itemRisk: determineItemRisk(findings),
			} satisfies AnalysisItemResult;
		}),
	);

	const overallRisk = determineOverallRisk(itemResults);

	const aiSummary = await generateAnalysisSummaryWithAI({
		clientId: resolvedClientId,
		overallRisk,
		itemResults,
	});

	if (input.persistResult !== false) {
		try {
			await saveAnalysisResult({
				input: {
					...input,
					clientId: resolvedClientId,
				},
				overallRisk,
				aiSummary,
				itemResults,
			});
		} catch {
			// Nao quebra a analise caso banco/migracao ainda nao esteja pronto.
		}
	}

	return {
		clientId: input.clientId,
		runAt: new Date().toISOString(),
		overallRisk,
		items: itemResults,
		aiSummary,
	};
}
