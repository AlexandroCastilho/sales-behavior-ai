import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { analyzeOrder } from "@/services/analysis.service";

const bodySchema = z.object({
  clientId: z.string().min(1),
  fileName: z.string().min(1),
  userId: z.string().min(1).optional(),
  pdfBase64: z.string().optional(),
  persistResult: z.boolean().optional(),
  parsedItems: z
    .array(
      z.object({
        rawDescription: z.string().min(1),
        quantity: z.number().positive(),
        unitPrice: z.number().nonnegative().optional(),
        confidence: z.number().min(0).max(1).default(0.7),
      }),
    )
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = bodySchema.parse(body);

    const result = await analyzeOrder(parsed);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          message: "Payload invalido para analise.",
          issues: error.flatten(),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        message: "Falha ao processar analise.",
      },
      { status: 500 },
    );
  }
}
