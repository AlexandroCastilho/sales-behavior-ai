import { NextResponse } from "next/server";

const DATABASE_UNAVAILABLE_DETAIL =
  "Banco indisponivel. Verifique DATABASE_URL e se o servidor PostgreSQL esta ativo.";

const DATABASE_ERROR_HINTS = ["DATABASE_URL", "P1001", "Can't reach database server", "ECONNREFUSED"];

type StatusRule = {
  includes: string;
  status: number;
};

export function isDatabaseUnavailableError(error: unknown): boolean {
  const detail = error instanceof Error ? error.message : "";
  const errorCode =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";

  return DATABASE_ERROR_HINTS.some((hint) => detail.includes(hint) || errorCode.includes(hint));
}

export function createErrorResponse(params: {
  error: unknown;
  message: string;
  defaultStatus?: number;
  databaseUnavailableStatus?: number;
  statusRules?: StatusRule[];
}) {
  const {
    error,
    message,
    defaultStatus = 500,
    databaseUnavailableStatus = 503,
    statusRules = [],
  } = params;

  const detail = error instanceof Error ? error.message : "Erro desconhecido";
  const isDatabaseUnavailable = isDatabaseUnavailableError(error);

  let status = defaultStatus;
  for (const rule of statusRules) {
    if (detail.includes(rule.includes)) {
      status = rule.status;
      break;
    }
  }

  if (isDatabaseUnavailable) {
    status = databaseUnavailableStatus;
  }

  return NextResponse.json(
    {
      message,
      detail: isDatabaseUnavailable ? DATABASE_UNAVAILABLE_DETAIL : detail,
    },
    { status },
  );
}
