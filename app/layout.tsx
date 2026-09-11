import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import QueryProvider from "@/components/QueryProvider";
import { WalletProvider } from "@/components/WalletProvider";
import { ToastProvider } from "@/components/shared/ToastProvider";

export const metadata: Metadata = {
  metadataBase: new URL("https://4reelzclip.com"),
  title: "4Reelzclip - AI Clipping V1.0",
  description: "Turn 1 long video into 100+ viral clips. Preview, pick, post & mint.",
  keywords: ["AI clipping", "viral videos", "video editing", "content creation", "SaaS", "video shorts"],
  authors: [{ name: "4Reelzclip Team" }],
  openGraph: {
    title: "4Reelzclip - AI Clipping V1.0",
    description: "Turn 1 long video into 100+ viral clips. Preview, pick, post & mint.",
    url: "https://4reelzclip.com",
    siteName: "4Reelzclip",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "4Reelzclip AI Clipping",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "4Reelzclip - AI Clipping V1.0",
    description: "Turn 1 long video into 100+ viral clips. Preview, pick, post & mint.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <div className="radial-bg" />
        <QueryProvider>
          <WalletProvider>
            <AuthProvider>
              <ToastProvider>
                {children}
              </ToastProvider>
            </AuthProvider>
          </WalletProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
