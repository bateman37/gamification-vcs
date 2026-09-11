import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Nav } from "@/components/Nav";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gamification VCS",
  description: "Administracion de gamificaciones periodicas del equipo de Customer Service.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Providers>
          <Nav />
          <main className="mx-auto w-full max-w-[1920px] px-4 py-8 sm:px-6 lg:px-10 2xl:px-16">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
