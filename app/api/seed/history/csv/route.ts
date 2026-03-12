import { NextResponse } from "next/server";
import { read, utils } from "xlsx";

import { createErrorResponse } from "@/lib/api-error";
import { getPrismaClient } from "@/lib/prisma";

export const runtime = "nodejs";

type HistoryImportRow = {
  clientCode: string;
  clientName: string;
  region?: string;
  sku: string;
  productName: string;
  aliases: string[];
  quantity: number;
  soldAt: string;
};

type RawCsvData = {
  headers: string[];
  rows: string[][];
};

type WorksheetCell = string | number | boolean | Date | null | undefined;

type MonthColumn = {
  index: number;
  soldAt: string;
};

const REQUIRED_HEADERS = [
  "clientCode",
  "clientName",
  "sku",
  "productName",
  "quantity",
  "soldAt",
] as const;

function parseCsvLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function detectDelimiter(headerLine: string): string {
  const commaCount = (headerLine.match(/,/g) ?? []).length;
  const semicolonCount = (headerLine.match(/;/g) ?? []).length;
  return semicolonCount > commaCount ? ";" : ",";
}

function normalizeLines(csvText: string): string[] {
  return csvText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeHeader(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7F]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .trim();
}

function stringifyCell(value: WorksheetCell): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function normalizeKey(text: string): string {
  return normalizeHeader(text);
}

function parseNumber(value: string): number {
  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function parseSpreadsheetNumber(value: WorksheetCell): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : NaN;
  }

  if (typeof value === "string") {
    return parseNumber(value);
  }

  return NaN;
}

function toIsoDate(value: string): string | undefined {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
}

function getLastDayOfMonthIso(year: number, monthIndex: number): string {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0));
  return lastDay.toISOString();
}

export function parseMonthLabelToIsoDate(label: string): string | undefined {
  const normalized = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  if (!normalized) {
    return undefined;
  }

  const monthByKey: Record<string, number> = {
    JAN: 0,
    JANEIRO: 0,
    FEB: 1,
    FEV: 1,
    FEVEREIRO: 1,
    MAR: 2,
    MARCO: 2,
    APR: 3,
    ABR: 3,
    ABRIL: 3,
    MAY: 4,
    MAI: 4,
    MAIO: 4,
    JUN: 5,
    JUNHO: 5,
    JUL: 6,
    JULHO: 6,
    AUG: 7,
    AGO: 7,
    AGOSTO: 7,
    SEP: 8,
    SET: 8,
    SETEMBRO: 8,
    OCT: 9,
    OUT: 9,
    OUTUBRO: 9,
    NOV: 10,
    NOVEMBRO: 10,
    DEC: 11,
    DEZ: 11,
    DEZEMBRO: 11,
  };

  const yearMatch = normalized.match(/\b(19|20)\d{2}\b/);
  if (!yearMatch) {
    return undefined;
  }

  const year = Number(yearMatch[0]);
  const monthToken = normalized
    .split(" ")
    .find((part) => Object.prototype.hasOwnProperty.call(monthByKey, part));

  if (!monthToken) {
    return undefined;
  }

  return getLastDayOfMonthIso(year, monthByKey[monthToken]);
}

function addMonths(date: Date, months: number): Date {
  const cloned = new Date(date);
  cloned.setMonth(cloned.getMonth() + months);
  return cloned;
}

function parseRawCsv(csvText: string): RawCsvData {
  const lines = normalizeLines(csvText);
  if (lines.length < 2) {
    throw new Error("CSV invalido. Informe cabecalho e ao menos uma linha de dados.");
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter);
  const rows = lines.slice(1).map((line) => parseCsvLine(line, delimiter));

  return { headers, rows };
}

function parseStandardCsv(raw: RawCsvData): HistoryImportRow[] {
  const header = raw.headers;

  const missingHeaders = REQUIRED_HEADERS.filter((key) => !header.includes(key));
  if (missingHeaders.length) {
    throw new Error(`Colunas obrigatorias ausentes no CSV: ${missingHeaders.join(", ")}`);
  }

  const rows: HistoryImportRow[] = [];

  for (let i = 0; i < raw.rows.length; i += 1) {
    const values = raw.rows[i];
    const rowMap: Record<string, string> = {};

    header.forEach((key, idx) => {
      rowMap[key] = (values[idx] ?? "").trim();
    });

    const quantity = parseNumber(rowMap.quantity ?? "");
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`Linha ${i + 2}: quantity invalida.`);
    }

    const soldAtIso = toIsoDate(rowMap.soldAt ?? "");
    if (!soldAtIso) {
      throw new Error(`Linha ${i + 2}: soldAt invalido.`);
    }

    rows.push({
      clientCode: rowMap.clientCode,
      clientName: rowMap.clientName,
      region: rowMap.region || undefined,
      sku: rowMap.sku,
      productName: rowMap.productName,
      aliases: (rowMap.aliases || "")
        .split("|")
        .map((alias) => alias.trim())
        .filter(Boolean),
      quantity,
      soldAt: soldAtIso,
    });
  }

  if (!rows.length) {
    throw new Error("CSV sem linhas de dados validas.");
  }

  return rows;
}

function getRequiredIndex(normalizedHeaders: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const idx = normalizedHeaders.indexOf(alias);
    if (idx >= 0) {
      return idx;
    }
  }
  throw new Error(`Coluna obrigatoria ausente no CSV: ${aliases[0]}`);
}

function parsePartnerModelCsv(raw: RawCsvData): HistoryImportRow[] {
  const normalizedHeaders = raw.headers.map(normalizeHeader);

  const clientCodeIdx = getRequiredIndex(normalizedHeaders, ["CODIGOPARCEIRO"]);
  const clientNameIdx = getRequiredIndex(normalizedHeaders, ["NOMEFANTASIAPARCEIRO", "NOMEPARCEIRO"]);
  const regionIdx = normalizedHeaders.indexOf("CIDADEPARCEIRO");
  const skuIdx = getRequiredIndex(normalizedHeaders, ["CODPRODUTO"]);
  const productNameIdx = getRequiredIndex(normalizedHeaders, ["DESCPRODUTO"]);
  const productTypeIdx = normalizedHeaders.indexOf("TIPOPRODUTO");
  const productGroupIdx = normalizedHeaders.indexOf("GRUPOPRODUTO");
  const lastPurchaseIdx = normalizedHeaders.indexOf("DATEDTULTCOMPRA");

  const pesoIndexes = normalizedHeaders
    .map((header, idx) => ({ header, idx }))
    .filter((item) => item.header === "PESOTOTALFAT")
    .map((item) => item.idx);

  if (!pesoIndexes.length) {
    throw new Error("Colunas de historico 'PESO TOTAL FAT' nao encontradas no CSV.");
  }

  const rows: HistoryImportRow[] = [];

  for (let i = 0; i < raw.rows.length; i += 1) {
    const values = raw.rows[i];
    const clientCode = (values[clientCodeIdx] ?? "").trim();
    const clientName = (values[clientNameIdx] ?? "").trim();
    const region = regionIdx >= 0 ? (values[regionIdx] ?? "").trim() : "";
    const sku = (values[skuIdx] ?? "").trim();
    const productName = (values[productNameIdx] ?? "").trim();

    if (!clientCode || !clientName || !sku || !productName) {
      throw new Error(`Linha ${i + 2}: campos obrigatorios vazios (cliente/produto).`);
    }

    const aliases = [productName];
    if (productTypeIdx >= 0 && (values[productTypeIdx] ?? "").trim()) {
      aliases.push((values[productTypeIdx] ?? "").trim());
    }
    if (productGroupIdx >= 0 && (values[productGroupIdx] ?? "").trim()) {
      aliases.push((values[productGroupIdx] ?? "").trim());
    }

    const anchorDate =
      (lastPurchaseIdx >= 0 && toIsoDate(values[lastPurchaseIdx] ?? "")) || new Date().toISOString();
    const anchor = new Date(anchorDate);

    for (let p = 0; p < pesoIndexes.length; p += 1) {
      const rawWeight = (values[pesoIndexes[p]] ?? "").trim();
      if (!rawWeight) {
        continue;
      }

      const quantity = parseNumber(rawWeight);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        continue;
      }

      const monthOffset = p - (pesoIndexes.length - 1);
      const soldAt = addMonths(anchor, monthOffset).toISOString();

      rows.push({
        clientCode,
        clientName,
        region: region || undefined,
        sku,
        productName,
        aliases: Array.from(new Set(aliases.map((item) => item.trim()).filter(Boolean))),
        quantity,
        soldAt,
      });
    }
  }

  if (!rows.length) {
    throw new Error("Nenhum historico de compra valido foi encontrado no CSV informado.");
  }

  return rows;
}

export function parseHistoryCsvFile(csvText: string): HistoryImportRow[] {
  const raw = parseRawCsv(csvText);
  const normalizedHeaders = raw.headers.map(normalizeHeader);
  const isPartnerTemplate = normalizedHeaders.includes("CODIGOPARCEIRO") && normalizedHeaders.includes("CODPRODUTO");

  if (isPartnerTemplate) {
    return parsePartnerModelCsv(raw);
  }

  return parseStandardCsv(raw);
}

function findHeaderIndex(normalizedHeaders: string[], aliases: string[], required = true): number {
  for (const alias of aliases) {
    const idx = normalizedHeaders.indexOf(alias);
    if (idx >= 0) {
      return idx;
    }
  }

  if (required) {
    throw new Error(`Coluna obrigatoria ausente no XLSX: ${aliases[0]}`);
  }

  return -1;
}

function getMonthColumns(monthRow: string[], headerRow: string[]): MonthColumn[] {
  const monthColumns: MonthColumn[] = [];

  for (let i = 0; i < headerRow.length; i += 1) {
    const technicalHeader = normalizeKey(headerRow[i]);
    if (!technicalHeader.includes("QUANTIDADE")) {
      continue;
    }

    const soldAt = parseMonthLabelToIsoDate(monthRow[i]);
    if (!soldAt) {
      continue;
    }

    monthColumns.push({ index: i, soldAt });
  }

  return monthColumns;
}

export function mapErpWorksheetToHistoryRows(worksheetRows: WorksheetCell[][]): HistoryImportRow[] {
  if (worksheetRows.length < 3) {
    throw new Error("Planilha XLSX invalida. Esperado: linha de meses, linha de cabecalho e dados.");
  }

  const monthRow = (worksheetRows[0] ?? []).map(stringifyCell);
  const headerRow = (worksheetRows[1] ?? []).map(stringifyCell);
  const dataRows = worksheetRows.slice(2);
  const normalizedHeaders = headerRow.map(normalizeKey);

  const clientCodeIdx = findHeaderIndex(normalizedHeaders, ["CODIGOPARCEIRO", "CODPARCEIRO"]);
  const clientNameIdx = findHeaderIndex(normalizedHeaders, ["NOMEPARCEIRO", "NOMEFANTASIAPARCEIRO"]);
  const regionIdx = findHeaderIndex(normalizedHeaders, ["CIDADEPARCEIRO", "REGIAO"], false);
  const skuIdx = findHeaderIndex(normalizedHeaders, ["CODPRODUTO", "CODIGOPRODUTO"]);
  const productNameIdx = findHeaderIndex(normalizedHeaders, ["DESCPRODUTO", "DESCRICAOPRODUTO"]);
  const lastPurchaseIdx = findHeaderIndex(normalizedHeaders, ["DATEDTULTCOMPRA", "DTULTCOMPRA", "DATAULTCOMPRA"], false);

  const monthColumns = getMonthColumns(monthRow, headerRow);
  const fallbackQuantityIndexes = normalizedHeaders
    .map((header, index) => ({ header, index }))
    .filter((item) => item.header.includes("QUANTIDADE"))
    .map((item) => item.index)
    .filter((index) => !monthColumns.some((column) => column.index === index));

  const rows: HistoryImportRow[] = [];

  for (const worksheetRow of dataRows) {
    const clientCode = stringifyCell(worksheetRow[clientCodeIdx]);
    const clientName = stringifyCell(worksheetRow[clientNameIdx]);
    const region = regionIdx >= 0 ? stringifyCell(worksheetRow[regionIdx]) : "";
    const sku = stringifyCell(worksheetRow[skuIdx]);
    const productName = stringifyCell(worksheetRow[productNameIdx]);

    if (!clientCode || !clientName || !sku || !productName) {
      continue;
    }

    for (const monthColumn of monthColumns) {
      const quantity = parseSpreadsheetNumber(worksheetRow[monthColumn.index]);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        continue;
      }

      rows.push({
        clientCode,
        clientName,
        region: region || undefined,
        sku,
        productName,
        aliases: [],
        quantity,
        soldAt: monthColumn.soldAt,
      });
    }

    if (monthColumns.length === 0 && fallbackQuantityIndexes.length > 0) {
      const fallbackSoldAt =
        (lastPurchaseIdx >= 0 && toIsoDate(stringifyCell(worksheetRow[lastPurchaseIdx]))) || undefined;

      if (!fallbackSoldAt) {
        continue;
      }

      for (const quantityIndex of fallbackQuantityIndexes) {
        const quantity = parseSpreadsheetNumber(worksheetRow[quantityIndex]);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          continue;
        }

        rows.push({
          clientCode,
          clientName,
          region: region || undefined,
          sku,
          productName,
          aliases: [],
          quantity,
          soldAt: fallbackSoldAt,
        });
      }
    }
  }

  if (!rows.length) {
    throw new Error("Nenhum historico valido foi encontrado no XLSX informado.");
  }

  return rows;
}

export function parseHistoryXlsxFile(fileBuffer: ArrayBuffer): HistoryImportRow[] {
  const workbook = read(fileBuffer, { type: "array", cellDates: false });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("Arquivo XLSX sem planilhas disponiveis.");
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const worksheetRows = utils.sheet_to_json<WorksheetCell[]>(worksheet, {
    header: 1,
    raw: true,
    defval: "",
    blankrows: false,
  });

  return mapErpWorksheetToHistoryRows(worksheetRows);
}

function isXlsxFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();

  return (
    name.endsWith(".xlsx") ||
    type.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  );
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("csvFile") ?? form.get("historyFile");
    const replaceHistoryRaw = form.get("replaceHistory");
    const replaceHistory = typeof replaceHistoryRaw === "string" ? replaceHistoryRaw === "true" : true;

    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: "Falha ao carregar historico.", detail: "Arquivo CSV ou XLSX nao informado." },
        { status: 400 },
      );
    }

    const rows = isXlsxFile(file)
      ? parseHistoryXlsxFile(await file.arrayBuffer())
      : parseHistoryCsvFile(await file.text());

    const prisma = getPrismaClient();
    await prisma.$connect();

    const clientsMap = new Map<string, { name: string; region?: string }>();
    for (const row of rows) {
      clientsMap.set(row.clientCode, { name: row.clientName, region: row.region });
    }

    const clients = await Promise.all(
      Array.from(clientsMap.entries()).map(([code, client]) =>
        prisma.client.upsert({
          where: { code },
          update: {
            name: client.name,
            region: client.region,
          },
          create: {
            code,
            name: client.name,
            region: client.region,
          },
          select: { id: true, code: true, name: true, region: true },
        }),
      ),
    );

    const clientIdByCode = new Map(clients.map((client) => [client.code, client.id]));

    const productsMap = new Map<string, { name: string; aliases: string[] }>();
    for (const row of rows) {
      if (!productsMap.has(row.sku)) {
        productsMap.set(row.sku, { name: row.productName, aliases: row.aliases });
        continue;
      }

      const existing = productsMap.get(row.sku) as { name: string; aliases: string[] };
      productsMap.set(row.sku, {
        name: existing.name,
        aliases: Array.from(new Set([...(existing.aliases ?? []), ...(row.aliases ?? [])])),
      });
    }

    const productRows = await Promise.all(
      Array.from(productsMap.entries()).map(([sku, product]) =>
        prisma.product.upsert({
          where: { sku },
          update: {
            name: product.name,
            aliases: product.aliases,
          },
          create: {
            sku,
            name: product.name,
            aliases: product.aliases,
          },
          select: { id: true, sku: true },
        }),
      ),
    );

    const productIdBySku = new Map(productRows.map((product) => [product.sku, product.id]));

    if (replaceHistory) {
      const skusByClient = new Map<string, Set<string>>();
      for (const row of rows) {
        if (!skusByClient.has(row.clientCode)) {
          skusByClient.set(row.clientCode, new Set());
        }
        (skusByClient.get(row.clientCode) as Set<string>).add(row.sku);
      }

      for (const [clientCode, skus] of skusByClient.entries()) {
        const clientId = clientIdByCode.get(clientCode);
        if (!clientId) {
          continue;
        }

        const productIds = Array.from(skus)
          .map((sku) => productIdBySku.get(sku))
          .filter((id): id is string => Boolean(id));

        if (!productIds.length) {
          continue;
        }

        await prisma.saleHistory.deleteMany({
          where: {
            clientId,
            productId: {
              in: productIds,
            },
          },
        });
      }
    }

    await prisma.saleHistory.createMany({
      data: rows.map((row) => ({
        clientId: clientIdByCode.get(row.clientCode) as string,
        productId: productIdBySku.get(row.sku) as string,
        quantity: row.quantity,
        soldAt: new Date(row.soldAt),
      })),
      skipDuplicates: false,
    });

    return NextResponse.json(
      {
        message: "Historico carregado com sucesso.",
        clientsLoaded: clients.length,
        clientCodes: clients.map((client) => client.code),
        productsLoaded: productRows.length,
        purchasesLoaded: rows.length,
        replaceHistory,
      },
      { status: 200 },
    );
  } catch (error) {
    return createErrorResponse({
      error,
      message: "Falha ao carregar historico via arquivo.",
      defaultStatus: 400,
    });
  }
}
