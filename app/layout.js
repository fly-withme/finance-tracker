import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata = {
  title: "Open Ledger",
  description: "Modern personal finance management application",
  // Füge das 'icons'-Objekt hinzu, um das Favicon zu definieren
  icons: {
    icon: "/logo.svg", // Verwenden Sie den Pfad zu Ihrem SVG-Logo
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body className={`${spaceGrotesk.variable} antialiased`} suppressHydrationWarning={true}>
        {children}
      </body>
    </html>
  );
}