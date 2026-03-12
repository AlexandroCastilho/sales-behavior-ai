import { ParsedOrderItem, Product } from "@/types/product";
import { getPrismaClient } from "@/lib/prisma";

const MIN_MATCH_SCORE = 0.72;

const fallbackProductsCatalog: Product[] = [
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
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
}

function intersectionCount(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const token of a) {
    if (b.has(token)) count += 1;
  }
  return count;
}

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function scoreCandidateVariant(description: string, candidate: string): number {
  const normalizedDescription = normalize(description);
  const normalizedCandidate = normalize(candidate);

  if (!normalizedDescription || !normalizedCandidate) {
    return 0;
  }

  if (normalizedDescription === normalizedCandidate) {
    return 1;
  }

  const descriptionTokens = Array.from(new Set(tokenize(normalizedDescription)));
  const candidateTokens = Array.from(new Set(tokenize(normalizedCandidate)));

  if (descriptionTokens.length === 0 || candidateTokens.length === 0) {
    return 0;
  }

  const descriptionTokenSet = new Set(descriptionTokens);
  const candidateTokenSet = new Set(candidateTokens);
  const commonTokens = intersectionCount(descriptionTokenSet, candidateTokenSet);

  const precision = commonTokens / candidateTokenSet.size;
  const recall = commonTokens / descriptionTokenSet.size;
  const tokenScore = precision * 0.7 + recall * 0.3;

  let score = tokenScore * 0.8;

  if (
    normalizedDescription.includes(normalizedCandidate) ||
    normalizedCandidate.includes(normalizedDescription)
  ) {
    score = Math.max(score, 0.82);
  }

  return Math.min(score, 0.98);
}

function scoreCandidate(description: string, product: Product): number {
  const candidates = [product.name, product.sku, ...(product.aliases ?? [])].filter(isNonEmptyString);

  let bestScore = 0;

  for (const candidate of candidates) {
    const candidateScore = scoreCandidateVariant(description, candidate);
    if (candidateScore > bestScore) {
      bestScore = candidateScore;
    }
  }

  return bestScore;
}

async function loadCatalog(): Promise<Product[]> {
  try {
    const prisma = getPrismaClient();
    const dbProducts = await prisma.product.findMany({
      select: {
        id: true,
        sku: true,
        name: true,
        aliases: true,
      },
    });

    if (dbProducts.length > 0) {
      return dbProducts;
    }
  } catch {
    // Fallback local apenas quando houver indisponibilidade do banco.
  }

  return fallbackProductsCatalog;
}

export async function matchOrderItemsToProducts(
  items: ParsedOrderItem[],
): Promise<ParsedOrderItem[]> {
  const catalog = await loadCatalog();

  return items.map((item) => {
    let bestMatch: Product | null = null;
    let bestScore = 0;

    for (const product of catalog) {
      const score = scoreCandidate(item.rawDescription, product);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = product;
      }
    }

    if (!bestMatch || bestScore < MIN_MATCH_SCORE) {
      return {
        ...item,
        confidence: Math.min(item.confidence ?? 0.4, 0.6),
      };
    }

    const confidence = Math.max(item.confidence ?? 0.7, Math.min(bestScore, 0.95));

    return {
      ...item,
      matchedProductId: bestMatch.id,
      matchedProductName: bestMatch.name,
      confidence,
    };
  });
}