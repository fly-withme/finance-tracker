import { ClerkProvider, SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { deDE } from "@clerk/localizations";
import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Wir behalten unsere Inter-Schriftart
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: '--font-inter'
});

export const metadata: Metadata = {
  title: "Clarity Finance",
  description: "Designed with focus.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Wir verwenden den ClerkProvider mit unserer deutschen Lokalisierung
    <ClerkProvider localization={deDE}>
      <html lang="de">
        <body className={`${inter.variable} font-sans bg-base text-primary-text`}>
          {/* Header für Login/Logout-Buttons aus der Clerk-Anleitung */}
          <header className="flex justify-end p-4">
            <SignedOut>
              <SignInButton />
            </SignedOut>
            <SignedIn>
              <UserButton afterSignOutUrl="/"/>
            </SignedIn>
          </header>
          {/* Hier wird deine eigentliche App gerendert */}
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}