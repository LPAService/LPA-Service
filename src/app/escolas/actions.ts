"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setSchoolFavorite } from "@/lib/data/schools";
import { getCurrentUserId } from "@/lib/session";

/**
 * Favorita ou desfavorita uma escola para o usuário logado.
 * O usuário vem só da sessão (nunca do formulário), então ninguém mexe nos favoritos de outro.
 */
export async function toggleSchoolFavorite(formData: FormData): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const idSchool = Number(formData.get("idSchool"));
  const favorite = formData.get("favorite") === "true";

  const result = await setSchoolFavorite(userId, idSchool, favorite);
  // Sessão aponta para usuário que não existe mais: manda para o login.
  if (!result.ok && result.reason === "user_not_found") redirect("/login");

  // Outras recusas (escola fora do escopo, id inválido) não gravam nada e não dão erro de servidor.
  revalidatePath("/escolas");
  revalidatePath(`/escolas/${idSchool}`);
}
