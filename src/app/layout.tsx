import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gamification VCS",
  description: "Administracion de gamificaciones periodicas del equipo de Customer Service.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Nav />
        <main className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </body>
    </html>
  );
}
