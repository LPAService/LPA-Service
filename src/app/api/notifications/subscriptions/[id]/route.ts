import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificationSubscriptions } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/session";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "id inválido" }, { status: 400 });
  }

  let body: { active?: boolean };
  try {
    body = (await request.json()) as { active?: boolean };
  } catch {
    return Response.json({ error: "json inválido" }, { status: 400 });
  }
  if (typeof body.active !== "boolean") {
    return Response.json({ error: "campo active obrigatório" }, { status: 400 });
  }

  const result = await db
    .update(notificationSubscriptions)
    .set({ active: body.active, updatedAt: new Date() })
    .where(and(eq(notificationSubscriptions.id, id), eq(notificationSubscriptions.userId, userId)))
    .returning({ id: notificationSubscriptions.id });

  if (result.length === 0) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ subscription: result[0] });
}

export async function DELETE(_request: Request, { params }: Params) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "id inválido" }, { status: 400 });
  }

  const result = await db
    .delete(notificationSubscriptions)
    .where(and(eq(notificationSubscriptions.id, id), eq(notificationSubscriptions.userId, userId)))
    .returning({ id: notificationSubscriptions.id });

  if (result.length === 0) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ deleted: result[0]!.id });
}
