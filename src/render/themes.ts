import type { FontFace } from "./fonts.js";

// Every theme styles the same markdown structure (see RESUME_MARKDOWN_GUIDE):
//   # Name
//   tagline paragraph            -> h1 + p
//   contact paragraph            -> h1 + p + p
//   ## Section                   -> h2
//   ### Job title — Company      -> h3
//   *Dates | Location*           -> h3 + p
//   optional role description    -> h3 + p + p
//   - bullets, > callouts, tables (two-column competencies)

export type ThemeName = "navy" | "minimal" | "classic";
export const THEME_NAMES: ThemeName[] = ["navy", "minimal", "classic"];

export interface Theme {
  font: FontFace;
  css: string;
}

// Page-break rules shared by every theme: keep headings attached to what follows them.
export const SHARED_CSS = `
* { box-sizing: border-box; }

h2, h3, h4 {
  page-break-after: avoid;
  break-after: avoid;
}

h2 + p, h2 + ul, h2 + table,
h3 + p, h3 + ul,
h4 + p, h4 + ul {
  page-break-before: avoid;
  break-before: avoid;
}

li, p {
  orphans: 3;
  widows: 3;
}

blockquote, table {
  page-break-inside: avoid;
  break-inside: avoid;
}

thead { display: none; }

/* Cover letters reuse the theme but read as prose: roomier paragraphs. */
body.letter { line-height: 1.55; }
body.letter p { margin: 0 0 10pt 0; }
`;

// The original render-pdf.sh look: Inter, deep navy accents, tinted impact callouts.
const navy: Theme = {
  font: {
    family: "Inter",
    pkg: "@fontsource/inter",
    filePrefix: "inter",
    weights: [400, 500, 600, 700],
    italicWeights: [400],
  },
  css: `
body {
  font-family: 'Inter', 'Calibri', 'Helvetica Neue', Arial, sans-serif;
  font-size: 10.5pt;
  color: #111827;
  line-height: 1.45;
  margin: 0;
}

h1 {
  font-size: 21pt;
  font-weight: 700;
  color: #0F172A;
  margin: 0 0 3pt 0;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

h1 + p {
  font-size: 10.5pt;
  font-weight: 500;
  color: #1E3A6E;
  margin: 0 0 2pt 0;
  letter-spacing: 0.01em;
}

h1 + p + p {
  font-size: 9.5pt;
  font-weight: 500;
  color: #334155;
  letter-spacing: 0.02em;
  line-height: 1.7;
  margin: 8pt 0 4pt 0;
  padding-top: 6pt;
  border-top: 0.75px solid #CBD5E1;
}

h1 + p + p a {
  color: #1E3A6E;
  font-weight: 600;
  text-decoration: none;
}

h2 {
  font-size: 9pt;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.13em;
  color: #1E3A6E;
  border-bottom: 1.5px solid #1E3A6E;
  padding-bottom: 3pt;
  margin: 17pt 0 7pt 0;
}

h3 {
  font-size: 11.5pt;
  font-weight: 700;
  color: #0F172A;
  margin: 10pt 0 0 0;
  line-height: 1.3;
}

h3 + p {
  font-size: 9.5pt;
  font-style: italic;
  color: #64748B;
  margin: 1pt 0 4pt 0;
}

h3 + p + p {
  font-size: 10pt;
  color: #475569;
  margin: 2pt 0 5pt 0;
}

h4 {
  font-size: 10pt;
  font-weight: 600;
  font-style: italic;
  color: #1E3A6E;
  margin: 8pt 0 3pt 0;
}

p { margin: 2pt 0 4pt 0; }

ul {
  margin: 2pt 0 5pt 0;
  padding-left: 15pt;
  list-style-type: disc;
}

li {
  font-size: 10.5pt;
  color: #111827;
  line-height: 1.45;
  margin-bottom: 3pt;
}

strong { font-weight: 600; }
em { font-style: italic; }
a { color: #1E3A6E; }

hr {
  border: none;
  border-top: 1px solid #E2E8F0;
  margin: 8pt 0;
}

blockquote {
  margin: 6pt 0 4pt 0;
  padding: 6pt 10pt;
  border-left: 3px solid #1E3A6E;
  background: #EFF6FF;
  border-radius: 0 3pt 3pt 0;
  color: #1E293B;
  font-size: 10pt;
  font-weight: 500;
}

blockquote p { margin: 0; }

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10pt;
  margin: 4pt 0 2pt 0;
}

td {
  padding: 4pt 8pt 4pt 0;
  vertical-align: top;
  border-bottom: 0.75px solid #E2E8F0;
}

td:first-child {
  width: 25%;
  font-weight: 600;
  color: #1E3A6E;
  font-size: 9.5pt;
  padding-right: 12pt;
  white-space: nowrap;
}

td:last-child {
  color: #334155;
  font-size: 10pt;
}

tr:last-child td { border-bottom: none; }
`,
};

// Monochrome and compact: IBM Plex Sans, no color, thin rules. Fits more on a page.
const minimal: Theme = {
  font: {
    family: "IBM Plex Sans",
    pkg: "@fontsource/ibm-plex-sans",
    filePrefix: "ibm-plex-sans",
    weights: [400, 500, 600, 700],
    italicWeights: [400],
  },
  css: `
body {
  font-family: 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif;
  font-size: 10pt;
  color: #000000;
  line-height: 1.4;
  margin: 0;
}

h1 {
  font-size: 18pt;
  font-weight: 600;
  margin: 0 0 2pt 0;
  line-height: 1.1;
}

h1 + p {
  font-size: 10pt;
  color: #333333;
  margin: 0 0 2pt 0;
}

h1 + p + p {
  font-size: 9pt;
  color: #333333;
  margin: 0 0 6pt 0;
}

h1 + p + p a {
  color: #000000;
  text-decoration: none;
}

h2 {
  font-size: 9.5pt;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border-bottom: 0.75px solid #000000;
  padding-bottom: 2pt;
  margin: 13pt 0 5pt 0;
}

h3 {
  font-size: 10.5pt;
  font-weight: 600;
  margin: 8pt 0 0 0;
  line-height: 1.3;
}

h3 + p {
  font-size: 9pt;
  color: #555555;
  margin: 0 0 3pt 0;
}

h3 + p + p {
  font-size: 9.5pt;
  color: #333333;
  margin: 1pt 0 3pt 0;
}

h4 {
  font-size: 9.5pt;
  font-weight: 600;
  margin: 6pt 0 2pt 0;
}

p { margin: 2pt 0 3pt 0; }

ul {
  margin: 1pt 0 4pt 0;
  padding-left: 13pt;
}

li {
  margin-bottom: 2pt;
}

strong { font-weight: 600; }
a { color: #000000; }

hr {
  border: none;
  border-top: 0.75px solid #CCCCCC;
  margin: 6pt 0;
}

blockquote {
  margin: 4pt 0;
  padding: 0 0 0 8pt;
  border-left: 2px solid #000000;
}

blockquote p { margin: 0; }

table {
  width: 100%;
  border-collapse: collapse;
  margin: 2pt 0;
}

td {
  padding: 2pt 8pt 2pt 0;
  vertical-align: top;
}

td:first-child {
  width: 22%;
  font-weight: 600;
  white-space: nowrap;
}
`,
};

// Traditional: Source Serif, centered header, small-caps section rules. Suits finance, law, academia.
const classic: Theme = {
  font: {
    family: "Source Serif 4",
    pkg: "@fontsource/source-serif-4",
    filePrefix: "source-serif-4",
    weights: [400, 600, 700],
    italicWeights: [400],
  },
  css: `
body {
  font-family: 'Source Serif 4', Georgia, 'Times New Roman', serif;
  font-size: 10.5pt;
  color: #1A1A1A;
  line-height: 1.4;
  margin: 0;
}

h1 {
  font-size: 20pt;
  font-weight: 600;
  text-align: center;
  letter-spacing: 0.04em;
  margin: 0 0 3pt 0;
  line-height: 1.1;
}

h1 + p {
  font-size: 10.5pt;
  font-style: italic;
  text-align: center;
  margin: 0 0 2pt 0;
}

h1 + p + p {
  font-size: 9.5pt;
  text-align: center;
  margin: 0 0 6pt 0;
  padding-bottom: 6pt;
  border-bottom: 1px solid #1A1A1A;
}

h1 + p + p a {
  color: #1A1A1A;
  text-decoration: none;
}

h2 {
  font-size: 11pt;
  font-weight: 600;
  font-variant: small-caps;
  letter-spacing: 0.06em;
  border-bottom: 0.5px solid #1A1A1A;
  padding-bottom: 1pt;
  margin: 14pt 0 6pt 0;
}

h3 {
  font-size: 11pt;
  font-weight: 700;
  margin: 9pt 0 0 0;
  line-height: 1.3;
}

h3 + p {
  font-size: 10pt;
  font-style: italic;
  color: #444444;
  margin: 0 0 3pt 0;
}

h3 + p + p {
  font-size: 10pt;
  margin: 1pt 0 4pt 0;
}

h4 {
  font-size: 10.5pt;
  font-weight: 600;
  font-style: italic;
  margin: 7pt 0 2pt 0;
}

p { margin: 2pt 0 4pt 0; }

ul {
  margin: 2pt 0 5pt 0;
  padding-left: 15pt;
}

li {
  margin-bottom: 2pt;
}

strong { font-weight: 600; }
a { color: #1A1A1A; }

hr {
  border: none;
  border-top: 0.5px solid #1A1A1A;
  margin: 8pt 0;
}

blockquote {
  margin: 5pt 16pt;
  font-style: italic;
}

blockquote p { margin: 0; }

table {
  width: 100%;
  border-collapse: collapse;
  margin: 3pt 0;
}

td {
  padding: 2pt 10pt 2pt 0;
  vertical-align: top;
}

td:first-child {
  width: 25%;
  font-weight: 600;
  white-space: nowrap;
}
`,
};

export const THEMES: Record<ThemeName, Theme> = { navy, minimal, classic };
