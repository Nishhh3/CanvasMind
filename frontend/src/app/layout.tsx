import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { Toaster } from "@/components/ui/Toaster";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "CanvasMind | Interactive AI Learning Canvas",
  description: "Organise projects, write and draw on canvas pages, and study your own notes with an AI assistant.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f5f8fc",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <Script id="studycanvas-theme-init" strategy="beforeInteractive">
          {`(function(){var t=localStorage.getItem("studycanvas-theme");if(t==="dark"){document.documentElement.dataset.theme="dark";document.documentElement.style.colorScheme="dark";}})();`}
        </Script>
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}