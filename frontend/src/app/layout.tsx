import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "QuickCall | MCP Elicitation Demo",
  description: "Interactive demo showcasing MCP elicitation for gathering user input",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "QuickCall | MCP Elicitation Demo",
    description: "Interactive demo showcasing MCP elicitation for gathering user input",
    siteName: "QuickCall",
  },
  twitter: {
    card: "summary",
    title: "QuickCall | MCP Elicitation Demo",
    description: "Interactive demo showcasing MCP elicitation for gathering user input",
  },
  themeColor: "#0d1117",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#161b22]`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
