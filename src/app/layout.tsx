import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/components/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://repolens.vercel.app";
const TITLE = "RepoLens — Explore any codebase as a living map";
const DESCRIPTION =
  "Paste a GitHub repo and fly through its architecture. AI-guided code navigation — interactive dependency graph, file explanations, and natural-language Q&A — instead of a static folder tree.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s · RepoLens" },
  description: DESCRIPTION,
  applicationName: "RepoLens",
  keywords: [
    "codebase navigator",
    "dependency graph",
    "code visualization",
    "understand codebase",
    "AI code explorer",
    "GitHub repo explorer",
    "code onboarding",
    "architecture diagram",
  ],
  authors: [{ name: "RepoLens" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "RepoLens",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
          <Toaster />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
