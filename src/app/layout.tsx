import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oportunidades para fornecedores - Caixa Escolar MG",
  description: "Oportunidades da Caixa Escolar MG organizadas para fornecedores."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="bg-[var(--color-bg)] text-[var(--color-fg)] font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
