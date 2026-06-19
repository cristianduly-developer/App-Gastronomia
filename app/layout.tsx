import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionGuardProvider } from "@/components/SessionGuardProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GastroApp",
  description: "Sistema de gestión gastronómica",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GastroApp",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <head>
        <meta name="theme-color" content="#7c3aed" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${inter.className} bg-gray-950 text-white min-h-full`}>
        <SessionGuardProvider>
          {children}
        </SessionGuardProvider>
      </body>
    </html>
  );
}
