import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, notifications, quotations } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: notifications.id,
      read: notifications.read,
      emailedAt: notifications.emailedAt,
      createdAt: notifications.createdAt,
      quotationId: quotations.id,
      externalId: quotations.externalId,
      orderId: quotations.nuBudgetOrder,
      schoolName: quotations.schoolName,
      countyName: quotations.countyName,
      headline: quotations.headline,
      proposalDeadline: quotations.proposalDeadline,
      categorySlug: categories.slug,
      categoryName: categories.name
    })
    .from(notifications)
    .innerJoin(quotations, eq(notifications.quotationId, quotations.id))
    .leftJoin(categories, eq(quotations.categoryId, categories.id))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  const unread = rows.filter((row) => !row.read).length;

  return Response.json({ notifications: rows, unread });
}
