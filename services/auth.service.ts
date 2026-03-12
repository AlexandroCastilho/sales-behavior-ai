import { getPrismaClient, isDatabaseConfigured } from "@/lib/prisma";
import {
  generateLoginCode,
  generateSessionToken,
  hashPassword,
  hashValue,
  normalizeEmail,
  SESSION_MAX_AGE_SECONDS,
  verifyPassword,
} from "@/lib/auth";
import { sendLoginCodeEmail, sendPasswordResetCodeEmail } from "@/services/email.service";

const LOGIN_CODE_EXPIRATION_MINUTES = 10;
const PASSWORD_RESET_EXPIRATION_MINUTES = 10;

const RATE_LIMIT_MESSAGE = "Limite de tentativas excedido. Tente novamente em alguns minutos.";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();

type UserLite = {
  id: string;
  email: string;
  name: string | null;
};

type UserWithPassword = UserLite & {
  passwordHash: string | null;
};

function consumeRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const existing = rateLimitBuckets.get(key);

  if (!existing || existing.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (existing.count >= limit) {
    return false;
  }

  existing.count += 1;
  rateLimitBuckets.set(key, existing);
  return true;
}

function assertRateLimit(key: string, limit: number, windowMs: number): void {
  const allowed = consumeRateLimit(key, limit, windowMs);
  if (!allowed) {
    throw new Error(RATE_LIMIT_MESSAGE);
  }
}

function clearRateLimitBucket(key: string): void {
  rateLimitBuckets.delete(key);
}

function assertDatabase() {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL nao definido no ambiente.");
  }
}

async function createSessionForUser(userId: string): Promise<string> {
  const prisma = getPrismaClient();
  const token = generateSessionToken();

  await prisma.authSession.create({
    data: {
      userId,
      tokenHash: hashValue(token),
      expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
    },
  });

  return token;
}

export async function registerWithPassword(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<{ sessionToken: string; user: { id: string; email: string; name: string | null } }> {
  assertDatabase();

  const email = normalizeEmail(input.email);
  const prisma = getPrismaClient();

  const existing = (await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })) as { id: string } | null;
  if (existing) {
    throw new Error("Ja existe conta com este email.");
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: input.name?.trim() || null,
      passwordHash: hashPassword(input.password),
    },
    select: { id: true, email: true, name: true },
  });

  const sessionToken = await createSessionForUser(user.id);
  return { sessionToken, user };
}

export async function loginWithPassword(input: {
  email: string;
  password: string;
}): Promise<{ sessionToken: string; user: { id: string; email: string; name: string | null } }> {
  assertDatabase();

  const email = normalizeEmail(input.email);
  const prisma = getPrismaClient();

  const user = (await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, passwordHash: true },
  })) as UserWithPassword | null;

  if (!user?.passwordHash || !verifyPassword(input.password, user.passwordHash)) {
    throw new Error("Email ou senha invalidos.");
  }

  const sessionToken = await createSessionForUser(user.id);
  return {
    sessionToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  };
}

export async function requestPasswordReset(params: {
  email: string;
  ipAddress?: string;
  allowDevCode?: boolean;
}): Promise<{ devCode?: string }> {
  assertDatabase();

  const email = normalizeEmail(params.email);
  const ipAddress = params.ipAddress ?? "unknown";

  assertRateLimit(`pwd-reset:request:ip:${ipAddress}`, 30, 15 * 60_000);
  assertRateLimit(`pwd-reset:request:email:${email}`, 5, 15 * 60_000);

  const prisma = getPrismaClient();
  const user = (await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  })) as { id: string; email: string } | null;

  // Evita enumeracao de usuarios: sempre retorna sucesso sem diferenciar.
  if (!user) {
    return {};
  }

  const code = generateLoginCode();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRATION_MINUTES * 60_000);

  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashValue(code),
        expiresAt,
      },
    }),
  ]);

  clearRateLimitBucket(`pwd-reset:invalid-code:${email}`);

  const sendResult = await sendPasswordResetCodeEmail({ email: user.email, code });

  return params.allowDevCode && sendResult.usedDevFallback ? { devCode: code } : {};
}

export async function resetPasswordWithCode(input: {
  email: string;
  code: string;
  newPassword: string;
  ipAddress?: string;
}): Promise<void> {
  assertDatabase();

  const email = normalizeEmail(input.email);
  const ipAddress = input.ipAddress ?? "unknown";

  assertRateLimit(`pwd-reset:reset:ip:${ipAddress}`, 40, 15 * 60_000);
  assertRateLimit(`pwd-reset:reset:email:${email}`, 10, 15 * 60_000);

  const prisma = getPrismaClient();
  const user = (await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })) as { id: string } | null;

  if (!user) {
    throw new Error("Codigo invalido ou expirado.");
  }

  const tokenRow = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      tokenHash: hashValue(input.code),
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (!tokenRow) {
    assertRateLimit(`pwd-reset:invalid-code:${email}`, 5, 30 * 60_000);
    throw new Error("Codigo invalido ou expirado.");
  }

  clearRateLimitBucket(`pwd-reset:invalid-code:${email}`);

  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { id: tokenRow.id },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(input.newPassword) },
    }),
    prisma.authSession.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    }),
  ]);
}

export async function requestEmailLoginCode(rawEmail: string): Promise<{ devCode?: string }> {
  assertDatabase();

  const email = normalizeEmail(rawEmail);
  const prisma = getPrismaClient();
  const code = generateLoginCode();

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
    select: { id: true, email: true },
  });

  const expiresAt = new Date(Date.now() + LOGIN_CODE_EXPIRATION_MINUTES * 60_000);

  await prisma.emailLoginCode.create({
    data: {
      userId: user.id,
      codeHash: hashValue(code),
      expiresAt,
    },
  });

  const sendResult = await sendLoginCodeEmail({ email: user.email, code });

  return process.env.NODE_ENV !== "production" && sendResult.usedDevFallback ? { devCode: code } : {};
}

export async function verifyEmailLoginCode(rawEmail: string, code: string): Promise<{
  sessionToken: string;
  user: { id: string; email: string; name: string | null };
}> {
  assertDatabase();

  const email = normalizeEmail(rawEmail);
  const prisma = getPrismaClient();

  const user = (await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  })) as UserLite | null;

  if (!user) {
    throw new Error("Usuario nao encontrado para este email.");
  }

  const now = new Date();
  const codeRow = await prisma.emailLoginCode.findFirst({
    where: {
      userId: user.id,
      usedAt: null,
      expiresAt: { gt: now },
      codeHash: hashValue(code),
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (!codeRow) {
    throw new Error("Codigo invalido ou expirado.");
  }

  await prisma.emailLoginCode.update({
    where: { id: codeRow.id },
    data: { usedAt: now },
  });

  const token = await createSessionForUser(user.id);

  return {
    sessionToken: token,
    user,
  };
}

export async function getUserFromSessionToken(token: string): Promise<{
  id: string;
  email: string;
  name: string | null;
} | null> {
  assertDatabase();

  const prisma = getPrismaClient();

  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashValue(token) },
    select: {
      expiresAt: true,
      revokedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    return null;
  }

  return session.user;
}

export async function revokeSessionByToken(token: string): Promise<void> {
  assertDatabase();

  const prisma = getPrismaClient();

  await prisma.authSession.updateMany({
    where: {
      tokenHash: hashValue(token),
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}
