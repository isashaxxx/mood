import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MOODua · Наскрізна аналітика",
  description: "Аналітика MOODua на основі Excel-баз угод і лідів за 2026 рік",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
