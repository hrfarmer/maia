import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Maia",
  description: "Discord bot dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var m=window.matchMedia("(prefers-color-scheme: dark)");if(m.matches)d.classList.add("dark");m.addEventListener("change",function(e){d.classList.toggle("dark",e.matches);});}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-svh font-sans">{children}</body>
    </html>
  );
}
