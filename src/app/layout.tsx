import type { Metadata, Viewport } from "next";
import { Lato, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const serif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  display: "swap",
});

const sans = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Riva Chavan Studio — Founder Questionnaire",
  description: "Riva Chavan Studio founder questionnaire.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} h-full`}>
      <body className="min-h-full bg-paper text-ink antialiased">
        {/*
          THESIS: The founder questionnaire PDF Riva already holds, made alive — one question per page,
          written on the document's own dotted lines. Refuses the SaaS form-builder (cards, pills, gradients).
          OWN-WORLD: White paper, near-black ink, a single clay accent (#8f553f). Source Serif prompts, Lato
          answers, numbered chapters, hairline rules, square controls.
          STORY: Riva recognises her brief, answers at her own pace (autosaved), reviews everything on one page and
          sends it.
          FIRST VIEWPORT: Tracked clay wordmark settles in, "Riva Chavan Studio — Founder Questionnaire" focuses up
          at display size; a clay rule draws under it, followed by the PDF's instructions and Begin control.
          FORM: Living document. Signature moment: chapter title cards that wipe away between sections.
          FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
        */}
        {children}
      </body>
    </html>
  );
}
