import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/auth";
import { createErrorResponse } from "@/lib/api-error";
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

    return createErrorResponse({
      error,
      message: "Falha ao fazer login.",
      statusRules: [{ includes: "invalidos", status: 401 }],
    });
  }
}
