import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/session";

export const runtime = "nodejs";

/** Marca como lida uma notificação ({ id }) ou todas (sem id). */
export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { id?: number | string };
  try {
    body = (await request.json()) as { id?: number | string };
  } catch {
    return Response.json({ error: "json inválido" }, { status: 400 });
  }

  if (body.id === undefined || body.id === null || body.id === "") {
    const result = await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
      .returning({ id: notifications.id });
    return Response.json({ updated: result.length });
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "id inválido" }, { status: 400 });
  }

  const result = await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(
        eq(notifications.userId, userId),
        inArray(notifications.id, [id])
      )
    )
    .returning({ id: notifications.id });

  return Response.json({ updated: result.length });
}
