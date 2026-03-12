import { NextResponse } from "next/server";
import { z } from "zod";

import { createErrorResponse } from "@/lib/api-error";
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

    return createErrorResponse({
      error,
      message: "Falha ao solicitar codigo de login.",
    });
  }
}
