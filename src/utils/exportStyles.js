// src/utils/exportStyles.js
// Centralized theme for blueprint-style siteplan exports

export const BLUEPRINT_THEME = {
  fonts: {
    heading: { family: 'helvetica', weight: 'bold' }, // fallback; swap to Roboto Condensed if embedded
    body: { family: 'helvetica', weight: 'normal' },
    mono: { family: 'courier', weight: 'normal' }
  },
  sizesMm: {
    h1: 6.5, // ~18pt
    h2: 4.3, // ~12pt
    h3: 3.3, // ~9.5pt
    body: 2.7, // ~7.6pt
    small: 2.3 // ~6.5pt
  },
  linesMm: {
    primary: 0.6,
    secondary: 0.4,
    tertiary: 0.25,
    dim: 0.3,
    leader: 0.25
  },
  spacingMm: {
    pageMargin: 10,
    blockGap: 4,
    inner: 6,
    pad: 2
  },
  colors: {
    text: { r: 31, g: 41, b: 55 },
    muted: { r: 55, g: 65, b: 81 },
    accent: { r: 59, g: 130, b: 246 },
    contextStroke: { r: 156, g: 163, b: 175 },
    white: { r: 255, g: 255, b: 255 }
  }
};

// No-op font registration placeholder; keeps export resilient if custom fonts are not present
export const registerBlueprintFonts = (pdf) => {
  try {
    // If custom fonts are later added to public/fonts, they can be registered here via addFileToVFS/addFont
    // pdf.addFileToVFS('RobotoCondensed-Regular.ttf', B64_TEXT);
    // pdf.addFont('RobotoCondensed-Regular.ttf', 'RobotoCondensed', 'normal');
    // pdf.addFileToVFS('RobotoCondensed-Bold.ttf', B64_TEXT);
    // pdf.addFont('RobotoCondensed-Bold.ttf', 'RobotoCondensed', 'bold');
  } catch (_) {}
};

export const setPdfFont = (pdf, role = 'body', sizeMm = BLUEPRINT_THEME.sizesMm.body) => {
  const theme = BLUEPRINT_THEME;
  const family = role === 'heading' ? theme.fonts.heading.family : theme.fonts.body.family;
  const weight = role === 'heading' ? theme.fonts.heading.weight : theme.fonts.body.weight;
  try { pdf.setFont(family, weight); } catch (_) {}
  const pts = sizeMm / 0.3528; // mm -> pt
  pdf.setFontSize(pts);
};

export const mmFromPt = (pt) => pt * 0.3528;
export const ptFromMm = (mm) => mm / 0.3528;

export const drawTextWithWipe = (pdf, text, x, y, opts = {}) => {
  const theme = BLUEPRINT_THEME;
  const padding = opts.paddingMm ?? 0.8;
  const saved = pdf.getFontSize();
  // getTextWidth returns width in current font units (pt-width converted by jsPDF). Convert to mm by ratio of font sizes
  const widthMm = (pdf.getTextWidth(text) * (saved / pdf.getFontSize())) * 0.3528;
  const heightMm = mmFromPt(saved) * 0.8; // approximate cap height
  pdf.setFillColor(theme.colors.white.r, theme.colors.white.g, theme.colors.white.b);
  pdf.rect(x - widthMm / 2 - padding, y - heightMm / 2 - padding, widthMm + 2 * padding, heightMm + 2 * padding, 'F');
  pdf.setTextColor(theme.colors.text.r, theme.colors.text.g, theme.colors.text.b);
  pdf.text(text, x, y, { align: 'center', baseline: 'middle' });
};

export const drawNorthArrow = (pdf, x, y, sizeMm = 12) => {
  const theme = BLUEPRINT_THEME;
  const half = sizeMm / 2;
  pdf.setDrawColor(theme.colors.text.r, theme.colors.text.g, theme.colors.text.b);
  pdf.setLineWidth(BLUEPRINT_THEME.linesMm.secondary);
  // Triangle
  pdf.triangle(x, y - half, x - half * 0.5, y + half * 0.5, x + half * 0.5, y + half * 0.5, 'S');
  // "N"
  setPdfFont(pdf, 'heading', BLUEPRINT_THEME.sizesMm.small);
  pdf.text('N', x, y + half + 3, { align: 'center' });
};

export const drawScaleBar = (pdf, x, y, widthMm, metersPerMm) => {
  const theme = BLUEPRINT_THEME;
  // Choose a nice round scale length in meters for ~half the bar
  const targetMeters = metersPerMm * (widthMm * 0.6);
  const nice = [50, 100, 200, 250, 500, 1000];
  const chosen = nice.find(n => n >= targetMeters) || 1000;
  const barMm = chosen / metersPerMm;
  const divisions = 4;
  const tickMm = barMm / divisions;
  pdf.setDrawColor(theme.colors.text.r, theme.colors.text.g, theme.colors.text.b);
  pdf.setLineWidth(theme.linesMm.secondary);
  // Base line
  pdf.line(x, y, x + barMm, y);
  for (let i = 0; i <= divisions; i += 1) {
    const px = x + i * tickMm;
    pdf.line(px, y - 1.5, px, y + 1.5);
  }
  setPdfFont(pdf, 'body', theme.sizesMm.small);
  const label = chosen >= 1000 ? `${(chosen / 1000).toFixed(1)} km` : `${chosen} m`;
  pdf.text(label, x + barMm / 2, y + 4.5, { align: 'center' });
};


