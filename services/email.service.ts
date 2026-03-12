type SendLoginCodeEmailInput = {
  email: string;
  code: string;
};

export async function sendLoginCodeEmail(input: SendLoginCodeEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[auth] Codigo de login para ${input.email}: ${input.code}`);
      return;
    }

    throw new Error("Servico de email nao configurado. Defina RESEND_API_KEY e EMAIL_FROM.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.email],
      subject: "Seu codigo de acesso - Sales Behavior AI",
      html: `<p>Seu codigo de acesso e: <strong>${input.code}</strong></p><p>Ele expira em 10 minutos.</p>`,
      text: `Seu codigo de acesso e: ${input.code}. Ele expira em 10 minutos.`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Falha no envio de email: ${detail}`);
  }
}
