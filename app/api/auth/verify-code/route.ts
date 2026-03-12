import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/auth";
import { verifyEmailLoginCode } from "@/services/auth.service";

const bodySchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, code } = bodySchema.parse(body);

    const { sessionToken, user } = await verifyEmailLoginCode(email, code);

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return NextResponse.json({
      message: "Login realizado com sucesso.",
      user,
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
    const status = detail.includes("Codigo invalido") ? 401 : detail.includes("DATABASE_URL") ? 503 : 500;

    return NextResponse.json(
      {
        message: "Falha ao validar codigo.",
        detail,
      },
      { status },
    );
  }
}
