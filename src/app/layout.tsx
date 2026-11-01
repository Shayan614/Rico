import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { PostHogProvider } from "@/components/telemetry/PostHogProvider";

export const metadata: Metadata = {
  title: "Rico — Autonomous Financial & Agentic Commerce Agent",
  description: "Next.js 14 AI Agent command center powered by Gemini, Playwright, and PayPal AI Toolkit",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="font-sans antialiased bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 min-h-screen"
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange={false}
        >
          <PostHogProvider>{children}</PostHogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
