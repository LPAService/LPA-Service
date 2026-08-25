import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, notificationSubscriptions } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/session";
import { hasAnyCriteria } from "@/lib/notify/match";

export const runtime = "nodejs";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: notificationSubscriptions.id,
      categoryId: notificationSubscriptions.categoryId,
      city: notificationSubscriptions.city,
      school: notificationSubscriptions.school,
      keyword: notificationSubscriptions.keyword,
      active: notificationSubscriptions.active,
      createdAt: notificationSubscriptions.createdAt,
      categoryName: categories.name,
      categorySlug: categories.slug
    })
    .from(notificationSubscriptions)
    .leftJoin(categories, eq(notificationSubscriptions.categoryId, categories.id))
    .where(eq(notificationSubscriptions.userId, userId))
    .orderBy(asc(notificationSubscriptions.id));

  return Response.json({ subscriptions: rows });
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: {
    categoryId?: number | string | null;
    city?: string | null;
    school?: string | null;
    keyword?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "json inválido" }, { status: 400 });
  }

  const categoryId = body.categoryId ? Number(body.categoryId) : null;
  const city = clean(body.city);
  const school = clean(body.school);
  const keyword = clean(body.keyword);

  if (!Number.isInteger(categoryId ?? 0)) {
    return Response.json({ error: "categoria inválida" }, { status: 400 });
  }
  if (!hasAnyCriteria({ categoryId, city, school, keyword })) {
    return Response.json(
      { error: "Escolha ao menos um critério: categoria, cidade, escola ou palavra-chave." },
      { status: 400 }
    );
  }

  const [created] = await db
    .insert(notificationSubscriptions)
    .values({ userId, categoryId: categoryId ?? null, city, school, keyword })
    .returning({
      id: notificationSubscriptions.id,
      categoryId: notificationSubscriptions.categoryId,
      city: notificationSubscriptions.city,
      school: notificationSubscriptions.school,
      keyword: notificationSubscriptions.keyword,
      active: notificationSubscriptions.active
    });

  return Response.json({ subscription: created }, { status: 201 });
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
