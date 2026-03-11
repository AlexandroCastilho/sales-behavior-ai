import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
	var prismaGlobal: PrismaClient | undefined;
}

export function getPrismaClient(): PrismaClient {
	if (globalThis.prismaGlobal) {
		return globalThis.prismaGlobal;
	}

	const client = new PrismaClient({
		adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
		log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
	});

	if (process.env.NODE_ENV !== "production") {
		globalThis.prismaGlobal = client;
	}

	return client;
}
