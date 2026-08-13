import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { HydrationFix } from '@/components/HydrationFix';
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
  title: "Zettel",
  description: "A simple note-taking app",
  icons: {
    icon: "/zettel-icon.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      suppressHydrationWarning={true}
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning={true} className="min-h-full flex flex-col">
        <HydrationFix />
        {children}
      </body>
    </html>
  );
}
