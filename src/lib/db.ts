import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Vercel/Neon integrations can expose the pooled connection under different
// variable names depending on how the storage integration was attached.
// Normalize those aliases before Prisma initializes, without ever logging the
// connection string itself.
if (!process.env.DATABASE_URL) {
  const fallbackDatabaseUrl =
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    process.env.NEON_DATABASE_URL;

  if (fallbackDatabaseUrl) {
    process.env.DATABASE_URL = fallbackDatabaseUrl;
  }
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
