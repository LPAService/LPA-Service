import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for the favorite server action. Session, DB layer and Next helpers are mocked,
 * so nothing is written and no database is needed.
 */

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  setSchoolFavorite: vi.fn(),
  revalidatePath: vi.fn(),
  // Next's redirect() throws to stop execution; mirror that behavior.
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/session", () => ({ getCurrentUserId: mocks.getCurrentUserId }));
vi.mock("@/lib/data/schools", () => ({ setSchoolFavorite: mocks.setSchoolFavorite }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { toggleSchoolFavorite } from "@/app/escolas/actions";

function formData(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("toggleSchoolFavorite (server action)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUserId.mockResolvedValue(5);
    mocks.setSchoolFavorite.mockResolvedValue({ ok: true, isFavorite: true });
  });

  it("sem sessão: redireciona para /login e não grava nada", async () => {
    mocks.getCurrentUserId.mockResolvedValue(null);

    await expect(
      toggleSchoolFavorite(formData({ idSchool: "1001", favorite: "true" }))
    ).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(mocks.setSchoolFavorite).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("usa sempre o usuário da sessão; id de usuário enviado pelo formulário é ignorado", async () => {
    await toggleSchoolFavorite(
      formData({ idSchool: "1001", favorite: "true", userId: "999", user_id: "999" })
    );

    expect(mocks.setSchoolFavorite).toHaveBeenCalledTimes(1);
    expect(mocks.setSchoolFavorite).toHaveBeenCalledWith(5, 1001, true);
  });

  it("favorite=false é repassado como desfavoritar", async () => {
    mocks.setSchoolFavorite.mockResolvedValue({ ok: true, isFavorite: false });

    await toggleSchoolFavorite(formData({ idSchool: "1001", favorite: "false" }));

    expect(mocks.setSchoolFavorite).toHaveBeenCalledWith(5, 1001, false);
  });

  it("sucesso: revalida a lista e a página da escola", async () => {
    await toggleSchoolFavorite(formData({ idSchool: "1001", favorite: "true" }));

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/escolas");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/escolas/1001");
  });

  it("usuário da sessão inexistente: redireciona para /login, sem erro de servidor", async () => {
    mocks.setSchoolFavorite.mockResolvedValue({ ok: false, reason: "user_not_found" });

    await expect(
      toggleSchoolFavorite(formData({ idSchool: "1001", favorite: "true" }))
    ).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("escola fora do escopo: recusa sem lançar erro", async () => {
    mocks.setSchoolFavorite.mockResolvedValue({ ok: false, reason: "out_of_scope" });

    await expect(
      toggleSchoolFavorite(formData({ idSchool: "1003", favorite: "true" }))
    ).resolves.toBeUndefined();

    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("id de escola ausente ou inválido: recusa sem lançar erro", async () => {
    mocks.setSchoolFavorite.mockResolvedValue({ ok: false, reason: "invalid_school" });

    await expect(toggleSchoolFavorite(formData({ favorite: "true" }))).resolves.toBeUndefined();

    expect(mocks.setSchoolFavorite).toHaveBeenCalledWith(5, 0, true);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
