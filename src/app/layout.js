"use client";

import { Geist, Geist_Mono, Exo } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { SidebarProvider } from "@/components/ui/sidebar";
import ProtectedLayoutWrapper from "@/components/ProtectedLayoutWrapper";
import FontOverride from "@/components/ui/FontOverride";

const exo = Exo({
  variable: "--font-exo",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${exo.variable} ${geistSans.variable} ${geistMono.variable} antialiased flex h-screen h-dvh overflow-hidden`}
        suppressHydrationWarning={true}
      >
        <AuthProvider>
          <SidebarProvider>
            <FontOverride />
            <ProtectedLayoutWrapper>{children}</ProtectedLayoutWrapper>
          </SidebarProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
