import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/** ID do usuário logado via NextAuth (JWT), ou null se não autenticado. */
export async function getCurrentUserId(): Promise<number | null> {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) return null;
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
