import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Clean Sweep", description: "Restaurant bar and beverage station inspections" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
