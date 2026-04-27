import { Providers } from "@/core/providers";
import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import "./globals.css";

const ui = Source_Sans_3({ subsets: ["latin"], variable: "--font-ui" });

export const metadata: Metadata = {
  title: "Reckon",
  description: "Reckon expense management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${ui.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
