import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { AlertsPanel, type CategoryOption, type SubscriptionRow } from "@/components/alerts-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { db } from "@/lib/db";
import { categories, notificationSubscriptions } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/session";

export const metadata = { title: "Meus alertas · LPA Leo" };
export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const categoryRows = await db
    .select({ id: categories.id, slug: categories.slug, name: categories.name })
    .from(categories)
    .where(eq(categories.active, true))
    .orderBy(asc(categories.name));

  const subscriptionRows = await db
    .select({
      id: notificationSubscriptions.id,
      categoryId: notificationSubscriptions.categoryId,
      city: notificationSubscriptions.city,
      school: notificationSubscriptions.school,
      keyword: notificationSubscriptions.keyword,
      active: notificationSubscriptions.active,
      categoryName: categories.name,
      categorySlug: categories.slug
    })
    .from(notificationSubscriptions)
    .leftJoin(categories, eq(notificationSubscriptions.categoryId, categories.id))
    .where(eq(notificationSubscriptions.userId, userId))
    .orderBy(asc(notificationSubscriptions.id));

  const options: CategoryOption[] = categoryRows;
  const subscriptions: SubscriptionRow[] = subscriptionRows;

  return (
    <main className="min-h-screen">
      <header className="shell flex flex-wrap items-center justify-between gap-3 pt-6 pb-2">
        <div className="flex items-center gap-3">
          <Link className="action-secondary min-h-[38px]" href="/">← Voltar</Link>
          <div>
            <p className="eyebrow">Notificações</p>
            <h1 className="text-3xl font-extrabold tracking-tight text-[var(--color-fg)]">Meus alertas</h1>
          </div>
        </div>
        <ThemeToggle />
      </header>
      <section className="shell py-6">
        <AlertsPanel categories={options} initial={subscriptions} />
      </section>
    </main>
  );
}
