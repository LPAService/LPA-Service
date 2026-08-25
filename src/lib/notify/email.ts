export type NotificationEmail = {
  to: string;
  subject: string;
  html: string;
};

export type SendEmailResult = {
  sent: boolean;
  skipped?: boolean;
  error?: string;
};

export type SendEmail = (email: NotificationEmail) => Promise<SendEmailResult>;

/**
 * Envia via API do Resend (HTTP puro, sem dependência nova).
 * Sem RESEND_API_KEY ou com NOTIFY_EMAIL_ENABLED=off, apenas registra
 * no log e devolve skipped — útil em dev e em deploys ainda sem chave.
 */
export async function sendNotificationEmail(
  email: NotificationEmail
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  const enabled = process.env.NOTIFY_EMAIL_ENABLED !== "off";

  if (!enabled || !apiKey || !from) {
    console.info(
      `[notify] email pulado (enabled=${enabled}, key=${Boolean(apiKey)}, from=${Boolean(from)}): ${email.subject}`
    );
    return { sent: false, skipped: true };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [email.to],
        subject: email.subject,
        html: email.html
      })
    });

    if (!response.ok) {
      const body = await response.text();
      return { sent: false, error: `Resend HTTP ${response.status}: ${body.slice(0, 300)}` };
    }

    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export function buildNotificationEmailHtml(input: {
  alertsUrl: string;
  rows: Array<{
    school: string;
    city: string | null;
    headline: string;
    deadline: string | null;
    url: string;
  }>;
}): string {
  const items = input.rows
    .map(
      (row) => `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #e5e9f2">
          <p style="margin:0;font-size:15px;font-weight:700;color:#0b1526">${escapeHtml(row.school)}</p>
          <p style="margin:2px 0 6px;font-size:13px;color:#5f6f86">${escapeHtml(row.city ?? "")}${row.deadline ? ` · prazo ${escapeHtml(row.deadline)}` : ""}</p>
          <p style="margin:0 0 10px;font-size:14px;color:#3c4a5f">${escapeHtml(row.headline)}</p>
          <a href="${escapeHtml(row.url)}" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:8px 16px;border-radius:999px">Ver cotação →</a>
        </td>
      </tr>`
    )
    .join("");

  return `
  <div style="font-family:ui-sans-serif,system-ui,sans-serif;background:#f3f6fb;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e9f2;border-radius:16px;padding:28px">
      <h2 style="margin:0 0 4px;font-size:18px;color:#0b1526">🔔 Novas cotações para você</h2>
      <p style="margin:0 0 18px;font-size:13px;color:#5f6f86">Surgiram novas licitações no Caixa Escolar MG que batem com os seus alertas.</p>
      <table style="width:100%;border-collapse:collapse">${items}</table>
      <p style="margin:18px 0 0;font-size:12px;color:#8fa0b8">LPA Leo · você pode gerenciar seus alertas em <a href="${escapeHtml(input.alertsUrl)}" style="color:#0d9488">/alertas</a></p>
    </div>
  </div>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
