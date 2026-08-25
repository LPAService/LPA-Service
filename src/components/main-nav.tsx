import Link from "next/link";

type MainNavItem = "open" | "history" | "relatorios" | "fornecedores" | "preorcamento";

type MainNavProps = {
  current: MainNavItem;
};

const links: Array<{ current: MainNavItem; href: string; label: string }> = [
  { current: "open", href: "/", label: "Cotações abertas" },
  { current: "history", href: "/?view=history", label: "Histórico de compras" },
  { current: "relatorios", href: "/relatorios", label: "Relatório & Análise" },
  { current: "fornecedores", href: "/fornecedores", label: "Fornecedores" },
  { current: "preorcamento", href: "/preorcamento", label: "Pré-Orçamento" }
];

export function MainNav({ current }: MainNavProps) {
  return (
    <nav aria-label="Navegação principal" className="flex flex-wrap items-center gap-2">
      {links.map((link) => (
        <Link
          className={link.current === current ? "action-primary" : "action-secondary"}
          href={link.href}
          key={link.current}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
