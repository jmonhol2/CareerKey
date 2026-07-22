import type { Metadata } from "next";
import "./globals.css";

const deploymentHost = process.env.VERCEL_URL ?? "localhost:3001";
const siteUrl = deploymentHost.startsWith("http")
  ? deploymentHost
  : `${deploymentHost.startsWith("localhost") ? "http" : "https"}://${deploymentHost}`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "CareerKey",
  description: "Build better career connections with CareerKey.",
  openGraph: {
    title: "CareerKey",
    description: "Your next opportunity starts with the right connection.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "CareerKey career connections" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "CareerKey",
    description: "Your next opportunity starts with the right connection.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
