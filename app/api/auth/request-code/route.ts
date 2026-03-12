import { NextResponse } from "next/server";
import { z } from "zod";

import { requestEmailLoginCode } from "@/services/auth.service";

const bodySchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = bodySchema.parse(body);

    const result = await requestEmailLoginCode(email);

    return NextResponse.json({
      message: "Codigo enviado para o email informado.",
      ...result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          message: "Payload invalido.",
          issues: error.flatten(),
        },
        { status: 400 },
      );
    }

    const detail = error instanceof Error ? error.message : "Erro desconhecido";
    const status = detail.includes("DATABASE_URL") ? 503 : 500;

    return NextResponse.json(
      {
        message: "Falha ao solicitar codigo de login.",
        detail,
      },
      { status },
    );
  }
}
