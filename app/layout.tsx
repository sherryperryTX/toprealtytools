import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Top Realty Tools — AI-Powered Tools for Real Estate Pros",
  description: "A collection of AI-powered tools built for real estate professionals. Home inspections, appraisals, and more.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
