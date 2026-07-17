import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NameMore — NBA Recall Game",
  description:
    "Race the clock and name as many current NBA players as you can.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
