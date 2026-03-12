import { NextResponse } from "next/server";
import { z } from "zod";

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

    await resetPasswordWithCode({ email, code, newPassword });

    return NextResponse.json({ message: "Senha redefinida com sucesso." }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Dados invalidos.", issues: error.flatten() }, { status: 400 });
    }

    const detail = error instanceof Error ? error.message : "Erro desconhecido";
    const errorCode =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";

    const isDatabaseUnavailable =
      detail.includes("DATABASE_URL") ||
      detail.includes("P1001") ||
      detail.includes("Can't reach database server") ||
      detail.includes("ECONNREFUSED") ||
      errorCode.includes("ECONNREFUSED") ||
      errorCode.includes("P1001");

    const status = detail.includes("Codigo invalido") ? 401 : isDatabaseUnavailable ? 503 : 500;
    const safeDetail = isDatabaseUnavailable
      ? "Banco indisponivel. Verifique DATABASE_URL e se o servidor PostgreSQL esta ativo."
      : detail;

    return NextResponse.json({ message: "Falha ao redefinir senha.", detail: safeDetail }, { status });
  }
}
