import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { NotificationInbox, type InboxRow } from "@/components/notification-inbox";
import { ThemeToggle } from "@/components/theme-toggle";
import { db } from "@/lib/db";
import { categories, notifications, quotations } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/session";

export const metadata = { title: "Notificações · LPA Leo" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const rows = await db
    .select({
      id: notifications.id,
      read: notifications.read,
      emailedAt: notifications.emailedAt,
      createdAt: notifications.createdAt,
      externalId: quotations.externalId,
      orderId: quotations.nuBudgetOrder,
      schoolName: quotations.schoolName,
      countyName: quotations.countyName,
      headline: quotations.headline,
      proposalDeadline: quotations.proposalDeadline,
      categoryName: categories.name
    })
    .from(notifications)
    .innerJoin(quotations, eq(notifications.quotationId, quotations.id))
    .leftJoin(categories, eq(quotations.categoryId, categories.id))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  const inbox: InboxRow[] = rows.map((row) => ({
    id: row.id,
    read: row.read,
    emailedAt: row.emailedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    externalId: row.externalId,
    orderId: row.orderId,
    schoolName: row.schoolName,
    countyName: row.countyName,
    headline: row.headline,
    proposalDeadline: row.proposalDeadline?.toISOString() ?? null,
    categoryName: row.categoryName
  }));
  const unread = inbox.filter((row) => !row.read).length;

  return (
    <main className="min-h-screen">
      <header className="shell flex flex-wrap items-center justify-between gap-3 pt-6 pb-2">
        <div className="flex items-center gap-3">
          <Link className="action-secondary min-h-[38px]" href="/">← Voltar</Link>
          <div>
            <p className="eyebrow">Caixa de entrada</p>
            <h1 className="text-3xl font-extrabold tracking-tight text-[var(--color-fg)]">Notificações</h1>
          </div>
        </div>
        <ThemeToggle />
      </header>
      <section className="shell py-6">
        <NotificationInbox initial={inbox} unread={unread} />
      </section>
    </main>
  );
}
