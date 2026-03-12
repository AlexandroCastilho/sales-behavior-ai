import { NextResponse } from "next/server";
import { z } from "zod";

import { createErrorResponse } from "@/lib/api-error";
import { extractClientIp } from "@/lib/request-ip";
import { resetPasswordWithCode } from "@/services/auth.service";

const bodySchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
  newPassword: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, code, newPassword } = bodySchema.parse(body);
    const ipAddress = extractClientIp(request.headers);

    await resetPasswordWithCode({ email, code, newPassword, ipAddress });

    return NextResponse.json({ message: "Senha redefinida com sucesso." }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Dados invalidos.", issues: error.flatten() }, { status: 400 });
    }

    return createErrorResponse({
      error,
      message: "Falha ao redefinir senha.",
      statusRules: [
        { includes: "Codigo invalido", status: 401 },
        { includes: "Limite de tentativas excedido", status: 429 },
      ],
    });
  }
}
