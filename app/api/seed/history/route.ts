import { NextResponse } from "next/server";
import { z } from "zod";

import { getPrismaClient } from "@/lib/prisma";

const productSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  aliases: z.array(z.string().min(1)).optional(),
});

const purchaseSchema = z.object({
  sku: z.string().min(1),
  quantity: z.number().positive(),
  soldAt: z.string().min(1),
});

const bodySchema = z.object({
  client: z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    region: z.string().min(1).optional(),
  }),
  products: z.array(productSchema).min(1),
  purchases: z.array(purchaseSchema).min(1),
  replaceHistory: z.boolean().optional().default(true),
});

function toValidDate(dateText: string): Date | undefined {
  const date = new Date(dateText);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function POST(request: Request) {
  try {
    const prisma = getPrismaClient();
    await prisma.$connect();

    const body = await request.json();
    const parsed = bodySchema.parse(body);

    const productsBySku = new Map(parsed.products.map((product) => [product.sku, product]));
    const missingProducts = parsed.purchases
      .map((purchase) => purchase.sku)
      .filter((sku) => !productsBySku.has(sku));

    if (missingProducts.length) {
      return NextResponse.json(
        {
          message: "Payload invalido para carga de historico.",
          detail: `Skus sem cadastro em products: ${Array.from(new Set(missingProducts)).join(", ")}`,
        },
        { status: 400 },
      );
    }

    const invalidDates = parsed.purchases.filter((purchase) => !toValidDate(purchase.soldAt));
    if (invalidDates.length) {
      return NextResponse.json(
        {
          message: "Payload invalido para carga de historico.",
          detail: "Uma ou mais datas em purchases.soldAt sao invalidas.",
        },
        { status: 400 },
      );
    }

    const client = await prisma.client.upsert({
      where: { code: parsed.client.code },
      update: {
        name: parsed.client.name,
        region: parsed.client.region,
      },
      create: {
        code: parsed.client.code,
        name: parsed.client.name,
        region: parsed.client.region,
      },
    });

    const productRows = await Promise.all(
      parsed.products.map((product) =>
        prisma.product.upsert({
          where: { sku: product.sku },
          update: {
            name: product.name,
            aliases: product.aliases ?? [],
          },
          create: {
            sku: product.sku,
            name: product.name,
            aliases: product.aliases ?? [],
          },
          select: { id: true, sku: true },
        }),
      ),
    );

    const productIdBySku = new Map(productRows.map((product) => [product.sku, product.id]));

    if (parsed.replaceHistory) {
      await prisma.saleHistory.deleteMany({
        where: {
          clientId: client.id,
          productId: {
            in: productRows.map((product) => product.id),
          },
        },
      });
    }

    await prisma.saleHistory.createMany({
      data: parsed.purchases.map((purchase) => ({
        clientId: client.id,
        productId: productIdBySku.get(purchase.sku) as string,
        quantity: purchase.quantity,
        soldAt: toValidDate(purchase.soldAt) as Date,
      })),
      skipDuplicates: false,
    });

    const perSkuSummary = parsed.purchases.reduce<Record<string, { count: number; avg: number }>>((acc, purchase) => {
      const current = acc[purchase.sku] ?? { count: 0, avg: 0 };
      const newCount = current.count + 1;
      const newAvg = (current.avg * current.count + purchase.quantity) / newCount;
      acc[purchase.sku] = { count: newCount, avg: Number(newAvg.toFixed(2)) };
      return acc;
    }, {});

    return NextResponse.json(
      {
        message: "Historico real carregado com sucesso.",
        client: {
          id: client.id,
          code: client.code,
          name: client.name,
          region: client.region,
        },
        productsLoaded: parsed.products.length,
        purchasesLoaded: parsed.purchases.length,
        replaceHistory: parsed.replaceHistory,
        perSkuSummary,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          message: "Payload invalido para carga de historico.",
          issues: error.flatten(),
        },
        { status: 400 },
      );
    }

    const message = error instanceof Error ? error.message : "Erro desconhecido";
    const isDatabaseUnavailable =
      message.includes("DATABASE_URL") ||
      message.includes("P1001") ||
      message.includes("Can't reach database server") ||
      message.includes("ECONNREFUSED");

    return NextResponse.json(
      {
        message: "Falha ao carregar historico no banco.",
        detail: isDatabaseUnavailable
          ? "Banco indisponivel. Verifique DATABASE_URL e conectividade do Postgres."
          : message,
      },
      { status: isDatabaseUnavailable ? 503 : 500 },
    );
  }
}
