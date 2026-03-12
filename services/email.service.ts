import nodemailer from "nodemailer";

type AuthCodePurpose = "login" | "password-reset";

type SendAuthCodeEmailInput = {
  email: string;
  code: string;
};

type SendAuthCodeEmailResult = {
  usedDevFallback: boolean;
};

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

const SMTP_SEND_TIMEOUT_MS = 10_000;

let cachedTransporter: nodemailer.Transporter | null = null;
let cachedTransporterKey: string | null = null;

function parseSmtpSecure(value: string): boolean {
  return value.trim().toLowerCase() === "true";
}

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim() ?? "";
  const portRaw = process.env.SMTP_PORT?.trim() ?? "";
  const secureRaw = process.env.SMTP_SECURE?.trim() ?? "";
  const user = process.env.SMTP_USER?.trim() ?? "";
  const pass = process.env.SMTP_PASS?.trim() ?? "";
  const from = process.env.EMAIL_FROM?.trim() ?? "";

  const missing: string[] = [];
  if (!host) missing.push("SMTP_HOST");
  if (!portRaw) missing.push("SMTP_PORT");
  if (!secureRaw) missing.push("SMTP_SECURE");
  if (!user) missing.push("SMTP_USER");
  if (!pass) missing.push("SMTP_PASS");
  if (!from) missing.push("EMAIL_FROM");

  if (missing.length > 0) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[email] SMTP nao configurado. Variaveis ausentes: ${missing.join(", ")}.`);
      return null;
    }

    throw new Error(`Servico de email SMTP nao configurado. Defina: ${missing.join(", ")}.`);
  }

  const port = Number(portRaw);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("Variavel SMTP_PORT invalida. Use um numero inteiro positivo.");
  }

  return {
    host,
    port,
    secure: parseSmtpSecure(secureRaw),
    user,
    pass,
    from,
  };
}

function getTransporter(config: SmtpConfig): nodemailer.Transporter {
  const transportKey = `${config.host}:${config.port}:${config.secure}:${config.user}`;

  if (!cachedTransporter || cachedTransporterKey !== transportKey) {
    cachedTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      connectionTimeout: SMTP_SEND_TIMEOUT_MS,
      greetingTimeout: SMTP_SEND_TIMEOUT_MS,
      socketTimeout: SMTP_SEND_TIMEOUT_MS,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
    cachedTransporterKey = transportKey;
  }

  return cachedTransporter;
}

function getEmailTemplate(purpose: AuthCodePurpose, code: string): { subject: string; html: string; text: string } {
  if (purpose === "password-reset") {
    return {
      subject: "Seu codigo de recuperacao - PedScan",
      html: `<p>Seu codigo de recuperacao e: <strong>${code}</strong></p><p>Ele expira em 10 minutos.</p>`,
      text: `Seu codigo de recuperacao e: ${code}. Ele expira em 10 minutos.`,
    };
  }

  return {
    subject: "Seu codigo de acesso - PedScan",
    html: `<p>Seu codigo de acesso e: <strong>${code}</strong></p><p>Ele expira em 10 minutos.</p>`,
    text: `Seu codigo de acesso e: ${code}. Ele expira em 10 minutos.`,
  };
}

async function sendAuthCodeEmail(input: SendAuthCodeEmailInput & { purpose: AuthCodePurpose }): Promise<SendAuthCodeEmailResult> {
  const config = getSmtpConfig();

  if (!config) {
    console.info(`[auth] Codigo (${input.purpose}) para ${input.email}: ${input.code}`);
    return { usedDevFallback: true };
  }

  const { subject, html, text } = getEmailTemplate(input.purpose, input.code);

  try {
    const transporter = getTransporter(config);
    await Promise.race([
      transporter.sendMail({
        from: config.from,
        to: input.email,
        subject,
        html,
        text,
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("Tempo limite excedido ao enviar email SMTP."));
        }, SMTP_SEND_TIMEOUT_MS);
      }),
    ]);

    console.info(`[email] Email SMTP enviado para ${input.email}.`);
    return { usedDevFallback: false };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "erro desconhecido";
    console.error(`[email] Falha no envio SMTP para ${input.email}: ${detail}`);

    if (process.env.NODE_ENV !== "production") {
      console.warn(`[email] Usando fallback de desenvolvimento para ${input.email}.`);
      return { usedDevFallback: true };
    }

    throw new Error("Falha no envio de email via SMTP.");
  }
}

export async function sendLoginCodeEmail(input: SendAuthCodeEmailInput): Promise<SendAuthCodeEmailResult> {
  return sendAuthCodeEmail({ ...input, purpose: "login" });
}

export async function sendPasswordResetCodeEmail(input: SendAuthCodeEmailInput): Promise<SendAuthCodeEmailResult> {
  return sendAuthCodeEmail({ ...input, purpose: "password-reset" });
}
