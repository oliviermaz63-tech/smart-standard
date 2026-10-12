// Génère un classeur Excel (.xlsx) éditable, avec une mise en page qui
// reprend fidèlement la structure des trames Excel d’origine (colonnes,
// bandeaux colorés, légendes) utilisées avant Smart Standard, plutôt qu’un
// simple export brut des données. Un vrai fichier Excel (OOXML), modifiable
// dans Excel/LibreOffice, avec les photos intégrées dans les cellules.
import ExcelJS from "exceljs";
import logoUrl from "../assets/smart-standard-logo.png?url";

const ARGB = {
  navy: "FF0F172A",
  white: "FFFFFFFF",
  green: "FFC6E0B4",
  gray: "FF808080",
  darkGray: "FF6E6E6E",
  lightGray: "FFF1F5F9",
  yellow: "FFFFFF00",
  red: "FFF8CBCB",
  redText: "FFB91C1C",
  blue: "FFDBEAFE",
  blueText: "FF1D4ED8",
  amber: "FFFEF3C7",
  amberText: "FF92400E",
  black: "FF000000",
};

const THIN = { style: "thin", color: { argb: "FF9CA3AF" } };
const BORDER_ALL = { top: THIN, left: THIN, bottom: THIN, right: THIN };

let logoBufferCache = null;
async function getLogoBuffer() {
  if (logoBufferCache) return logoBufferCache;
  const res = await fetch(logoUrl);
  logoBufferCache = new Uint8Array(await res.arrayBuffer());
  return logoBufferCache;
}

function imageExtFromDataUrl(dataUrl) {
  const match = /^data:image\/(jpe?g|png|gif|bmp)/i.exec(dataUrl || "");
  if (!match) return "jpeg";
  const ext = match[1].toLowerCase();
  return ext === "jpg" ? "jpeg" : ext;
}

async function loadImageBytes(dataUrl, maxWidth = 320) {
  if (!dataUrl) return null;
  try {
    const res = await fetch(dataUrl);
    const buffer = new Uint8Array(await res.arrayBuffer());
    const extension = imageExtFromDataUrl(dataUrl);

    const dims = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () =>
        resolve({
          w: img.naturalWidth || maxWidth,
          h: img.naturalHeight || Math.round(maxWidth * 0.7),
        });
      img.onerror = () => resolve({ w: maxWidth, h: Math.round(maxWidth * 0.7) });
      img.src = dataUrl;
    });

    let width = dims.w;
    let height = dims.h;
    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }
    return { buffer, extension, width, height };
  } catch (error) {
    console.error("Impossible de charger une image pour l’export Excel :", error);
    return null;
  }
}

function colLetter(index) {
  // index 0-based -> "A", "B", ... "Z", "AA"...
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function setCell(ws, addr, value, opts = {}) {
  const cell = ws.getCell(addr);
  cell.value = value === undefined || value === null || value === "" ? opts.fallback ?? "" : value;
  cell.font = {
    bold: !!opts.bold,
    italic: !!opts.italic,
    size: opts.size || 11,
    color: { argb: opts.color || ARGB.black },
    name: "Calibri",
  };
  cell.alignment = {
    horizontal: opts.align || "left",
    vertical: opts.valign || "middle",
    wrapText: opts.wrap !== false,
  };
  if (opts.fill) {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.fill } };
  }
  if (opts.border !== false) cell.border = BORDER_ALL;
  return cell;
}

function applyBorderToRange(ws, r1, c1, r2, c2) {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      ws.getCell(r, c).border = BORDER_ALL;
    }
  }
}

function mergeSet(ws, r1, c1, r2, c2, value, opts = {}) {
  ws.mergeCells(r1, c1, r2, c2);
  const addr = `${colLetter(c1 - 1)}${r1}`;
  // Root cause of the "everything overlaps" bug reported in real Microsoft
  // Excel (not reproduced by LibreOffice): a merged cell left with
  // wrapText enabled but no content makes Excel silently recompute/collapse
  // the row's explicit custom height on open (observed: a row stored as
  // ht="200" customHeight="1" was reported by Excel's own Row Height dialog
  // as 66.7pt). These empty "frame" cells (used to draw a bordered box
  // behind a floating image) never need text wrapping, so disable it by
  // default unless the caller explicitly asks for wrap.
  const finalOpts = { ...opts, border: false };
  if ((value === "" || value === null || value === undefined) && opts.wrap === undefined) {
    finalOpts.wrap = false;
  }
  const cell = setCell(ws, addr, value, finalOpts);
  if (opts.border !== false) applyBorderToRange(ws, r1, c1, r2, c2);
  return cell;
}

async function placeLogo(workbook, ws, { row = 0, col = 0, size = 56 } = {}) {
  const buffer = await getLogoBuffer();
  const imageId = workbook.addImage({ buffer, extension: "png" });
  ws.addImage(imageId, { tl: { col, row }, ext: { width: size, height: size } });
}

function footerNote(ws, row, col, spanCols) {
  mergeSet(ws, row, col, row, col + spanCols - 1, "Document généré avec Smart Standard — brouillon de standard opérationnel.", {
    italic: true,
    size: 9,
    color: "FF64748B",
    align: "left",
    border: false,
  });
}

// --- Outils communs aux trames « tableau » (gamme, instruction, mode op.) ---

// Largeur en pixels d’une colonne Excel de largeur `w` (caractères).
const colPx = (w) => Math.round((w || 8.43) * 7 + 5);

function colsPxRange(ws, c1, c2) {
  let total = 0;
  for (let c = c1; c <= c2; c++) total += colPx(ws.getColumn(c).width);
  return total;
}

// Hauteur (pt) nécessaire à un texte retourné à la ligne dans une zone de
// `widthChars` caractères de large (somme des largeurs de colonnes).
function wrapHeight(text, widthChars, size = 10, pad = 8) {
  const charsPerLine = Math.max(8, Math.floor(widthChars * 1.05 * (10 / size)));
  let lines = 0;
  String(text ?? "")
    .split("\n")
    .forEach((para) => {
      lines += Math.max(1, Math.ceil(para.length / charsPerLine));
    });
  return lines * size * 1.32 + pad;
}

function colsWidthChars(ws, c1, c2) {
  let total = 0;
  for (let c = c1; c <= c2; c++) total += ws.getColumn(c).width || 8.43;
  return total;
}

// Réglages d’impression communs : A4, marges, quadrillage masqué, pied de
// page numéroté, ligne d’en-tête du tableau répétée sur chaque page.
function polishSheet(ws, standard, { landscape = false, repeatRow } = {}) {
  ws.views = [{ showGridLines: false }];
  ws.pageSetup = {
    orientation: landscape ? "landscape" : "portrait",
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.6, header: 0.2, footer: 0.25 },
    ...(repeatRow ? { printTitlesRow: `${repeatRow}:${repeatRow}` } : {}),
  };
  ws.headerFooter = {
    oddFooter: `&L&8Smart Standard&C&8${(standard.title || "").replace(/&/g, "&&")}&R&8Page &P / &N`,
  };
}

// Place une ou plusieurs photos côte à côte, centrées dans un cadre (fusion
// de colonnes c1..c2 sur la ligne `row`), proportions conservées.
async function placePhotosInCell(workbook, ws, dataUrls, { row, c1, c2, xOffsetPx = 0, boxW, boxHpt, gap = 6 }) {
  const urls = dataUrls.filter(Boolean);
  if (!urls.length) return;
  const rowPx = boxHpt * (4 / 3);
  const totalW = boxW ?? colsPxRange(ws, c1, c2) - xOffsetPx;
  const slotW = (totalW - gap * (urls.length - 1)) / urls.length;
  const slotH = rowPx - 10;
  const imgs = [];
  for (const url of urls) {
    const img = await loadImageBytes(url, 4000);
    if (!img) continue;
    const ratio = Math.min((slotW - 8) / img.width, slotH / img.height);
    imgs.push({ img, w: Math.max(1, Math.round(img.width * ratio)), h: Math.max(1, Math.round(img.height * ratio)) });
  }
  if (!imgs.length) return;
  const usedW = imgs.reduce((a, i) => a + i.w, 0) + gap * (imgs.length - 1);
  let x = xOffsetPx + (totalW - usedW) / 2;
  for (const { img, w, h } of imgs) {
    // Convertit x (px depuis le bord gauche de c1) en (colonne + fraction).
    let col = c1 - 1;
    let remaining = x;
    while (remaining >= colPx(ws.getColumn(col + 1).width) && col < c2) {
      remaining -= colPx(ws.getColumn(col + 1).width);
      col += 1;
    }
    const imageId = workbook.addImage({ buffer: img.buffer, extension: img.extension });
    // Ancrage exact en EMU (1 px = 9525 EMU) : plus précis que les
    // fractions de colonne/ligne, identique dans Excel et LibreOffice.
    ws.addImage(imageId, {
      tl: {
        nativeCol: col,
        nativeColOff: Math.round(remaining * 9525),
        nativeRow: row - 1,
        nativeRowOff: Math.round(((rowPx - h) / 2) * 9525),
      },
      ext: { width: w, height: h },
    });
    x += w + gap;
  }
}

const HEAD_FILL = "FFE2E8F0";
const SLATE_TXT = "FF334155";

// --- Gamme de nettoyage (mirror Edilians / Mexo) -----------------------

async function buildGammeNettoyage(workbook, standard, steps) {
  const ws = workbook.addWorksheet("Gamme de nettoyage");
  polishSheet(ws, standard, { landscape: true });
  const widths = [7, 18, 16, 14, 14, 12, 12, 14, 14, 14, 9];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  const TOTAL = 11;

  ws.mergeCells(1, 1, 3, 2);
  [1, 2, 3].forEach((r) => (ws.getRow(r).height = 24));
  await placeLogo(workbook, ws, { row: 0.25, col: 0.35, size: 44 });
  applyBorderToRange(ws, 1, 1, 3, 2);

  mergeSet(ws, 1, 3, 3, 9, "Gamme de Nettoyage", { bold: true, size: 24, align: "center", color: ARGB.navy });
  mergeSet(ws, 1, 10, 3, 11, "Référence document :\n" + (standard.reference || "—"), {
    bold: true,
    size: 10,
    align: "center",
  });

  // Bandeau d’identification : libellé gris au-dessus, valeur dessous.
  const labels = [
    [1, 2, "Unité", standard.unite],
    [3, 3, "Zone", standard.zone],
    [4, 5, "Équipements", standard.equipements],
    [6, 6, "Périodicité", standard.periodicite],
    [7, 8, "Date création", standard.date],
    [9, 10, "Date modification", standard.dateModif],
    [11, 11, "Resp.", standard.owner],
  ];
  ws.getRow(4).height = 18;
  labels.forEach(([c1, c2, label, value]) => {
    mergeSet(ws, 4, c1, 4, c2, label, { bold: true, align: "center", size: 10, fill: HEAD_FILL, color: SLATE_TXT });
    mergeSet(ws, 5, c1, 5, c2, value, { fallback: "—", align: "center", size: 11, bold: true });
  });
  ws.getRow(5).height = Math.max(
    26,
    ...labels.map(([c1, c2, , value]) => wrapHeight(value || "—", colsWidthChars(ws, c1, c2), 11, 8))
  );

  // Photos repères : deux repères par bandeau (blocs colonnes 1-5 et 6-11),
  // chaque repère avec sa/ses photos côte à côte, sans déformation.
  const photoSteps = steps.map((step, i) => ({ step, num: i + 1 })).filter(({ step }) => step.preview || step.preview2);

  let r = 6;
  const blocks = [
    [1, 5],
    [6, 11],
  ];
  if (photoSteps.length === 0) {
    ws.getRow(r).height = 50;
    mergeSet(ws, r, 1, r, TOTAL, "Aucune photo repère", { italic: true, align: "center", size: 14, color: "FF94A3B8" });
    r += 1;
  } else {
    const PHOTO_H = 150;
    for (let i = 0; i < photoSteps.length; i += 2) {
      const pair = photoSteps.slice(i, i + 2);
      ws.getRow(r).height = Math.max(
        20,
        ...pair.map((it, b) =>
          wrapHeight(`Repère ${it.num} — ${it.step.title || "Élément"}`, colsWidthChars(ws, blocks[b][0], blocks[b][1]) - 2, 10, 8)
        )
      );
      ws.getRow(r + 1).height = PHOTO_H;
      for (let b = 0; b < 2; b++) {
        const [c1, c2] = blocks[b];
        const item = pair[b];
        if (!item) {
          mergeSet(ws, r, c1, r, c2, "", { border: false });
          mergeSet(ws, r + 1, c1, r + 1, c2, "", { border: false });
          continue;
        }
        mergeSet(ws, r, c1, r, c2, `Repère ${item.num} — ${item.step.title || "Élément"}`, {
          bold: true,
          size: 10,
          fill: HEAD_FILL,
          color: SLATE_TXT,
          align: "left",
          border: false,
        });
        outlineRange(ws, r, c1, r, c2);
        mergeSet(ws, r + 1, c1, r + 1, c2, "", { border: false });
        outlineRange(ws, r + 1, c1, r + 1, c2);
        await placePhotosInCell(workbook, ws, [item.step.preview, item.step.preview2], {
          row: r + 1,
          c1,
          c2,
          boxHpt: PHOTO_H,
        });
      }
      r += 2;
    }
  }

  // Sécurité / Qualité
  r += 1;
  const sqRows = [
    ["SÉCURITÉ", standard.safety, "FFFEF2F2", "FFB91C1C"],
    ["QUALITÉ", standard.quality, "FFEFF6FF", "FF1D4ED8"],
  ];
  sqRows.forEach(([label, text, bg, fg]) => {
    ws.getRow(r).height = Math.max(22, wrapHeight(text || "—", colsWidthChars(ws, 3, 11), 10, 10));
    mergeSet(ws, r, 1, r, 2, label, { bold: true, size: 10, color: fg, fill: bg, align: "center" });
    mergeSet(ws, r, 3, r, 11, text, { fallback: "—", size: 10, fill: bg, color: fg });
    r += 1;
  });
  r += 1;

  const tableHeaderRow = r;
  const tHeaders = [
    ["N°", 1],
    ["Éléments", 1],
    ["État standard de propreté", 3],
    ["Conditions", 1],
    ["Outillage", 1],
    ["Si hors standard", 3],
    ["Durée", 1],
  ];
  let c = 1;
  tHeaders.forEach(([label, span]) => {
    mergeSet(ws, tableHeaderRow, c, tableHeaderRow, c + span - 1, label, {
      bold: true,
      align: "center",
      fill: ARGB.green,
      size: 11,
    });
    c += span;
  });
  ws.getRow(tableHeaderRow).height = 24;
  r += 1;

  steps.forEach((step, i) => {
    const rr = r + i;
    ws.getRow(rr).height = Math.max(
      30,
      wrapHeight(step.description, colsWidthChars(ws, 3, 5), 10, 10),
      wrapHeight(step.outOfStandard, colsWidthChars(ws, 8, 10), 10, 10),
      wrapHeight(step.title, colsWidthChars(ws, 2, 2), 11, 10),
      wrapHeight(step.conditions, colsWidthChars(ws, 6, 6), 10, 10),
      wrapHeight(step.tooling, colsWidthChars(ws, 7, 7), 10, 10)
    );
    setCell(ws, `A${rr}`, i + 1, { align: "center", bold: true });
    setCell(ws, `B${rr}`, step.title, { fallback: "", bold: true });
    mergeSet(ws, rr, 3, rr, 5, step.description, { fallback: "", align: "left", size: 10 });
    setCell(ws, `F${rr}`, step.conditions, { fallback: "", align: "center", size: 10 });
    setCell(ws, `G${rr}`, step.tooling, { fallback: "", size: 10 });
    mergeSet(ws, rr, 8, rr, 10, step.outOfStandard, { fallback: "", size: 10 });
    setCell(ws, `K${rr}`, step.duration, { fallback: "", align: "center" });
  });
  ws.pageSetup.printTitlesRow = `${tableHeaderRow}:${tableHeaderRow}`;
  r += steps.length;

  ws.getRow(r).height = 22;
  mergeSet(
    ws,
    r,
    1,
    r,
    TOTAL,
    "Légende : OC = Outil Condamné  |  A = à l’Arrêt  |  M = en Marche sans produire  |  P = en marche et en Production",
    { size: 9, color: "FF64748B", border: true }
  );
  r += 2;
  footerNote(ws, r, 1, TOTAL);
}

// --- Instruction de travail (mirror Serge Ferrari) ----------------------

async function buildInstructionTravail(workbook, standard, steps) {
  const ws = workbook.addWorksheet("Instruction de travail");
  polishSheet(ws, standard, { landscape: true });
  const widths = [7, 22, 52, 34, 11];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  ws.getRow(1).height = 26;
  ws.getRow(2).height = 26;
  await placeLogo(workbook, ws, { row: 0.1, col: 0.1, size: 24 });
  mergeSet(
    ws,
    1,
    1,
    2,
    2,
    "\n        Propriétaire : " + (standard.owner || "—") + "\n        Date : " + (standard.date || "—"),
    { size: 10, align: "left", valign: "bottom" }
  );

  mergeSet(ws, 1, 3, 2, 3, standard.title, {
    fallback: "Titre du standard",
    bold: true,
    size: 20,
    align: "center",
    fill: ARGB.navy,
    color: ARGB.white,
  });
  mergeSet(ws, 1, 4, 1, 5, "Machine / zone de travail\n" + (standard.zone || "—"), {
    bold: true,
    size: 10,
    align: "center",
  });
  mergeSet(ws, 2, 4, 2, 5, "Réf : " + (standard.reference || "—"), { bold: true, size: 10, align: "center" });

  const headerRow = 3;
  const headers = ["N°", "Opération", "Description détaillée de l’opération", "Illustrations (photos, schémas…)", "Temps (mn)"];
  headers.forEach((h, i) =>
    setCell(ws, `${colLetter(i)}${headerRow}`, h, { bold: true, align: "center", fill: HEAD_FILL, color: SLATE_TXT, size: 10 })
  );
  ws.getRow(headerRow).height = 28;
  ws.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`;

  const r = headerRow + 1;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const rr = r + i;

    let descText = step.description || "";
    if (step.safety) descText += (descText ? "\n\n" : "") + "Sécurité : " + step.safety;
    if (step.quality) descText += (descText ? "\n\n" : "") + "Qualité : " + step.quality;

    const textH = Math.max(
      wrapHeight(descText, colsWidthChars(ws, 3, 3), 10, 12),
      wrapHeight(step.title, colsWidthChars(ws, 2, 2), 11, 12)
    );
    const hasPhoto = !!step.preview;
    ws.getRow(rr).height = Math.max(hasPhoto ? 150 : 40, textH);

    setCell(ws, `A${rr}`, i + 1, { align: "center", bold: true });
    setCell(ws, `B${rr}`, step.title, { fallback: "", bold: true });
    setCell(ws, `C${rr}`, descText, { fallback: "", align: "left", size: 10, valign: "top" });
    setCell(ws, `D${rr}`, "", { wrap: false });
    if (hasPhoto) {
      await placePhotosInCell(workbook, ws, [step.preview], { row: rr, c1: 4, c2: 4, boxHpt: ws.getRow(rr).height });
    }
    setCell(ws, `E${rr}`, step.duration, { fallback: "", align: "center" });
  }
  footerNote(ws, r + steps.length + 1, 1, 5);
}

// --- Mode opératoire (mirror Constellium SOP) ---------------------------

async function buildModeOperatoire(workbook, standard, steps) {
  const ws = workbook.addWorksheet("Mode opératoire");
  polishSheet(ws, standard, { landscape: false });

  const operators = standard.operators && standard.operators.length ? standard.operators : ["Opérateur A", "Opérateur B"];
  const opCols = operators.length;
  const totalCols = opCols + 3; // + Who, How, Key Points

  for (let i = 0; i < opCols; i++) ws.getColumn(i + 1).width = 7;
  ws.getColumn(opCols + 1).width = 24;
  ws.getColumn(opCols + 2).width = 48;
  ws.getColumn(opCols + 3).width = 30;

  ws.getRow(1).height = 28;
  mergeSet(ws, 1, 1, 1, Math.min(2, totalCols), "", { border: true });
  await placeLogo(workbook, ws, { row: 0.1, col: 0.2, size: 26 });
  mergeSet(ws, 1, 3, 1, totalCols, "STANDARD OPERATING PROCEDURE", {
    bold: true,
    align: "center",
    size: 13,
    color: ARGB.navy,
  });

  const titleText = [standard.title, standard.zone].filter(Boolean).join("  —  ");
  ws.getRow(2).height = Math.max(32, wrapHeight(titleText, colsWidthChars(ws, 1, totalCols), 16, 12));
  mergeSet(ws, 2, 1, 2, totalCols, titleText, {
    fallback: "Titre du standard",
    bold: true,
    size: 16,
    align: "center",
    fill: ARGB.navy,
    color: ARGB.white,
  });

  // Croquis | photo côte à côte, chacun centré sans déformation.
  const sketchRow = 3;
  const VISUAL_H = 230;
  ws.getRow(sketchRow).height = VISUAL_H;
  // Point de coupure qui équilibre au mieux la largeur des deux cadres.
  const totalW = colsWidthChars(ws, 1, totalCols);
  let half = 1;
  for (let c = 1; c < totalCols; c++) {
    if (Math.abs(colsWidthChars(ws, 1, c) - totalW / 2) < Math.abs(colsWidthChars(ws, 1, half) - totalW / 2)) half = c;
  }
  mergeSet(ws, sketchRow, 1, sketchRow, half, "", { border: true });
  mergeSet(ws, sketchRow, half + 1, sketchRow, totalCols, "", { border: true });
  if (standard.sketch) {
    await placePhotosInCell(workbook, ws, [standard.sketch], { row: sketchRow, c1: 1, c2: half, boxHpt: VISUAL_H });
  } else {
    setCell(ws, "A" + sketchRow, "croquis / schéma", { italic: true, align: "center", color: "FF94A3B8", border: false, size: 14 });
  }
  if (standard.photo) {
    await placePhotosInCell(workbook, ws, [standard.photo], { row: sketchRow, c1: half + 1, c2: totalCols, boxHpt: VISUAL_H });
  } else {
    setCell(ws, `${colLetter(half)}${sketchRow}`, "photo", { italic: true, align: "center", color: "FF94A3B8", border: false, size: 14 });
  }

  const headerRow = sketchRow + 1;
  const headFill = { bold: true, align: "center", fill: ARGB.darkGray, color: ARGB.white };
  operators.forEach((_, i) => setCell(ws, `${colLetter(i)}${headerRow}`, String.fromCharCode(65 + i), headFill));
  setCell(ws, `${colLetter(opCols)}${headerRow}`, "Qui", headFill);
  setCell(ws, `${colLetter(opCols + 1)}${headerRow}`, "Comment", headFill);
  setCell(ws, `${colLetter(opCols + 2)}${headerRow}`, "Points clés", headFill);
  ws.getRow(headerRow).height = 22;
  ws.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`;

  const r = headerRow + 1;
  steps.forEach((step, i) => {
    const rr = r + i;
    ws.getRow(rr).height = Math.max(
      28,
      wrapHeight(step.title, ws.getColumn(opCols + 1).width, 11, 10),
      wrapHeight(step.description, ws.getColumn(opCols + 2).width, 11, 10),
      wrapHeight(step.keyPoints, ws.getColumn(opCols + 3).width, 11, 10)
    );
    const bg = step.category === "ehs" ? ARGB.yellow : step.category === "quality" ? ARGB.red : undefined;
    for (let j = 0; j < opCols; j++) {
      const checked = step.operatorFlags?.[j];
      setCell(ws, `${colLetter(j)}${rr}`, checked ? i + 1 : "", {
        bold: true,
        align: "center",
        fill: checked ? bg : undefined,
      });
    }
    setCell(ws, `${colLetter(opCols)}${rr}`, step.title, { fallback: "", bold: true });
    setCell(ws, `${colLetter(opCols + 1)}${rr}`, step.description, { fallback: "", align: "left" });
    setCell(ws, `${colLetter(opCols + 2)}${rr}`, step.keyPoints, { fallback: "" });
  });
  let rEnd = r + steps.length;

  const other = "Autres : " + (standard.autres || "—");
  ws.getRow(rEnd).height = Math.max(22, wrapHeight(other, colsWidthChars(ws, 1, totalCols), 10, 8));
  mergeSet(ws, rEnd, 1, rEnd, totalCols, other, { size: 10, align: "left" });
  rEnd += 1;

  [
    "Rédacteur : " + (standard.owner || "—"),
    "Date : " + (standard.date || "—"),
    "Accord du responsable : " + (standard.accordResponsable || "—"),
  ].forEach((line) => {
    ws.getRow(rEnd).height = 22;
    mergeSet(ws, rEnd, 1, rEnd, totalCols, line, { size: 10 });
    rEnd += 1;
  });
  footerNote(ws, rEnd + 1, 1, totalCols);
}


// --- Standard classique (mise en page maison, cohérente avec les 3 autres)
//
// Mise en page pensée pour l’impression A4 portrait ET la lecture à l’écran :
// grille de 12 colonnes identiques (les blocs se fusionnent par multiples),
// une « carte » par étape (bandeau titre, description, sécurité / qualité,
// puis les 3 photos Terrain / OK / NOK CÔTE À CÔTE), hauteurs de lignes
// calculées d’après la longueur réelle du texte (plus aucun texte tronqué),
// photos affichées sans déformation, sauts de page placés entre deux étapes
// (jamais au milieu d’une carte) et pied de page avec numérotation.

const GRID_COLS = 12;
const GRID_COL_WIDTH = 8.7; // en « caractères » Excel
const GRID_COL_PX = Math.round(GRID_COL_WIDTH * 7 + 5);
const PHOTO_BOX_H = 170; // hauteur max d’une photo (px)
const PAGE_BUDGET_PT = 775; // hauteur utile d’une page A4 une fois la largeur ajustée

const CL = {
  navy: "FF0F172A",
  indigo: "FF4F46E5",
  slate: "FF64748B",
  light: "FFF1F5F9",
  line: "FFCBD5E1",
  redBg: "FFFEF2F2",
  redTx: "FFB91C1C",
  bluBg: "FFEFF6FF",
  bluTx: "FF1D4ED8",
  ambBg: "FFFFFBEB",
  ambTx: "FF92400E",
  grnBg: "FFECFDF5",
  grnTx: "FF047857",
  text: "FF1F2937",
};

const THIN_LINE = { style: "thin", color: { argb: CL.line } };

// Estimation de la hauteur (en points) nécessaire pour afficher un texte
// retourné à la ligne dans une zone de `cols` colonnes de la grille.
function textHeight(text, cols, size = 10, pad = 8) {
  const charsPerLine = Math.max(10, Math.floor(cols * GRID_COL_WIDTH * 1.05 * (10 / size)));
  let lines = 0;
  String(text ?? "")
    .split("\n")
    .forEach((para) => {
      lines += Math.max(1, Math.ceil(para.length / charsPerLine));
    });
  return lines * size * 1.32 + pad;
}

// Applique le cadre fin autour d’un bloc (et uniquement sur son pourtour,
// pour ne pas quadriller l’intérieur des cellules fusionnées).
function outlineRange(ws, r1, c1, r2, c2) {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      ws.getCell(r, c).border = {
        left: c === c1 ? THIN_LINE : undefined,
        right: c === c2 ? THIN_LINE : undefined,
        top: r === r1 ? THIN_LINE : undefined,
        bottom: r === r2 ? THIN_LINE : undefined,
      };
    }
  }
}

function block(ws, r, c1, c2, value, opts = {}) {
  ws.mergeCells(r, c1, r, c2);
  const cell = ws.getCell(r, c1);
  cell.value = value === undefined || value === null ? "" : value;
  cell.font = {
    name: "Calibri",
    size: opts.size || 10,
    bold: !!opts.bold,
    italic: !!opts.italic,
    color: { argb: opts.color || CL.text },
  };
  cell.alignment = {
    horizontal: opts.align || "left",
    vertical: opts.valign || "middle",
    wrapText: opts.wrap !== false,
    indent: opts.indent ?? 1,
  };
  if (opts.fill) {
    for (let c = c1; c <= c2; c++) {
      ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.fill } };
    }
  }
  if (opts.outline !== false) outlineRange(ws, r, c1, r, c2);
  return cell;
}

// Place une photo centrée dans un cadre (largeur × hauteur en px), en
// conservant ses proportions.
async function placeFittedImage(workbook, ws, dataUrl, { row, col, boxW, boxH }) {
  const img = await loadImageBytes(dataUrl, 4000);
  if (!img) return;
  const ratio = Math.min(boxW / img.width, boxH / img.height);
  const w = Math.max(1, Math.round(img.width * ratio));
  const h = Math.max(1, Math.round(img.height * ratio));
  const imageId = workbook.addImage({ buffer: img.buffer, extension: img.extension });
  ws.addImage(imageId, {
    tl: { col: col + (boxW - w) / 2 / GRID_COL_PX + 0.02, row: row + (boxH * 0.75 + 6 - h * 0.75) / 2 / (boxH * 0.75 + 6) },
    ext: { width: w, height: h },
  });
}

async function buildClassique(workbook, standard, steps) {
  const ws = workbook.addWorksheet("Standard classique", {
    views: [{ showGridLines: false }],
    pageSetup: {
      orientation: "portrait",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.6, header: 0.2, footer: 0.25 },
    },
    headerFooter: {
      oddFooter: `&L&8Smart Standard&C&8${(standard.title || "").replace(/&/g, "&&")}&R&8Page &P / &N`,
    },
  });
  for (let i = 1; i <= GRID_COLS; i++) ws.getColumn(i).width = GRID_COL_WIDTH;

  const heights = {};
  const setH = (r, h) => {
    ws.getRow(r).height = h;
    heights[r] = h;
  };
  const fillOf = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

  // --- En-tête : bandeau marine + logo + titre
  setH(1, 46);
  ws.getCell(1, 1).fill = fillOf(CL.navy);
  ws.getCell(1, 1).value = "";
  block(ws, 1, 2, GRID_COLS, standard.title || "Titre du standard", {
    size: 20,
    bold: true,
    color: "FFFFFFFF",
    fill: CL.navy,
    wrap: false,
    outline: false,
  });
  await placeLogo(workbook, ws, { row: 0.12, col: 0.2, size: 34 });

  setH(2, 22);
  block(ws, 2, 1, 8, `Zone : ${standard.zone || "—"}   |   Référent : ${standard.owner || "—"}`, {
    color: CL.slate,
    fill: CL.light,
    outline: false,
  });
  block(ws, 2, 9, GRID_COLS, `Trame : Standard classique   |   ${steps.length} étape${steps.length > 1 ? "s" : ""}`, {
    color: CL.slate,
    fill: CL.light,
    align: "right",
    outline: false,
  });
  setH(3, 10);

  const section = (r, label) => {
    setH(r, 24);
    block(ws, r, 1, GRID_COLS, label, { size: 12, bold: true, color: "FFFFFFFF", fill: CL.indigo, outline: false });
    return r + 1;
  };

  let r = section(4, "1  OBJECTIF");
  const objective = standard.objective || "Objectif non renseigné";
  setH(r, textHeight(objective, GRID_COLS, 10.5, 12));
  block(ws, r, 1, GRID_COLS, objective, { size: 10.5 });
  r += 1;

  const infoRow = (label, text, bg, tx) => {
    const value = text && String(text).trim() ? text : "—";
    setH(r, Math.max(22, textHeight(value, GRID_COLS - 3, 10, 10)));
    block(ws, r, 1, 3, label, { bold: true, color: tx, fill: bg, outline: false });
    block(ws, r, 4, GRID_COLS, value, { fill: bg, outline: false });
    outlineRange(ws, r, 1, r, GRID_COLS);
    r += 1;
  };
  infoRow("⚠  Sécurité", standard.safety, CL.redBg, CL.redTx);
  infoRow("✔  Qualité", standard.quality, CL.bluBg, CL.bluTx);
  infoRow("Moyens nécessaires", standard.materials, CL.ambBg, CL.ambTx);
  setH(r, 10);
  r += 1;

  r = section(r, "2  DÉROULÉ OPÉRATOIRE");
  setH(r, 6);
  r += 1;

  // --- Une « carte » par étape
  const blocks = [];
  const BLOCK_COLS = GRID_COLS / 3;
  const photoRowH = PHOTO_BOX_H * 0.75 + 6;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const start = r;

    // Bandeau : numéro + titre + durée
    const title = step.title || "Étape sans titre";
    setH(r, Math.max(28, textHeight(title, 9, 11, 10)));
    block(ws, r, 1, 1, i + 1, { size: 14, bold: true, color: "FFFFFFFF", fill: CL.navy, align: "center", indent: 0, outline: false });
    block(ws, r, 2, 10, title, { size: 11, bold: true, color: CL.navy, fill: CL.light, outline: false });
    const hasDuration = step.duration && String(step.duration).trim() && step.duration !== "—";
    block(ws, r, 11, GRID_COLS, hasDuration ? `Durée : ${step.duration}` : "", {
      color: CL.slate,
      fill: CL.light,
      align: "right",
      outline: false,
    });
    outlineRange(ws, r, 1, r, GRID_COLS);
    r += 1;

    // Description
    const desc = step.description || "Description non renseignée";
    setH(r, textHeight(desc, GRID_COLS, 10, 12));
    block(ws, r, 1, GRID_COLS, desc);
    r += 1;

    // Sécurité | Qualité
    const safety = step.safety || "RAS";
    const quality = step.quality || "RAS";
    setH(r, Math.max(22, textHeight(safety, 6, 10, 6), textHeight(quality, 6, 10, 6)));
    block(ws, r, 1, 6, `Sécurité : ${safety}`, { color: CL.redTx, fill: CL.redBg, valign: "top" });
    block(ws, r, 7, GRID_COLS, `Qualité : ${quality}`, { color: CL.bluTx, fill: CL.bluBg, valign: "top" });
    r += 1;

    // Légendes + photos côte à côte (Terrain | OK | NOK)
    const photos = [
      ["Photo terrain", step.preview, CL.light, CL.slate],
      ["Conforme (OK)", step.okPreview, CL.grnBg, CL.grnTx],
      ["Non conforme (NOK)", step.nokPreview, CL.redBg, CL.redTx],
    ];
    if (photos.some(([, url]) => !!url)) {
      setH(r, 18);
      photos.forEach(([label, , bg, tx], k) => {
        block(ws, r, 1 + k * BLOCK_COLS, (k + 1) * BLOCK_COLS, label, {
          size: 9,
          bold: true,
          color: tx,
          fill: bg,
          align: "center",
          indent: 0,
        });
      });
      r += 1;

      setH(r, photoRowH);
      for (let k = 0; k < photos.length; k++) {
        const c1 = 1 + k * BLOCK_COLS;
        block(ws, r, c1, c1 + BLOCK_COLS - 1, "", { wrap: false });
        if (photos[k][1]) {
          await placeFittedImage(workbook, ws, photos[k][1], {
            row: r - 1,
            col: c1 - 1,
            boxW: BLOCK_COLS * GRID_COL_PX - 8,
            boxH: PHOTO_BOX_H,
          });
        }
      }
      r += 1;
    }

    let blockH = 0;
    for (let x = start; x < r; x++) blockH += heights[x] || 15;
    blocks.push({ start, height: blockH });
    setH(r, 12);
    r += 1;
  }

  r = section(r, "3  CRITÈRES DE VALIDATION TERRAIN");
  const control = standard.control && String(standard.control).trim() ? standard.control : "—";
  setH(r, textHeight(control, GRID_COLS, 10, 12));
  block(ws, r, 1, GRID_COLS, control);
  r += 1;
  setH(r, 10);
  r += 1;
  setH(r, 14);
  block(ws, r, 1, GRID_COLS, "Document généré avec Smart Standard — brouillon de standard opérationnel.", {
    italic: true,
    size: 8,
    color: CL.slate,
    outline: false,
    indent: 0,
  });

  // --- Sauts de page : jamais au milieu d’une carte d’étape
  let used = 0;
  for (let x = 1; x < (blocks[0]?.start ?? r); x++) used += heights[x] || 15;
  blocks.forEach((b) => {
    if (used + b.height > PAGE_BUDGET_PT && used > 0) {
      ws.getRow(b.start - 1).addPageBreak();
      used = 0;
    }
    used += b.height + 12;
  });
}

function fileNameFor(standard, suffix) {
  const base = (standard.title || "standard").trim() || "standard";
  const cleaned = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${cleaned || "standard"}${suffix || ""}.xlsx`;
}

export async function exportStandardToExcel(trame, standard, steps) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Smart Standard";
  workbook.created = new Date();

  if (trame === "instruction_travail") {
    await buildInstructionTravail(workbook, standard, steps);
  } else if (trame === "gamme_nettoyage") {
    await buildGammeNettoyage(workbook, standard, steps);
  } else if (trame === "mode_operatoire") {
    await buildModeOperatoire(workbook, standard, steps);
  } else {
    await buildClassique(workbook, standard, steps);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileNameFor(standard);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
