import { toggleSchoolFavorite } from "./actions";

/**
 * Botão de estrela para favoritar/desfavoritar uma escola.
 * Formulário com server action: funciona sem JavaScript do cliente.
 */
export function FavoriteButton({
  idSchool,
  isFavorite,
  schoolName,
}: {
  idSchool: number;
  isFavorite: boolean;
  schoolName: string;
}) {
  const label = isFavorite
    ? `Remover ${schoolName} dos favoritos`
    : `Favoritar ${schoolName}`;

  return (
    <form action={toggleSchoolFavorite} className="shrink-0">
      <input type="hidden" name="idSchool" value={idSchool} />
      <input type="hidden" name="favorite" value={isFavorite ? "false" : "true"} />
      <button
        type="submit"
        aria-label={label}
        aria-pressed={isFavorite}
        title={label}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-lg leading-none transition-colors hover:border-[var(--color-primary)] ${
          isFavorite ? "text-[var(--color-primary)]" : "text-[var(--color-fg-muted)]"
        }`}
      >
        <span aria-hidden="true">{isFavorite ? "★" : "☆"}</span>
      </button>
    </form>
  );
}
