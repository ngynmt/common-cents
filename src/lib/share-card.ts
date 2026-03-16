export interface ShareCardCategory {
  name: string;
  percentage: number;
  color: string;
}

/**
 * Maps PersonalSpendingCategory[] to the flat ShareCardCategory[] shape.
 * Top 5 categories + optional "Other" rollup so the donut sums to 100%.
 * Note: `effectiveRate` from TaxEstimate is a decimal (e.g., 0.22 = 22%).
 */
export function mapSpendingToCard(
  spending: { category: { name: string; color: string }; percentage: number }[],
): ShareCardCategory[] {
  const top5 = spending.slice(0, 5);
  const otherPct = spending.slice(5).reduce((sum, s) => sum + s.percentage, 0);
  return [
    ...top5.map((s) => ({
      name: s.category.name,
      percentage: s.percentage,
      color: s.category.color,
    })),
    ...(otherPct > 0
      ? [{ name: "Other", percentage: otherPct, color: "#475569" }]
      : []),
  ];
}

export interface ShareCardOptions {
  spending: ShareCardCategory[];
  effectiveRate: number;
  taxYear: number;
  mode: "share" | "classified";
}

const SIZE = 1080;
const BG_TOP = "#0f172a";
const BG_BOTTOM = "#020617";
const WHITE = "#ffffff";
const SLATE_400 = "#94a3b8";
const SLATE_500 = "#64748b";
const INDIGO_400 = "#818cf8";
const RED_WATERMARK = "rgba(239, 68, 68, 0.12)";
const REDACTION_COLOR = "#1e293b";

const FONT_SERIF = "bold 36px Georgia, 'Times New Roman', serif";
const FONT_HEADLINE = "28px system-ui, -apple-system, sans-serif";
const FONT_BODY = "22px system-ui, -apple-system, sans-serif";
const FONT_SMALL = "18px system-ui, -apple-system, sans-serif";
const FONT_CTA = "20px system-ui, -apple-system, sans-serif";
const FONT_WATERMARK = "bold 120px system-ui, -apple-system, sans-serif";
const FONT_MONO = "22px 'Courier New', monospace";

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + "…").width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + "…";
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const grad = ctx.createLinearGradient(0, 0, 0, SIZE);
  grad.addColorStop(0, BG_TOP);
  grad.addColorStop(1, BG_BOTTOM);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);
}

function drawDonut(
  ctx: CanvasRenderingContext2D,
  spending: ShareCardCategory[],
  cx: number,
  cy: number,
  radius: number,
  lineWidth: number,
  mode: "share" | "classified",
) {
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "butt";

  let startAngle = -Math.PI / 2; // start at top

  for (const cat of spending) {
    const sweep = (cat.percentage / 100) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, startAngle + sweep);
    ctx.strokeStyle = cat.color;
    ctx.stroke();

    // Draw percentage label in share mode
    if (mode === "share" && cat.percentage >= 5) {
      const midAngle = startAngle + sweep / 2;
      const labelRadius = radius + lineWidth / 2 + 24;
      const lx = cx + Math.cos(midAngle) * labelRadius;
      const ly = cy + Math.sin(midAngle) * labelRadius;

      ctx.font = "bold 16px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = SLATE_400;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${cat.percentage.toFixed(1)}%`, lx, ly);
    }

    startAngle += sweep;
  }
}

function drawCategoryList(
  ctx: CanvasRenderingContext2D,
  spending: ShareCardCategory[],
  startY: number,
  mode: "share" | "classified",
): number {
  const rowHeight = 40;
  const dotRadius = 8;
  const leftX = 200;
  const rightX = SIZE - 200;
  let y = startY;

  for (const cat of spending) {
    // Color dot
    ctx.beginPath();
    ctx.arc(leftX, y + rowHeight / 2, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = cat.color;
    ctx.fill();

    // Category name
    ctx.font = FONT_BODY;
    ctx.fillStyle = WHITE;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const maxNameWidth = mode === "share" ? 380 : 420;
    const name = truncateText(ctx, cat.name, maxNameWidth);
    ctx.fillText(name, leftX + 24, y + rowHeight / 2);

    // Percentage or redaction bar
    if (mode === "share") {
      ctx.font = FONT_BODY;
      ctx.fillStyle = SLATE_400;
      ctx.textAlign = "right";
      ctx.fillText(`${cat.percentage.toFixed(1)}%`, rightX, y + rowHeight / 2);
    } else {
      // Redaction bar
      ctx.fillStyle = REDACTION_COLOR;
      ctx.fillRect(rightX - 80, y + rowHeight / 2 - 10, 80, 20);
    }

    y += rowHeight;
  }

  return y;
}

export function renderShareCard(options: ShareCardOptions): HTMLCanvasElement {
  const { spending, effectiveRate, taxYear, mode } = options;

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;

  // 1. Background
  drawBackground(ctx);

  // 2. Logo
  ctx.font = FONT_SERIF;
  ctx.fillStyle = WHITE;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("Common Cents", SIZE / 2, 60);

  // 3. Headline (or faux classified header)
  if (mode === "classified") {
    ctx.font = FONT_MONO;
    ctx.fillStyle = SLATE_500;
    ctx.fillText("TAXPAYER RECEIPT — [REDACTED]", SIZE / 2, 120);
  } else {
    ctx.font = FONT_HEADLINE;
    ctx.fillStyle = WHITE;
    ctx.fillText("Where do your federal tax dollars go?", SIZE / 2, 120);
  }

  // 4. Donut chart
  const chartCenterY = 340;
  drawDonut(ctx, spending, SIZE / 2, chartCenterY, 130, 40, mode);

  // 5. Category list
  const listStartY = 500;
  const listEndY = drawCategoryList(ctx, spending, listStartY, mode);

  // 6. Effective rate (share mode only)
  if (mode === "share") {
    ctx.font = FONT_SMALL;
    ctx.fillStyle = SLATE_400;
    ctx.textAlign = "center";
    ctx.fillText(
      `Effective rate: ${(effectiveRate * 100).toFixed(1)}%`,
      SIZE / 2,
      listEndY + 20,
    );
  }

  // 7. Classified watermark
  if (mode === "classified") {
    ctx.save();
    ctx.translate(SIZE / 2, SIZE / 2);
    ctx.rotate(-30 * (Math.PI / 180));
    ctx.font = FONT_WATERMARK;
    ctx.fillStyle = RED_WATERMARK;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("CLASSIFIED", 0, 0);
    ctx.restore();
  }

  // 8. Fiscal year
  ctx.font = FONT_SMALL;
  ctx.fillStyle = SLATE_400;
  ctx.textAlign = "center";
  ctx.fillText(`FY ${taxYear}`, SIZE / 2, SIZE - 100);

  // 9. CTA
  ctx.font = FONT_CTA;
  ctx.fillStyle = INDIGO_400;
  ctx.textAlign = "center";
  const cta =
    mode === "classified"
      ? "Declassify yours at commoncents.app"
      : "See yours at commoncents.app";
  ctx.fillText(cta, SIZE / 2, SIZE - 60);

  return canvas;
}
