import { generateAnalysisSummaryWithAI } from "@/lib/gemini";
import { getPrismaClient } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { AnalysisItemResult, AnalysisResult, AnalyzeOrderInput, RuleFinding } from "@/types/analysis";
import { ParsedOrderItem, RiskLevel } from "@/types/product";

import { matchOrderItemsToProducts } from "./product-match.service";
import { parseOrderPdf } from "./pdf-parser.service";
import { getClientProductHistory } from "./sales-history.service";

const MIN_PURCHASES_FOR_STRONG_HISTORY = 2;
const QUANTITY_SPIKE_MULTIPLIER = 2.5;

const RISK_PRIORITY: Record<RiskLevel, number> = {
	LOW: 0,
	INCONCLUSIVE: 1,
	MEDIUM: 2,
	HIGH: 3,
};

type ItemHistory = Awaited<ReturnType<typeof getClientProductHistory>>;

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
	let highestRisk: RiskLevel = "LOW";

	for (const item of items) {
		if (RISK_PRIORITY[item.itemRisk] > RISK_PRIORITY[highestRisk]) {
			highestRisk = item.itemRisk;
		}
	}

	return highestRisk;
}

function createFinding(
	code: RuleFinding["code"],
	message: string,
	severity: RuleFinding["severity"],
): RuleFinding {
	return { code, message, severity };
}

function buildRuleFindings(item: ParsedOrderItem, history?: ItemHistory): RuleFinding[] {
	const findings: RuleFinding[] = [];

	if (!item.matchedProductId) {
		findings.push(
			createFinding(
				"NEW_PRODUCT_FOR_CLIENT",
				"Produto nao identificado no cadastro do cliente.",
				"WARN",
			),
		);
		return findings;
	}

	if (!history) {
		findings.push(
			createFinding(
				"NEW_PRODUCT_FOR_CLIENT",
				"Produto nunca comprado por este cliente.",
				"WARN",
			),
		);
		findings.push(
			createFinding(
				"INSUFFICIENT_HISTORY",
				"Sem historico suficiente para conclusao confiavel.",
				"INFO",
			),
		);
		return findings;
	}

	if (history.purchaseCount < MIN_PURCHASES_FOR_STRONG_HISTORY) {
		findings.push(
			createFinding(
				"INSUFFICIENT_HISTORY",
				"Historico insuficiente: menos de 2 compras anteriores.",
				"INFO",
			),
		);
	}

	if (item.quantity > history.averageQuantity * QUANTITY_SPIKE_MULTIPLIER) {
		findings.push(
			createFinding(
				"QUANTITY_SPIKE",
				`Quantidade ${item.quantity} acima de ${QUANTITY_SPIKE_MULTIPLIER}x da media historica (${history.averageQuantity.toFixed(
					2,
				)}).`,
				"CRITICAL",
			),
		);
	}

	return findings;
}

async function resolveInputItems(input: AnalyzeOrderInput): Promise<ParsedOrderItem[]> {
	if (input.pdfBase64) {
		return parseOrderPdf({ fileName: input.fileName, pdfBase64: input.pdfBase64 });
	}

	return input.parsedItems ?? [];
}

async function buildItemResult(params: {
	item: ParsedOrderItem;
	clientId: string;
}): Promise<AnalysisItemResult> {
	const { item, clientId } = params;

	const history = item.matchedProductId
		? await getClientProductHistory(clientId, item.matchedProductId)
		: undefined;

	const findings = buildRuleFindings(item, history);

	return {
		item,
		history,
		findings,
		itemRisk: determineItemRisk(findings),
	};
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
	const parsedItems = await resolveInputItems(input);
	const matchedItems = await matchOrderItemsToProducts(parsedItems);

	const itemResults = await Promise.all(
		matchedItems.map((item) => buildItemResult({ item, clientId: resolvedClientId })),
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
