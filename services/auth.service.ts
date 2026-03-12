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
import { sendLoginCodeEmail } from "@/services/email.service";

const LOGIN_CODE_EXPIRATION_MINUTES = 10;

type UserLite = {
  id: string;
  email: string;
  name: string | null;
};

type UserWithPassword = UserLite & {
  passwordHash: string | null;
};

type SessionWithUser = {
  expiresAt: Date;
  revokedAt: Date | null;
  user: UserLite;
};

type PrismaAuthClient = {
  authSession: {
    create(args: unknown): Promise<unknown>;
    findUnique(args: unknown): Promise<SessionWithUser | null>;
    updateMany(args: unknown): Promise<unknown>;
  };
  user: {
    findUnique(args: unknown): Promise<unknown>;
    create(args: unknown): Promise<UserLite>;
    update(args: unknown): Promise<unknown>;
    upsert(args: unknown): Promise<{ id: string; email: string }>;
  };
  passwordResetToken: {
    create(args: unknown): Promise<unknown>;
    findFirst(args: unknown): Promise<{ id: string } | null>;
    update(args: unknown): Promise<unknown>;
  };
  emailLoginCode: {
    create(args: unknown): Promise<unknown>;
    findFirst(args: unknown): Promise<{ id: string } | null>;
    update(args: unknown): Promise<unknown>;
  };
  $transaction(args: Array<Promise<unknown>>): Promise<unknown>;
};

function getAuthPrismaClient(): PrismaAuthClient {
  return getPrismaClient() as unknown as PrismaAuthClient;
}

function assertDatabase() {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL nao definido no ambiente.");
  }
}

async function createSessionForUser(userId: string): Promise<string> {
  const prisma = getAuthPrismaClient();
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
  const prisma = getAuthPrismaClient();

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
  const prisma = getAuthPrismaClient();

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

export async function requestPasswordReset(rawEmail: string): Promise<{ devCode?: string }> {
  assertDatabase();

  const email = normalizeEmail(rawEmail);
  const prisma = getAuthPrismaClient();
  const user = (await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  })) as { id: string; email: string } | null;

  // Evita enumeracao de usuarios: sempre retorna sucesso sem diferenciar.
  if (!user) {
    return {};
  }

  const code = generateLoginCode();
  const expiresAt = new Date(Date.now() + 10 * 60_000);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashValue(code),
      expiresAt,
    },
  });

  await sendLoginCodeEmail({ email: user.email, code });

  return process.env.NODE_ENV === "production" ? {} : { devCode: code };
}

export async function resetPasswordWithCode(input: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<void> {
  assertDatabase();

  const email = normalizeEmail(input.email);
  const prisma = getAuthPrismaClient();
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
    throw new Error("Codigo invalido ou expirado.");
  }

  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { id: tokenRow.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(input.newPassword) },
    }),
  ]);
}

export async function requestEmailLoginCode(rawEmail: string): Promise<{ devCode?: string }> {
  assertDatabase();

  const email = normalizeEmail(rawEmail);
  const prisma = getAuthPrismaClient();
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

  await sendLoginCodeEmail({ email: user.email, code });

  return process.env.NODE_ENV === "production" ? {} : { devCode: code };
}

export async function verifyEmailLoginCode(rawEmail: string, code: string): Promise<{
  sessionToken: string;
  user: { id: string; email: string; name: string | null };
}> {
  assertDatabase();

  const email = normalizeEmail(rawEmail);
  const prisma = getAuthPrismaClient();

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

  const prisma = getAuthPrismaClient();

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

  const prisma = getAuthPrismaClient();

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
