import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { analyzeOrder } from "@/services/analysis.service";
import { getUserFromSessionToken } from "@/services/auth.service";

export const runtime = "nodejs";

const bodySchema = z.object({
  clientId: z.string().min(1),
  fileName: z.string().min(1),
  userId: z.string().min(1).optional(),
  pdfBase64: z.string().optional(),
  persistResult: z.boolean().optional(),
  parsedItems: z
    .array(
      z.object({
        rawDescription: z.string().min(1),
        quantity: z.number().positive(),
        unitPrice: z.number().nonnegative().optional(),
        confidence: z.number().min(0).max(1).default(0.7),
      }),
    )
    .optional(),
});

function parseBooleanFromFormValue(value: FormDataEntryValue | null): boolean | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return undefined;
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionToken) {
      return NextResponse.json({ message: "Nao autenticado." }, { status: 401 });
    }

    const user = await getUserFromSessionToken(sessionToken);
    if (!user) {
      return NextResponse.json({ message: "Sessao invalida ou expirada." }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") ?? "";

    const body = contentType.includes("multipart/form-data")
      ? await (async () => {
          const form = await request.formData();

          const clientId = form.get("clientId");
          const fileName = form.get("fileName");
          const parsedItemsRaw = form.get("parsedItems");
          const persistResult = parseBooleanFromFormValue(form.get("persistResult"));
          const pdfFile = form.get("pdfFile");

          let parsedItems: unknown;
          if (typeof parsedItemsRaw === "string" && parsedItemsRaw.trim()) {
            parsedItems = JSON.parse(parsedItemsRaw);
          }

          let pdfBase64: string | undefined;
          if (pdfFile instanceof File && pdfFile.size > 0) {
            const arrayBuffer = await pdfFile.arrayBuffer();
            pdfBase64 = Buffer.from(arrayBuffer).toString("base64");
          }

          return {
            clientId: typeof clientId === "string" ? clientId : "",
            fileName: typeof fileName === "string" ? fileName : "pedido.pdf",
            persistResult,
            parsedItems,
            pdfBase64,
          };
        })()
      : await request.json();

    const parsed = bodySchema.parse(body);

    const result = await analyzeOrder({
      ...parsed,
      userId: user.id,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          message: "Payload invalido para analise.",
          issues: error.flatten(),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        message: "Falha ao processar analise.",
        detail: error instanceof Error ? error.message : "Erro interno inesperado.",
      },
      { status: 500 },
    );
  }
}
