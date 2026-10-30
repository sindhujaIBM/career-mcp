import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

// Fonts ship as npm dependencies (@fontsource/*, all SIL OFL) and are inlined
// into the HTML as data URIs, so rendering never needs a network connection.

const require = createRequire(import.meta.url);

export interface FontFace {
  family: string;
  pkg: string;
  filePrefix: string;
  weights: number[];
  italicWeights: number[];
}

async function faceCss(face: FontFace, weight: number, style: "normal" | "italic"): Promise<string> {
  const pkgDir = path.dirname(require.resolve(`${face.pkg}/package.json`));
  const file = path.join(pkgDir, "files", `${face.filePrefix}-latin-${weight}-${style}.woff2`);
  const data = (await readFile(file)).toString("base64");
  return `@font-face {
  font-family: '${face.family}';
  font-style: ${style};
  font-weight: ${weight};
  src: url(data:font/woff2;base64,${data}) format('woff2');
}`;
}

export async function fontFaceCss(face: FontFace): Promise<string> {
  const rules = await Promise.all([
    ...face.weights.map((w) => faceCss(face, w, "normal")),
    ...face.italicWeights.map((w) => faceCss(face, w, "italic")),
  ]);
  return rules.join("\n");
}
