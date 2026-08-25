import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oportunidades para fornecedores - Caixa Escolar MG",
  description: "Oportunidades da Caixa Escolar MG organizadas para fornecedores."
};

const themeBootstrap = `
(function () {
  try {
    var stored = window.localStorage.getItem("lpa-leo-theme");
    var resolved = stored === "light" || stored === "dark"
      ? stored
      : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", resolved);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
`;

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="bg-[var(--color-bg)] text-[var(--color-fg)] font-sans antialiased">
        <div aria-hidden="true" className="aurora">
          <div className="blob b1" />
          <div className="blob b2" />
          <div className="blob b3" />
        </div>
        <div aria-hidden="true" className="grain" />
        {children}
      </body>
    </html>
  );
}
