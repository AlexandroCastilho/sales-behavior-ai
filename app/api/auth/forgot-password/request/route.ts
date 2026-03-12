import { NextResponse } from "next/server";
import { z } from "zod";

import { createErrorResponse } from "@/lib/api-error";
import { extractClientIp, isLocalhostRequest } from "@/lib/request-ip";
import { requestPasswordReset } from "@/services/auth.service";

const bodySchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = bodySchema.parse(body);

    const ipAddress = extractClientIp(request.headers);
    const allowDevCode = process.env.NODE_ENV === "development" && isLocalhostRequest(request.headers);

    const result = await requestPasswordReset({ email, ipAddress, allowDevCode });

    return NextResponse.json({
      message: "Se o email existir, enviamos um codigo de recuperacao.",
      ...result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Dados invalidos.", issues: error.flatten() }, { status: 400 });
    }

    return createErrorResponse({
      error,
      message: "Falha ao solicitar recuperacao.",
      statusRules: [{ includes: "Limite de tentativas excedido", status: 429 }],
    });
  }
}
