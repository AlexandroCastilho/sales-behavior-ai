import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/auth";
import { loginWithPassword } from "@/services/auth.service";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = bodySchema.parse(body);

    const { sessionToken, user } = await loginWithPassword({ email, password });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return NextResponse.json({ message: "Login realizado com sucesso.", user }, { status: 200 });
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

    const status = detail.includes("invalidos") ? 401 : isDatabaseUnavailable ? 503 : 500;
    const safeDetail = isDatabaseUnavailable
      ? "Banco indisponivel. Verifique DATABASE_URL e se o servidor PostgreSQL esta ativo."
      : detail;

    return NextResponse.json({ message: "Falha ao fazer login.", detail: safeDetail }, { status });
  }
}
