import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LPA Leo",
  description: "Fundação do SaaS Caixa Escolar MG"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

