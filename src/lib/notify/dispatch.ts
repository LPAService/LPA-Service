import { eq, gte, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
  notifications,
  notificationSubscriptions,
  quotations,
  users
} from "@/lib/db/schema";
import { buildNotificationEmailHtml, sendNotificationEmail, type SendEmail } from "./email";
import { matchesSubscription } from "./match";
import { formatDate } from "@/lib/format/opportunity";

export type DispatchResult = {
  notificationsCreated: number;
  emailsSent: number;
  emailsSkipped: number;
  errors: string[];
};

export type DispatchDependencies = {
  database?: NodePgDatabase<typeof schema>;
  since?: Date;
  sendEmail?: SendEmail;
  baseUrl?: string;
};

/**
 * Encontra cotações coletadas a partir de `since`, cruza com as
 * assinaturas ativas, cria notificações não lidas e envia um email
 * de resumo por usuário (via Resend, se configurado).
 */
export async function dispatchQuotationNotifications(
  deps: DispatchDependencies = {}
): Promise<DispatchResult> {
  const database = deps.database ?? db;
  const since = deps.since ?? new Date(Date.now() - 10 * 60_000);
  const sendEmail = deps.sendEmail ?? sendNotificationEmail;
  const baseUrl =
    deps.baseUrl ??
    process.env.NOTIFY_BASE_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";
  const result: DispatchResult = { notificationsCreated: 0, emailsSent: 0, emailsSkipped: 0, errors: [] };

  const newQuotations = await database
    .select({
      id: quotations.id,
      externalId: quotations.externalId,
      orderId: quotations.nuBudgetOrder,
      schoolName: quotations.schoolName,
      countyName: quotations.countyName,
      headline: quotations.headline,
      summary: quotations.summary,
      topItems: quotations.topItems,
      categoryId: quotations.categoryId,
      proposalDeadline: quotations.proposalDeadline
    })
    .from(quotations)
    .where(gte(quotations.collectedAt, since));

  if (newQuotations.length === 0) return result;

  const subscriptions = await database
    .select({
      id: notificationSubscriptions.id,
      userId: notificationSubscriptions.userId,
      categoryId: notificationSubscriptions.categoryId,
      city: notificationSubscriptions.city,
      school: notificationSubscriptions.school,
      keyword: notificationSubscriptions.keyword,
      active: notificationSubscriptions.active
    })
    .from(notificationSubscriptions)
    .where(eq(notificationSubscriptions.active, true));

  if (subscriptions.length === 0) return result;

  // notificações criadas nesta rodada, agrupadas por usuário
  const createdByUser = new Map<number, Array<{ quotationId: number; notificationId: number }>>();
  for (const subscription of subscriptions) {
    const matches = newQuotations.filter((quotation) =>
      matchesSubscription(subscription, {
        categoryId: quotation.categoryId,
        city: quotation.countyName,
        school: quotation.schoolName,
        headline: quotation.headline,
        summary: quotation.summary,
        topItems: Array.isArray(quotation.topItems)
          ? (quotation.topItems as string[])
          : []
      })
    );

    for (const quotation of matches) {
      const inserted = await database
        .insert(notifications)
        .values({ userId: subscription.userId, quotationId: quotation.id })
        .onConflictDoNothing()
        .returning({ id: notifications.id });
      if (inserted.length > 0) {
        result.notificationsCreated += 1;
        const bucket = createdByUser.get(subscription.userId) ?? [];
        bucket.push({ quotationId: quotation.id, notificationId: inserted[0]!.id });
        createdByUser.set(subscription.userId, bucket);
      }
    }
  }

  if (createdByUser.size === 0) return result;

  const userIds = [...createdByUser.keys()];
  const userRows = await database
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(users.id, userIds));

  const quotationById = new Map(newQuotations.map((quotation) => [quotation.id, quotation]));
  const emailedNotificationIds: number[] = [];

  for (const user of userRows) {
    const bucket = createdByUser.get(user.id);
    if (!bucket || bucket.length === 0) continue;

    const rows = bucket.map(({ quotationId }) => {
      const quotation = quotationById.get(quotationId);
      return {
        school: quotation?.schoolName ?? "Escola não informada",
        city: quotation?.countyName ?? null,
        headline: quotation?.headline ?? "Cotação sem título",
        deadline: formatDate(quotation?.proposalDeadline?.toISOString() ?? null),
        url: `${baseUrl}/opportunity/${quotation?.externalId ?? ""}`
      };
    });

    const subject = `🔔 ${rows.length} nova${rows.length > 1 ? "s" : ""} cotação${rows.length > 1 ? "ões" : ""} para você — LPA Leo`;
    const sendResult = await sendEmail({
      to: user.email,
      subject,
      html: buildNotificationEmailHtml({ rows, alertsUrl: `${baseUrl}/alertas` })
    });

    if (sendResult.sent) {
      result.emailsSent += 1;
      emailedNotificationIds.push(...bucket.map((item) => item.notificationId));
    } else {
      result.emailsSkipped += 1;
      if (sendResult.error) result.errors.push(`Email para ${user.email}: ${sendResult.error}`);
    }
  }

  if (emailedNotificationIds.length > 0) {
    await database
      .update(notifications)
      .set({ emailedAt: new Date() })
      .where(inArray(notifications.id, emailedNotificationIds));
  }

  return result;
}
