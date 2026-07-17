import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/components/theme";
import { SITE } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = SITE.url;
const TITLE = `${SITE.name} — ${SITE.tagline}`;
const DESCRIPTION = SITE.description;

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
  authors: [{ name: SITE.author, url: SITE.socials[1].href }],
  creator: SITE.author,
  publisher: SITE.author,
  category: "technology",
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
        {/* Structured data for search + LLM understanding */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: SITE.name,
              description: SITE.description,
              url: SITE.url,
              applicationCategory: "DeveloperApplication",
              operatingSystem: "Web",
              offers: [
                { "@type": "Offer", name: "Free", price: "0", priceCurrency: "INR" },
                { "@type": "Offer", name: "Pro", price: "749", priceCurrency: "INR" },
              ],
              author: {
                "@type": "Person",
                name: SITE.author,
                url: SITE.socials[1].href,
                sameAs: SITE.socials.map((s) => s.href),
              },
            }),
          }}
        />

        {/* Google Analytics (gtag.js) */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${SITE.gaId}`}
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${SITE.gaId}');`}
        </Script>

        <ClerkProvider>
          <ThemeProvider>
            {children}
            <Toaster />
            <Analytics />
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
