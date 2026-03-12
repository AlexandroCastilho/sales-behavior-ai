import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { revokeSessionByToken } from "@/services/auth.service";

export async function POST() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionToken) {
    try {
      await revokeSessionByToken(sessionToken);
    } catch {
      // Ignora erro de banco para garantir limpeza de cookie no cliente.
    }
  }

  cookieStore.delete(SESSION_COOKIE_NAME);

  return NextResponse.json({ message: "Logout realizado." }, { status: 200 });
}
