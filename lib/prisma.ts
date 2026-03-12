import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
	var prismaGlobal: PrismaClient | undefined;
}

export function isDatabaseConfigured(): boolean {
	return Boolean(process.env.DATABASE_URL);
}

export function getPrismaClient(): PrismaClient {
	if (!isDatabaseConfigured()) {
		throw new Error("DATABASE_URL nao definido no ambiente.");
	}

	if (globalThis.prismaGlobal) {
		return globalThis.prismaGlobal;
	}

	const prismaLogs: Prisma.LogLevel[] = process.env.PRISMA_LOG_ERRORS === "true"
		? process.env.NODE_ENV === "development"
			? ["error", "warn"]
			: ["error"]
		: [];

	const client = new PrismaClient({
		adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
		log: prismaLogs,
	});

	if (process.env.NODE_ENV !== "production") {
		globalThis.prismaGlobal = client;
	}

	return client;
}
