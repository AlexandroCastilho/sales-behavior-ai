import { PDFParse } from "pdf-parse";
import { extractOrderItemsFromPdfWithAI } from "@/lib/gemini";
import { ParsedOrderItem } from "@/types/product";

function normalizeText(text: string): string {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function parseBrazilianNumber(value: string): number | null {
  const cleaned = value
    .replace(/\s+/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".")
    .trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizeDescription(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—:;,.]+|[\s\-–—:;,.]+$/g, "")
    .trim();
}

function isValidParsedOrderItem(item: ParsedOrderItem): boolean {
  return (
    Boolean(item.rawDescription?.trim()) &&
    Number.isFinite(item.quantity) &&
    item.quantity > 0
  );
}

function normalizeConfidence(value: number | undefined, fallback = 0.7): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 0), 1);
}

function sanitizeParsedItem(item: ParsedOrderItem): ParsedOrderItem {
  return {
    ...item,
    rawDescription: sanitizeDescription(item.rawDescription ?? ""),
    confidence: normalizeConfidence(item.confidence),
  };
}

function isLikelyNonItemLine(line: string): boolean {
  return /^(total|subtotal|desconto|valor\s+total|observa[cç][aã]o|pedido\s*n[oº])\b/i.test(
    line,
  );
}

function parseTextFallback(text: string): ParsedOrderItem[] {
  const normalized = normalizeText(text);

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const results: ParsedOrderItem[] = [];

  type LinePattern = {
    regex: RegExp;
    descriptionIndex: number;
    quantityIndex: number;
  };

  const patterns = [
    {
      regex: /^(.+?)\s+(?:qtd|qtde|quantidade)[:\s]+(\d+(?:[.,]\d+)?)$/i,
      descriptionIndex: 1,
      quantityIndex: 2,
    },
    {
      regex: /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(?:un|und|unid|pc|pcs|cx|kg)$/i,
      descriptionIndex: 1,
      quantityIndex: 2,
    },
    {
      regex: /^([A-Za-zÀ-ÿ0-9\s\-\/().]+?)\s{2,}(\d+(?:[.,]\d+)?)$/i,
      descriptionIndex: 1,
      quantityIndex: 2,
    },
    {
      regex: /^(\d+(?:[.,]\d+)?)\s*[xX]\s+(.+?)$/,
      descriptionIndex: 2,
      quantityIndex: 1,
    },
    {
      regex: /^(.+?)\s*[xX]\s*(\d+(?:[.,]\d+)?)$/,
      descriptionIndex: 1,
      quantityIndex: 2,
    },
  ] satisfies LinePattern[];

  for (const line of lines) {
    if (isLikelyNonItemLine(line)) continue;

    for (const pattern of patterns) {
      const match = line.match(pattern.regex);
      if (!match) continue;

      const quantity = parseBrazilianNumber(match[pattern.quantityIndex] ?? "");
      const description = sanitizeDescription(match[pattern.descriptionIndex] ?? "");

      if (!description || !quantity || quantity <= 0) continue;

      results.push({
        rawDescription: description,
        quantity,
        confidence: 0.55,
      });

      break;
    }
  }

  return results;
}

async function extractRawTextFromPdfBase64(pdfBase64: string): Promise<string> {
  const buffer = Buffer.from(pdfBase64, "base64");
  const parser = new PDFParse({ data: buffer });

  try {
    const parsed = await parser.getText();
    return normalizeText(parsed.text || "");
  } finally {
    await parser.destroy();
  }
}

export async function parseOrderPdf(params: {
  fileName: string;
  pdfBase64?: string;
}): Promise<ParsedOrderItem[]> {
  const { fileName, pdfBase64 } = params;

  if (!pdfBase64) {
    return [];
  }

  try {
    const aiItems = await extractOrderItemsFromPdfWithAI({ fileName, pdfBase64 });
    const validAiItems = aiItems.map(sanitizeParsedItem).filter(isValidParsedOrderItem);
    if (validAiItems.length) {
      return validAiItems;
    }
  } catch {
    // Falha de IA nao deve interromper o fallback textual.
  }

  try {
    const rawText = await extractRawTextFromPdfBase64(pdfBase64);
    return parseTextFallback(rawText);
  } catch {
    return [];
  }
}