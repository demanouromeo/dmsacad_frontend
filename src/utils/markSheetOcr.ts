import type { Worker as TesseractWorker } from "tesseract.js";

// Reads a photographed "Fiche de report de notes" (non-APC layout from exportMarkSheets.ts: No. / Nom /
// Note1..Note6, one row per student, in roster order) and returns the handwritten marks it found.
// Runs entirely in the browser with Tesseract.js - handwriting is its weak spot, so every cell it
// can't read with confidence is reported as "unreadable"/"invalid" (with its raw guess) instead of
// being silently dropped or guessed, and the caller lets the user correct them.
//
// Strategy: page-level OCR is useless on a ruled table (the grid lines wreck the text lines), so the
// layout comes from the pixels instead: deskew the photo, find the table's ruling lines from
// row/column ink projections, and read row i of the grid as roster[i] (the sheet is printed in roster
// order). Only the orientation check and the digits go through OCR - the first few name cells decide
// which of the four rotations is upright, then each Note cell is cropped alone and read as a number.
// Mark columns printed on the sheet (exportMarkSheets.ts): Note1..Note6 (non-APC) or comp1..comp3 (APC).
export const NON_APC_OCR_COLUMNS = 6;
export const APC_OCR_COLUMNS = 3;

export interface OcrRosterStudent {
  stud_id: number;
  label: string; // "NAME SURNAME", as printed on the sheet
}

export type OcrCellStatus = "valid" | "invalid" | "unreadable";

export interface OcrCell {
  status: OcrCellStatus;
  value: number | null; // set only when status === "valid"
  raw: string; // what the OCR read ("" when nothing)
}

// column (1..n: sequence or competence rank) -> stud_id -> cell. Only cells that contain handwriting are present (blank cells are omitted).
export type OcrCellsBySequence = Map<number, Map<number, OcrCell>>;

export type OcrProgress =
  | { phase: "loading" }
  | { phase: "layout" }
  | { phase: "cells"; done: number; total: number };

type OcrErrorCode = "unreadableImage" | "noHeaders" | "noRows";

// noHeaders = the Note1..Note6 column grid wasn't found, noRows = the student row grid wasn't.
export class MarkSheetOcrError extends Error {
  code: OcrErrorCode;

  constructor(code: OcrErrorCode) {
    super(code);
    this.code = code;
  }
}

const PAGE_SIDE = 1800;
const SKEW_PROBE_SIDE = 900;
const MIN_CELL_CONFIDENCE = 35;
const MIN_INK_RATIO = 0.015;
const NAME_PROBE_ROWS = 6;

const normalizeText = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

const newCanvas = (w: number, h: number): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas;
};

const loadPage = async (file: File): Promise<HTMLCanvasElement> => {
  let bitmap: ImageBitmap;
  try {
    // Honors the EXIF orientation by default; the sheet itself may still be turned (see orientation below).
    bitmap = await createImageBitmap(file);
  } catch {
    throw new MarkSheetOcrError("unreadableImage");
  }
  const scale = Math.min(1, PAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = newCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
};

const scaleToSide = (src: HTMLCanvasElement, side: number): HTMLCanvasElement => {
  const scale = Math.min(1, side / Math.max(src.width, src.height));
  if (scale === 1) {
    return src;
  }
  const out = newCanvas(Math.round(src.width * scale), Math.round(src.height * scale));
  out.getContext("2d")!.drawImage(src, 0, 0, out.width, out.height);
  return out;
};

// Rotates around the center, same canvas size, white fill - fine for the few degrees of skew; the
// 90/180/270 turns swap/keep the size.
const rotateCanvas = (src: HTMLCanvasElement, degrees: number): HTMLCanvasElement => {
  const swap = Math.abs(degrees % 180) === 90;
  const out = newCanvas(swap ? src.height : src.width, swap ? src.width : src.height);
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return out;
};

const toGray = (canvas: HTMLCanvasElement): Uint8ClampedArray => {
  const { data } = canvas.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height);
  const gray = new Uint8ClampedArray(canvas.width * canvas.height);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = Math.round(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]);
  }
  return gray;
};

// Ink mask (1 = dark) using a local-mean threshold (integral image), so uneven lighting/shadows in a
// phone photo don't swallow the thin ruling lines the way one global threshold would.
const inkMask = (gray: Uint8ClampedArray, w: number, h: number): Uint8Array => {
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += gray[y * w + x];
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + rowSum;
    }
  }
  const half = Math.max(8, Math.round(Math.min(w, h) / 40));
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(h, y + half + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(w, x + half + 1);
      const sum =
        integral[y1 * (w + 1) + x1] - integral[y0 * (w + 1) + x1] - integral[y1 * (w + 1) + x0] + integral[y0 * (w + 1) + x0];
      const mean = sum / ((y1 - y0) * (x1 - x0));
      mask[y * w + x] = gray[y * w + x] < mean * 0.85 ? 1 : 0;
    }
  }
  return mask;
};

const maskToCanvas = (mask: Uint8Array, w: number, h: number): HTMLCanvasElement => {
  const canvas = newCanvas(w, h);
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(w, h);
  for (let i = 0; i < mask.length; i++) {
    const v = mask[i] ? 0 : 255;
    image.data[i * 4] = v;
    image.data[i * 4 + 1] = v;
    image.data[i * 4 + 2] = v;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
};

const rowProfile = (mask: Uint8Array, w: number, h: number, x0 = 0, x1 = w): number[] => {
  const profile = new Array<number>(h).fill(0);
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = x0; x < x1; x++) {
      sum += mask[y * w + x];
    }
    profile[y] = sum;
  }
  return profile;
};

const columnProfile = (mask: Uint8Array, w: number, h: number, y0 = 0, y1 = h): number[] => {
  const profile = new Array<number>(w).fill(0);
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < w; x++) {
      profile[x] += mask[y * w + x];
    }
  }
  return profile;
};

// Rotation (degrees) that makes the ruling lines most axis-aligned: the one where the row-ink
// projection is the most "peaky" (sum of squares), since a perfectly horizontal line piles all its ink in one row.
const detectSkew = (page: HTMLCanvasElement): number => {
  const probe = scaleToSide(page, SKEW_PROBE_SIDE);
  const maskCanvas = maskToCanvas(inkMask(toGray(probe), probe.width, probe.height), probe.width, probe.height);
  const score = (angle: number): number => {
    const rotated = rotateCanvas(maskCanvas, angle);
    const w = rotated.width;
    const h = rotated.height;
    const gray = toGray(rotated);
    let total = 0;
    for (let y = 0; y < h; y++) {
      let dark = 0;
      for (let x = 0; x < w; x++) {
        if (gray[y * w + x] < 128) {
          dark++;
        }
      }
      total += dark * dark;
    }
    return total;
  };
  let best = 0;
  let bestScore = -1;
  for (let a = -6; a <= 6; a += 0.5) {
    const s = score(a);
    if (s > bestScore) {
      bestScore = s;
      best = a;
    }
  }
  const coarse = best;
  for (let a = coarse - 0.5; a <= coarse + 0.5; a += 0.1) {
    const s = score(a);
    if (s > bestScore) {
      bestScore = s;
      best = a;
    }
  }
  return best;
};

// Centers of the runs of profile values >= threshold.
const findLines = (profile: number[], threshold: number): number[] => {
  const lines: number[] = [];
  let start = -1;
  for (let i = 0; i <= profile.length; i++) {
    const on = i < profile.length && profile[i] >= threshold;
    if (on && start < 0) {
      start = i;
    } else if (!on && start >= 0) {
      lines.push((start + i - 1) / 2);
      start = -1;
    }
  }
  return lines;
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

// Keeps only the ink pixels that belong to a long straight run (ruling lines), dropping text strokes.
// Runs may have gaps of up to 2 pixels. `stride` walks along the run: 1 = horizontal, w = vertical.
const longRuns = (mask: Uint8Array, w: number, h: number, horizontal: boolean, minLength: number): Uint8Array => {
  const out = new Uint8Array(mask.length);
  const lines = horizontal ? h : w;
  const length = horizontal ? w : h;
  const at = (line: number, i: number) => (horizontal ? line * w + i : i * w + line);
  for (let line = 0; line < lines; line++) {
    let start = -1;
    let lastInk = -1;
    for (let i = 0; i <= length; i++) {
      // +-1 neighbouring line tolerated, so a rule that steps one pixel (slight tilt) is not cut into short runs
      const ink =
        i < length &&
        (mask[at(line, i)] === 1 || (line > 0 && mask[at(line - 1, i)] === 1) || (line < lines - 1 && mask[at(line + 1, i)] === 1));
      if (ink) {
        if (start < 0) {
          start = i;
        }
        lastInk = i;
      } else if (start >= 0 && (i === length || i - lastInk > 2)) {
        if (lastInk - start + 1 >= minLength) {
          for (let k = start; k <= lastInk; k++) {
            out[at(line, k)] = 1;
          }
        }
        start = -1;
      }
    }
  }
  return out;
};

// Sum over +-2 neighbours: a line that is still slightly tilted spreads over a few rows, this re-concentrates it.
const smoothProfile = (profile: number[]): number[] =>
  profile.map((_, i) => {
    let sum = 0;
    for (let k = Math.max(0, i - 2); k <= Math.min(profile.length - 1, i + 2); k++) {
      sum += profile[k];
    }
    return sum;
  });

const or = (a: Uint8Array, b: Uint8Array): Uint8Array => a.map((v, i) => v | b[i]);

// Square dilation by `radius` (separable), so the erased ruling lines also lose their blurry fringe.
const dilate = (mask: Uint8Array, w: number, h: number, radius: number): Uint8Array => {
  const horizontal = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) {
        for (let k = Math.max(0, x - radius); k <= Math.min(w - 1, x + radius); k++) {
          horizontal[y * w + k] = 1;
        }
      }
    }
  }
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (horizontal[y * w + x]) {
        for (let k = Math.max(0, y - radius); k <= Math.min(h - 1, y + radius); k++) {
          out[k * w + x] = 1;
        }
      }
    }
  }
  return out;
};

interface Grid {
  xLines: number[]; // the columnCount + 1 vertical lines bounding the mark columns
  nameLeft: number; // left edge of the "Nom" column
  yLines: number[]; // horizontal lines: [top border, header bottom, after student 1, ...]
  ruling: Uint8Array; // 1 = pixel of a ruling line (page-sized, w wide), erased from the cells before reading
  width: number;
}

// Ruling lines of the table in an already-deskewed page, or null when this orientation has no table-like grid.
const detectGrid = (gray: Uint8ClampedArray, w: number, h: number, columnCount: number): Grid | null => {
  const mask = inkMask(gray, w, h);

  // Rows: long horizontal lines; keep the longest chain of (roughly) evenly spaced ones - the table's rows.
  const hRuns = longRuns(mask, w, h, true, Math.max(40, Math.round(w * 0.05)));
  const vRuns = longRuns(mask, w, h, false, Math.max(48, Math.round(h * 0.045)));
  const hProfile = smoothProfile(rowProfile(hRuns, w, h));
  const hMax = Math.max(...hProfile);
  const hLines = findLines(hProfile, hMax * 0.5);
  if (hLines.length < 3) {
    return null;
  }
  const gaps = hLines.slice(1).map((y, i) => y - hLines[i]);
  const pitch = median(gaps);
  let chain: number[] = [];
  let current = [hLines[0]];
  for (let i = 1; i < hLines.length; i++) {
    const gap = hLines[i] - hLines[i - 1];
    const multiple = Math.round(gap / pitch);
    // a gap of 2-3 pitches is a missed line (filled in below), anything else breaks the table
    if (multiple >= 1 && Math.abs(gap - multiple * pitch) <= pitch * 0.3) {
      current.push(hLines[i]);
    } else {
      current = [hLines[i]];
    }
    if (current.length > chain.length) {
      chain = [...current];
    }
  }
  if (chain.length < 3) {
    return null;
  }
  const first = chain[0];
  const last = chain[chain.length - 1];
  const rowCount = Math.round((last - first) / pitch);
  // Missed lines (a mark overlapping a rule, a dim edge): space the rows evenly between the outer lines.
  const yLines =
    chain.length === rowCount + 1
      ? chain
      : Array.from({ length: rowCount + 1 }, (_, j) => first + (j * (last - first)) / rowCount);

  // Columns: vertical lines within the table's height; the Note columns are the best 7 evenly spaced ones.
  const vProfile = smoothProfile(
    columnProfile(vRuns, w, h, Math.max(0, Math.round(first)), Math.min(h, Math.round(last) + 1)),
  );
  // Relative to the table height (a ruling line is ~2-3px of ink over the whole height), not to the profile's
  // maximum: a dark shadow along the photo's edge would otherwise push the threshold above every real rule.
  const vLines = findLines(vProfile, (last - first) * 0.8);
  if (vLines.length < columnCount + 1) {
    return null;
  }
  let bestStart = -1;
  let bestVariation = Infinity;
  for (let s = 0; s + columnCount < vLines.length; s++) {
    const window = vLines.slice(s, s + columnCount + 1);
    const windowGaps = window.slice(1).map((x, i) => x - window[i]);
    const mean = windowGaps.reduce((a, b) => a + b, 0) / windowGaps.length;
    const variation = Math.sqrt(windowGaps.reduce((a, g) => a + (g - mean) ** 2, 0) / windowGaps.length) / mean;
    if (variation < bestVariation) {
      bestVariation = variation;
      bestStart = s;
    }
  }
  if (bestStart < 0 || bestVariation > 0.18) {
    return null;
  }
  const xLines = vLines.slice(bestStart, bestStart + columnCount + 1);
  const noteWidth = (xLines[columnCount] - xLines[0]) / columnCount;
  const nameLeft = bestStart > 0 ? vLines[bestStart - 1] : xLines[0] - 3 * noteWidth;
  return { xLines, nameLeft, yLines, ruling: dilate(or(hRuns, vRuns), w, h, 2), width: w };
};

const otsuThreshold = (gray: Uint8ClampedArray): number => {
  const hist = new Array<number>(256).fill(0);
  gray.forEach((v) => hist[v]++);
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * hist[i];
  }
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (wB === 0) {
      continue;
    }
    const wF = total - wB;
    if (wF === 0) {
      break;
    }
    sumB += i * hist[i];
    const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
    if (between > best) {
      best = between;
      threshold = i;
    }
  }
  return threshold;
};

// Erases (in place) the connected ink blobs that are leftovers of the table's ruling lines - thin and
// wide, or touching the crop's top/bottom/side edges as a thin strip - and reports what remains:
// ink pixel count and the vertical extent of the handwriting.
const removeRuleResidue = (ink: Uint8Array, w: number, h: number): { count: number; height: number } => {
  const seen = new Uint8Array(ink.length);
  let count = 0;
  let minY = h;
  let maxY = -1;
  const stack: number[] = [];
  for (let start = 0; start < ink.length; start++) {
    if (!ink[start] || seen[start]) {
      continue;
    }
    const pixels: number[] = [];
    let x0 = w;
    let x1 = 0;
    let y0 = h;
    let y1 = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length > 0) {
      const i = stack.pop() as number;
      pixels.push(i);
      const x = i % w;
      const y = (i - x) / w;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
            continue;
          }
          const n = ny * w + nx;
          if (ink[n] && !seen[n]) {
            seen[n] = 1;
            stack.push(n);
          }
        }
      }
    }
    const bw = x1 - x0 + 1;
    const bh = y1 - y0 + 1;
    const touchesSide = x0 <= 2 || x1 >= w - 3;
    const touchesTopBottom = y0 <= 1 || y1 >= h - 2;
    const horizontalRule = bw >= w * 0.5 && bh <= h * 0.2;
    const sideStrip = touchesSide && bw <= w * 0.12;
    const edgeSliver = touchesTopBottom && bh <= h * 0.2;
    const speck = pixels.length < 12;
    if (horizontalRule || sideStrip || edgeSliver || speck) {
      pixels.forEach((i) => {
        ink[i] = 0;
      });
      continue;
    }
    count += pixels.length;
    minY = Math.min(minY, y0);
    maxY = Math.max(maxY, y1);
  }
  return { count, height: maxY < 0 ? 0 : maxY - minY + 1 };
};

// Crops one cell (between ruling lines, inset to stay clear of them), binarizes it (black ink on
// white) and upscales it so the digits are tall enough for Tesseract. Returns null for a blank cell.
const prepareCell = (
  page: HTMLCanvasElement,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  binarize = true,
  ruling?: { data: Uint8Array; width: number },
): { canvas: HTMLCanvasElement; ink: number } | null => {
  // Handwriting tends to sit on the bottom rule and spill under it, so the crop runs a little past the
  // row's bottom line; the ruling lines themselves are erased below.
  const insetX = Math.max(6, (x1 - x0) * 0.09); // vertical rules lean a little in a photo: stay clear of them
  const sx = Math.max(0, Math.round(x0 + insetX));
  const sy = Math.max(0, Math.round(y0 + 2));
  const sw = Math.min(page.width - sx, Math.round(x1 - x0 - 2 * insetX));
  const sh = Math.min(page.height - sy, Math.round(y1 - y0 + (ruling ? 0.15 * (y1 - y0) : -4)));
  if (sw < 4 || sh < 4) {
    return null;
  }
  const scale = Math.max(1, 90 / sh);
  const pad = 16;
  const cw = Math.round(sw * scale);
  const ch = Math.round(sh * scale);
  const canvas = newCanvas(cw + 2 * pad, ch + 2 * pad);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(page, sx, sy, sw, sh, pad, pad, cw, ch);

  const image = ctx.getImageData(pad, pad, cw, ch);
  const gray = new Uint8ClampedArray(cw * ch);
  let min = 255;
  let max = 0;
  for (let i = 0; i < gray.length; i++) {
    const v = Math.round(0.299 * image.data[i * 4] + 0.587 * image.data[i * 4 + 1] + 0.114 * image.data[i * 4 + 2]);
    gray[i] = v;
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  if (max - min < 45) {
    return null;
  }
  if (ruling) {
    for (let i = 0; i < gray.length; i++) {
      const px = sx + Math.min(sw - 1, Math.floor((i % cw) / scale));
      const py = sy + Math.min(sh - 1, Math.floor(Math.floor(i / cw) / scale));
      if (ruling.data[py * ruling.width + px]) {
        gray[i] = max;
      }
    }
  }
  // Otsu alone splits a blank cell's paper noise in two and calls half of it ink, so the threshold is also
  // kept well below the paper level (the median pixel - paper is the majority of any cell).
  const sorted = Uint8ClampedArray.from(gray).sort();
  const paperLevel = sorted[Math.floor(sorted.length / 2)];
  const threshold = Math.min(otsuThreshold(gray), paperLevel - 45);
  const ink = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    ink[i] = gray[i] <= threshold ? 1 : 0;
  }
  const marks = removeRuleResidue(ink, cw, ch);
  const inkRatio = marks.count / gray.length;
  // Handwriting is tall and has some mass; what is left of a ruling line after erasing is neither.
  if (inkRatio < MIN_INK_RATIO || marks.height < ch * 0.35) {
    return null;
  }
  for (let i = 0; i < gray.length; i++) {
    const out = binarize ? (ink[i] ? 0 : 255) : gray[i];
    image.data[i * 4] = out;
    image.data[i * 4 + 1] = out;
    image.data[i * 4 + 2] = out;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, pad, pad);
  return { canvas, ink: inkRatio };
};

// Shared with the review dialog so a user-corrected value goes through the exact same rule.
export const parseOcrMark = (raw: string): { status: "valid"; value: number } | { status: "invalid" | "unreadable" } => {
  const cleaned = raw.replace(/\s+/g, "").replace(/,/g, ".");
  if (!/\d/.test(cleaned)) {
    return { status: "unreadable" };
  }
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(cleaned)) {
    return { status: "invalid" };
  }
  const value = Number(cleaned);
  return value >= 0 && value <= 20 ? { status: "valid", value } : { status: "invalid" };
};

const nameTokens = (label: string): string[] =>
  normalizeText(label)
    .split(" ")
    .filter((tok) => tok.length >= 3);

// Number of the first rows' name tokens readable in this orientation - the upright one scores highest.
const scoreNames = async (
  worker: TesseractWorker,
  page: HTMLCanvasElement,
  grid: Grid,
  roster: OcrRosterStudent[],
): Promise<number> => {
  let score = 0;
  const rows = Math.min(NAME_PROBE_ROWS, roster.length, grid.yLines.length - 2);
  for (let i = 0; i < rows; i++) {
    const cell = prepareCell(page, grid.nameLeft, grid.yLines[i + 1], grid.xLines[0], grid.yLines[i + 2], false);
    if (!cell) {
      continue;
    }
    const { data } = await worker.recognize(cell.canvas, {}, { text: true });
    const found = normalizeText(data.text).split(" ");
    score += nameTokens(roster[i].label).filter((tok) => found.includes(tok)).length;
  }
  return score;
};

export const recognizeMarkSheet = async (
  file: File,
  roster: OcrRosterStudent[],
  columnCount: number,
  onProgress?: (progress: OcrProgress) => void,
): Promise<OcrCellsBySequence> => {
  onProgress?.({ phase: "loading" });
  const [{ createWorker }, page] = await Promise.all([import("tesseract.js"), loadPage(file)]);
  const worker = await createWorker("eng");
  try {
    onProgress?.({ phase: "layout" });
    const deskewed = rotateCanvas(page, detectSkew(page));
    const grayDeskewed = toGray(deskewed);

    // Try the four turns of the sheet; a turn is only a candidate if it shows a table-like grid, and the
    // best candidate is the one where the printed names can actually be read.
    let best: { canvas: HTMLCanvasElement; grid: Grid; score: number } | null = null;
    let firstCandidate: { canvas: HTMLCanvasElement; grid: Grid } | null = null;
    for (const turn of [0, 90, 270, 180]) {
      const canvas = turn === 0 ? deskewed : rotateCanvas(deskewed, turn);
      const gray = turn === 0 ? grayDeskewed : toGray(canvas);
      const grid = detectGrid(gray, canvas.width, canvas.height, columnCount);
      if (!grid || grid.yLines.length < 3) {
        continue;
      }
      firstCandidate ??= { canvas, grid };
      const score = await scoreNames(worker, canvas, grid, roster);
      if (!best || score > best.score) {
        best = { canvas, grid, score };
      }
      if (score >= NAME_PROBE_ROWS) {
        break; // names clearly readable: this is the upright turn
      }
    }
    const chosen = best && best.score > 0 ? best : firstCandidate && { ...firstCandidate, score: 0 };
    if (!chosen) {
      throw new MarkSheetOcrError("noHeaders");
    }
    const { canvas: upright, grid } = chosen;
    if (grid.yLines.length < 3) {
      throw new MarkSheetOcrError("noRows");
    }

    await worker.setParameters({
      tessedit_char_whitelist: "0123456789.,-",
      tessedit_pageseg_mode: "7" as never,
    });

    const result: OcrCellsBySequence = new Map();
    const rowCount = Math.min(roster.length, grid.yLines.length - 2);
    const total = rowCount * columnCount;
    let done = 0;
    for (let index = 0; index < rowCount; index++) {
      const y0 = grid.yLines[index + 1];
      const y1 = grid.yLines[index + 2];
      for (let col = 0; col < columnCount; col++) {
        onProgress?.({ phase: "cells", done, total });
        done++;
        const prepared = prepareCell(upright, grid.xLines[col], y0, grid.xLines[col + 1], y1, true, {
          data: grid.ruling,
          width: grid.width,
        });
        if (!prepared) {
          continue;
        }
        const { data } = await worker.recognize(prepared.canvas, {}, { text: true });
        const raw = data.text.trim();
        const parsed = parseOcrMark(raw);
        let cell: OcrCell;
        if (parsed.status === "valid" && data.confidence >= MIN_CELL_CONFIDENCE) {
          cell = { status: "valid", value: parsed.value, raw };
        } else if (parsed.status === "valid") {
          cell = { status: "unreadable", value: null, raw };
        } else {
          cell = { status: parsed.status, value: null, raw };
        }
        const seq = col + 1;
        const bySeq = result.get(seq) ?? new Map<number, OcrCell>();
        bySeq.set(roster[index].stud_id, cell);
        result.set(seq, bySeq);
      }
    }
    return result;
  } finally {
    await worker.terminate();
  }
};
