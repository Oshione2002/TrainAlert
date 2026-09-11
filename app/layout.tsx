import type { Metadata, Viewport } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const bodyFont = DM_Sans({ variable: "--font-body", subsets: ["latin"] });
const displayFont = Manrope({ variable: "--font-display", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;
  return {
    title: "TrainAlert NG — Catch the seat",
    description: "Get an alert the moment a seat opens on your Nigerian train journey.",
    applicationName: "TrainAlert NG",
    manifest: "/manifest.webmanifest",
    icons: { icon: "/favicon.svg", apple: "/favicon.svg" },
    openGraph: { title: "TrainAlert NG — Catch the seat", description: "Two-minute NRC seat checks with Telegram and phone notifications.", type: "website", images: [{ url: image, width: 1536, height: 1024, alt: "TrainAlert NG — Catch the seat." }] },
    twitter: { card: "summary_large_image", title: "TrainAlert NG — Catch the seat", description: "Know when an NRC seat opens.", images: [image] },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0b4f3c" },
    { media: "(prefers-color-scheme: dark)", color: "#08130f" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var saved=localStorage.getItem("trainalert-theme");var theme=saved==="light"||saved==="dark"?saved:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>{children}</body>
    </html>
  );
}
