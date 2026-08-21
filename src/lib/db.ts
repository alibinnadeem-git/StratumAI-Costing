import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function buildUrlFromPgParts() {
  const host = process.env.PGHOST;
  const user = process.env.PGUSER;
  const password = process.env.PGPASSWORD;
  const database = process.env.PGDATABASE;
  if (!host || !user || !password || !database) return undefined;

  const port = process.env.PGPORT || "5432";
  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);
  const encodedDatabase = encodeURIComponent(database);
  return `postgresql://${encodedUser}:${encodedPassword}@${host}:${port}/${encodedDatabase}?sslmode=require`;
}

// Vercel/Neon integrations expose connection details under several possible
// names. Normalize every supported format before Prisma initializes. Secrets
// are never logged or sent to the client.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    process.env.NEON_DATABASE_URL ??
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.POSTGRES_URL_NON_POOLING ??
    buildUrlFromPgParts();
}

if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL =
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL;
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
