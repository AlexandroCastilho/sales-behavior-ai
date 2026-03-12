import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/auth";
import { createErrorResponse } from "@/lib/api-error";
import { registerBodySchema } from "@/lib/validation/auth";
import { registerWithPassword } from "@/services/auth.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password } = registerBodySchema.parse(body);

    const { sessionToken, user } = await registerWithPassword({ name, email, password });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return NextResponse.json({ message: "Cadastro realizado com sucesso.", user }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => issue.message).join(" ");
      return NextResponse.json(
        { message: "Dados invalidos.", detail: issues || "Revise os campos obrigatorios.", issues: error.flatten() },
        { status: 400 },
      );
    }

    return createErrorResponse({
      error,
      message: "Falha ao cadastrar.",
      statusRules: [{ includes: "Ja existe conta", status: 409 }],
    });
  }
}
