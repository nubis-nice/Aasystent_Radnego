import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/lib/notifications/toast";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { VoiceProvider } from "@/contexts/VoiceContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Asystent Radnego",
  description: "Inteligentny asystent dla radnych samorządowych",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body className={inter.className}>
        <ThemeProvider>
          <ToastProvider>
            <VoiceProvider>{children}</VoiceProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
