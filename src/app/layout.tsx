import type { Metadata } from "next";
import "./globals.css";
import "./root-logo.css";

export const metadata: Metadata = { title: "Fenerbahçe Lobi Haritası", description: "İnteraktif Fenerbahçe lobi haritası" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="tr"><body>{children}</body></html>;
}
