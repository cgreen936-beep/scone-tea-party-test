import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import EditorAttributeGuard from "./editor-attribute-guard";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Scone Tea Party Ltd — Ops desk",
  description:
    "Local prototype for corporate invoice-later orders, kitchen printouts, and Morrisons pack counts. Order dispatch stays mocked.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-GB"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <EditorAttributeGuard />
        {children}
      </body>
    </html>
  );
}
