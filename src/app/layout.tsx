import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pratibimb · Dalaal Street",
  description: "A simulated Indian stock market experience from the Business Education Department.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-IN"><body>{children}</body></html>;
}
