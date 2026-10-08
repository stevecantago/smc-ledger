import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { HouseholdProvider } from "../src/context/HouseholdContext";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "FamLedger - Family Financial Tracker",
  description: "Multi-tenant, role-aware household financial ledger built with Supabase and Next.js.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={plusJakartaSans.variable}>
      <body className="min-h-screen bg-brand-canvas font-sans text-brand-ink antialiased">
        <HouseholdProvider>
          {children}
        </HouseholdProvider>
      </body>
    </html>
  );
}
