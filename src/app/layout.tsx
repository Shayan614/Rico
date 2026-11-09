import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { PostHogProvider } from "@/components/telemetry/PostHogProvider";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";

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
      <body className="font-[Inter,system-ui,sans-serif] antialiased bg-[#DCEBFE] text-[#0F172A] min-h-screen m-0">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange={false}
        >
          <PostHogProvider>
            <AuthProvider>
              {children}
              <AuthModal />
            </AuthProvider>
          </PostHogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
