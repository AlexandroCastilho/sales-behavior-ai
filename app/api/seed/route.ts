import { NextResponse } from "next/server";

import { createErrorResponse } from "@/lib/api-error";
import { getPrismaClient } from "@/lib/prisma";

export async function POST() {
  try {
    const prisma = getPrismaClient();
    await prisma.$connect();

    const client = await prisma.client.upsert({
      where: { code: "client-demo" },
      update: { name: "Cliente Demo", region: "Sudeste" },
      create: {
        code: "client-demo",
        name: "Cliente Demo",
        region: "Sudeste",
      },
    });

    const cafe = await prisma.product.upsert({
      where: { sku: "CAFE-500" },
      update: { name: "Cafe Torrado 500g", aliases: ["cafe 500", "cafe 500g"] },
      create: {
        sku: "CAFE-500",
        name: "Cafe Torrado 500g",
        aliases: ["cafe 500", "cafe 500g"],
      },
    });

    const acucar = await prisma.product.upsert({
      where: { sku: "ACUCAR-1K" },
      update: { name: "Acucar Cristal 1kg", aliases: ["acucar 1kg", "acucar cristal"] },
      create: {
        sku: "ACUCAR-1K",
        name: "Acucar Cristal 1kg",
        aliases: ["acucar 1kg", "acucar cristal"],
      },
    });

    await prisma.saleHistory.deleteMany({
      where: {
        clientId: client.id,
        productId: {
          in: [cafe.id, acucar.id],
        },
      },
    });

    await prisma.saleHistory.createMany({
      data: [
        {
          clientId: client.id,
          productId: cafe.id,
          quantity: 12,
          soldAt: new Date("2026-01-10"),
        },
        {
          clientId: client.id,
          productId: cafe.id,
          quantity: 10,
          soldAt: new Date("2026-02-05"),
        },
        {
          clientId: client.id,
          productId: acucar.id,
          quantity: 8,
          soldAt: new Date("2026-01-22"),
        },
      ],
      skipDuplicates: false,
    });

    return NextResponse.json({
      message: "Seed concluido com sucesso.",
      clientId: client.id,
      products: [cafe.id, acucar.id],
    });
  } catch (error) {
    return createErrorResponse({
      error,
      message: "Falha ao executar seed.",
    });
  }
}
