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

async function placeImage(workbook, ws, dataUrl, { row, col, maxWidth = 300, maxHeight = 220 } = {}) {
  const img = await loadImageBytes(dataUrl, maxWidth);
  if (!img) return null;
  let { width, height } = img;
  if (height > maxHeight) {
    width = Math.round((width * maxHeight) / height);
    height = maxHeight;
  }
  const imageId = workbook.addImage({ buffer: img.buffer, extension: img.extension });
  ws.addImage(imageId, {
    tl: { col, row },
    ext: { width, height },
  });
  return { width, height };
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

// --- Gamme de nettoyage (mirror Edilians / Mexo) -----------------------

async function buildGammeNettoyage(workbook, standard, steps) {
  const ws = workbook.addWorksheet("Gamme de nettoyage", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const widths = [7, 16, 20, 12, 12, 13, 13, 12, 12, 12, 12];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  ws.mergeCells(1, 1, 3, 2);
  ws.getRow(1).height = 26;
  ws.getRow(2).height = 26;
  ws.getRow(3).height = 26;
  await placeLogo(workbook, ws, { row: 0, col: 0, size: 40 });
  applyBorderToRange(ws, 1, 1, 3, 2);

  mergeSet(ws, 1, 3, 3, 9, "Gamme de Nettoyage", { bold: true, size: 24, align: "center" });
  mergeSet(ws, 1, 10, 3, 11, "Référence document :\n" + (standard.reference || "—"), {
    bold: true,
    size: 10,
    align: "center",
  });

  const headers = ["Unité", "Zone", "Equipements", "Périodicité", "Date création", "Date modification", "Resp"];
  const values = [
    standard.unite,
    standard.zone,
    standard.equipements,
    standard.periodicite,
    standard.date,
    standard.dateModif,
    standard.owner,
  ];
  headers.forEach((h, i) => setCell(ws, `${colLetter(i)}4`, h, { bold: true, align: "center", size: 11 }));
  ws.getRow(4).height = 20;
  ws.getRow(5).height = 30;
  // "Unité" a souvent un nom de site assez long (ex : Sainte Foy l’Argentière) :
  // on fusionne ses deux premières colonnes pour lui laisser de la place,
  // comme dans le fichier Excel d’origine (A4:B4 fusionné).
  mergeSet(ws, 5, 1, 5, 2, standard.unite, { fallback: "—", align: "center", size: 11 });
  values.slice(1).forEach((v, i) => setCell(ws, `${colLetter(i + 2)}5`, v, { fallback: "—", align: "center", size: 11 }));

  // Bandeau photos repères : une photo par ligne (empilées), bien plus
  // fiable à l’affichage entre Excel / Google Sheets / LibreOffice qu’un
  // alignement côte à côte au pixel près sur une seule ligne fusionnée.
  const photoEntries = [];
  steps.forEach((step, i) => {
    if (step.preview) photoEntries.push({ dataUrl: step.preview, num: i + 1, variant: "" });
    if (step.preview2) photoEntries.push({ dataUrl: step.preview2, num: i + 1, variant: " (2)" });
  });

  let r = 6;
  if (photoEntries.length === 0) {
    ws.getRow(r).height = 60;
    mergeSet(ws, r, 1, r, 11, "photos", { italic: true, align: "center", size: 16, color: "FF94A3B8" });
    r += 1;
  } else {
    for (const entry of photoEntries) {
      const photoRow = r;
      ws.getRow(photoRow).height = 130;
      mergeSet(ws, photoRow, 1, photoRow, 2, `Repère ${entry.num}${entry.variant}`, {
        bold: true,
        align: "center",
        size: 11,
      });
      mergeSet(ws, photoRow, 3, photoRow, 11, "", { border: true });
      // eslint-disable-next-line no-await-in-loop
      await placeImage(workbook, ws, entry.dataUrl, {
        row: photoRow - 1 + 0.05,
        col: 2.05,
        maxWidth: 380,
        maxHeight: 110,
      });
      r += 1;
    }
  }
  ws.getRow(r).height = 18;
  ws.getRow(r + 1).height = 18;
  mergeSet(ws, r, 1, r + 1, 1, "⚠", { align: "center", size: 22, color: "FFDC2626" });
  setCell(ws, `B${r}`, "SECURITE", { bold: true, color: "FFDC2626", size: 10 });
  mergeSet(ws, r, 3, r, 11, standard.safety, { fallback: "—", size: 10 });
  r += 1;
  setCell(ws, `B${r}`, "QUALITE", { bold: true, color: "FF0070C0", size: 10 });
  mergeSet(ws, r, 3, r, 11, standard.quality, { fallback: "—", size: 10, bold: true, color: "FF0070C0" });
  r += 1;

  const tableHeaderRow = r;
  const tHeaders = [
    ["N°", 1],
    ["Elements", 1],
    ["Etat Standard de propreté", 3],
    ["Conditions", 1],
    ["Outillage", 1],
    ["Si hors Standard", 3],
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

  const minRows = 6;
  const rowCount = Math.max(steps.length, minRows);
  for (let i = 0; i < rowCount; i++) {
    const step = steps[i];
    const rr = r + i;
    ws.getRow(rr).height = 42;
    setCell(ws, `A${rr}`, i + 1, { align: "center" });
    if (step) {
      setCell(ws, `B${rr}`, step.title, { fallback: "" });
      mergeSet(ws, rr, 3, rr, 5, step.description, { fallback: "", align: "left", size: 10 });
      setCell(ws, `F${rr}`, step.conditions, { fallback: "", align: "center", size: 10 });
      setCell(ws, `G${rr}`, step.tooling, { fallback: "", size: 10 });
      mergeSet(ws, rr, 8, rr, 10, step.outOfStandard, { fallback: "", size: 10 });
      setCell(ws, `K${rr}`, step.duration, { fallback: "", align: "center" });
    } else {
      ["B", "C", "F", "G", "H", "K"].forEach((col) => setCell(ws, `${col}${rr}`, ""));
      mergeSet(ws, rr, 3, rr, 5, "", { border: true });
      mergeSet(ws, rr, 8, rr, 10, "", { border: true });
    }
  }
  r += rowCount;

  mergeSet(
    ws,
    r,
    1,
    r,
    11,
    "Légende: OC = Outil Condamné  I  A = à l’Arrêt  I  M = en Marche sans produire  I  P = en marche et en Production",
    { bold: true, size: 10, border: true }
  );
  r += 2;
  footerNote(ws, r, 1, 11);
}

// --- Instruction de travail (mirror Serge Ferrari) ----------------------

async function buildInstructionTravail(workbook, standard, steps) {
  const ws = workbook.addWorksheet("Instruction de travail", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const widths = [22, 20, 40, 26, 12];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  ws.getRow(1).height = 24;
  ws.getRow(2).height = 24;
  await placeLogo(workbook, ws, { row: 0.15, col: 0.08, size: 20 });
  mergeSet(
    ws,
    1,
    1,
    2,
    1,
    "        Propriétaire : " + (standard.owner || "—") + "\n        Date : " + (standard.date || "—"),
    { size: 10, align: "left" }
  );

  mergeSet(ws, 1, 2, 2, 3, standard.title, {
    fallback: "Titre du standard",
    bold: true,
    size: 20,
    align: "center",
    fill: ARGB.gray,
    color: ARGB.white,
  });
  mergeSet(ws, 1, 4, 1, 5, "Machine / zone de travail\n" + (standard.zone || "—"), {
    bold: true,
    size: 10,
    align: "center",
  });
  mergeSet(ws, 2, 4, 2, 5, "Réf : " + (standard.reference || "—"), { bold: true, size: 10, align: "center" });

  const headerRow = 3;
  const headers = ["No.", "Opération", "Description détaillée de l’opération", "Illustrations (photos, schémas…)", "Temps (en mn)"];
  headers.forEach((h, i) =>
    setCell(ws, `${colLetter(i)}${headerRow}`, h, { bold: true, align: "center", fill: ARGB.lightGray, size: 10 })
  );
  ws.getRow(headerRow).height = 30;

  let r = headerRow + 1;
  const minRows = 5;
  const rowCount = Math.max(steps.length, minRows);
  for (let i = 0; i < rowCount; i++) {
    const step = steps[i];
    const rr = r + i;
    ws.getRow(rr).height = 90;
    setCell(ws, `A${rr}`, step ? i + 1 : "", { align: "center" });
    setCell(ws, `B${rr}`, step?.title, { fallback: "" });

    let descText = step?.description || "";
    if (step?.safety) descText += (descText ? "\n\n" : "") + "+ Sécurité : " + step.safety;
    if (step?.quality) descText += (descText ? "\n\n" : "") + "♦ Qualité : " + step.quality;
    setCell(ws, `C${rr}`, descText, { fallback: "", align: "left", size: 10 });

    setCell(ws, `D${rr}`, "", { wrap: false });
    if (step?.preview) {
      await placeImage(workbook, ws, step.preview, { row: rr - 1 + 0.08, col: 3.1, maxWidth: 150, maxHeight: 85 });
    }
    setCell(ws, `E${rr}`, step?.duration, { fallback: "", align: "center" });
  }
  r += rowCount;
  r += 1;
  footerNote(ws, r, 1, 5);
}

// --- Mode opératoire (mirror Constellium SOP) ---------------------------

async function buildModeOperatoire(workbook, standard, steps) {
  const ws = workbook.addWorksheet("Mode opératoire", {
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const operators = standard.operators && standard.operators.length ? standard.operators : ["Opérateur A", "Opérateur B"];
  const opCols = operators.length;
  const totalCols = opCols + 3; // + Who, How, Key Points

  ws.getColumn(1).width = 10;
  for (let i = 1; i < opCols; i++) ws.getColumn(i + 1).width = 6;
  ws.getColumn(opCols + 1).width = 20;
  ws.getColumn(opCols + 2).width = 42;
  ws.getColumn(opCols + 3).width = 28;

  ws.getRow(1).height = 26;
  mergeSet(ws, 1, 1, 1, 2, "", { border: true });
  await placeLogo(workbook, ws, { row: 0.1, col: 0.15, size: 24 });
  mergeSet(ws, 1, 3, 1, totalCols, "STANDARD OPERATING PROCEDURE", {
    bold: true,
    align: "center",
    size: 13,
  });

  ws.getRow(2).height = 30;
  mergeSet(ws, 2, 1, 2, totalCols, [standard.title, standard.zone].filter(Boolean).join("  —  "), {
    fallback: "Titre du standard",
    bold: true,
    size: 16,
    align: "center",
  });

  const sketchRow = 3;
  ws.getRow(sketchRow).height = 220;
  const half = Math.max(2, Math.floor(totalCols / 2));
  mergeSet(ws, sketchRow, 1, sketchRow, half, "", { border: true });
  mergeSet(ws, sketchRow, half + 1, sketchRow, totalCols, "", { border: true });
  // Largeur/hauteur dispo (en px) par bloc, pour ne pas laisser une image
  // déborder sur le bloc voisin ou sur la ligne suivante (approximation
  // largeur Excel -> px : x7 ; hauteur pt -> px : x4/3).
  const colsPx = (from, to) => {
    let total = 0;
    for (let i = from; i <= to; i++) total += (ws.getColumn(i).width || 8.43) * 7;
    return total;
  };
  const rowMaxHeightPx = ws.getRow(sketchRow).height * (4 / 3) - 50;
  const leftBlockPx = colsPx(1, half) - 28;
  const rightBlockPx = colsPx(half + 1, totalCols) - 28;
  if (standard.sketch) {
    await placeImage(workbook, ws, standard.sketch, {
      row: sketchRow - 1 + 0.06,
      col: 0.1,
      maxWidth: Math.max(80, leftBlockPx),
      maxHeight: rowMaxHeightPx,
    });
  } else {
    setCell(ws, `A${sketchRow}`, "croquis / schéma", { italic: true, align: "center", color: "FF94A3B8", border: false, size: 14 });
  }
  if (standard.photo) {
    await placeImage(workbook, ws, standard.photo, {
      row: sketchRow - 1 + 0.06,
      col: half + 0.1,
      maxWidth: Math.max(80, rightBlockPx),
      maxHeight: rowMaxHeightPx,
    });
  } else {
    setCell(ws, `${colLetter(half)}${sketchRow}`, "photo", { italic: true, align: "center", color: "FF94A3B8", border: false, size: 14 });
  }

  const headerRow = sketchRow + 1;
  operators.forEach((_, i) =>
    setCell(ws, `${colLetter(i)}${headerRow}`, String.fromCharCode(65 + i), {
      bold: true,
      align: "center",
      fill: ARGB.darkGray,
      color: ARGB.white,
    })
  );
  setCell(ws, `${colLetter(opCols)}${headerRow}`, "Who", { bold: true, align: "center", fill: ARGB.darkGray, color: ARGB.white });
  setCell(ws, `${colLetter(opCols + 1)}${headerRow}`, "How", { bold: true, align: "center", fill: ARGB.darkGray, color: ARGB.white });
  setCell(ws, `${colLetter(opCols + 2)}${headerRow}`, "Key Points", { bold: true, align: "center", fill: ARGB.darkGray, color: ARGB.white });
  ws.getRow(headerRow).height = 20;

  let r = headerRow + 1;
  const minRows = 6;
  const rowCount = Math.max(steps.length, minRows);
  for (let i = 0; i < rowCount; i++) {
    const step = steps[i];
    const rr = r + i;
    ws.getRow(rr).height = 32;
    const bg = step?.category === "ehs" ? ARGB.yellow : step?.category === "quality" ? ARGB.red : undefined;
    for (let j = 0; j < opCols; j++) {
      const checked = step?.operatorFlags?.[j];
      setCell(ws, `${colLetter(j)}${rr}`, checked ? i + 1 : "", {
        bold: true,
        align: "center",
        fill: checked ? bg : undefined,
      });
    }
    setCell(ws, `${colLetter(opCols)}${rr}`, step?.title, { fallback: "" });
    setCell(ws, `${colLetter(opCols + 1)}${rr}`, step?.description, { fallback: "", align: "left" });
    setCell(ws, `${colLetter(opCols + 2)}${rr}`, step?.keyPoints, { fallback: "" });
  }
  r += rowCount;

  mergeSet(ws, r, 1, r, totalCols, "Other : " + (standard.autres || "—"), { size: 10, align: "left" });
  r += 1;

  const third = Math.max(1, Math.floor(totalCols / 3));
  mergeSet(ws, r, 1, r, third, "Writer : " + (standard.owner || "—"), { size: 10 });
  mergeSet(ws, r, third + 1, r, third * 2, "Date : " + (standard.date || "—"), { size: 10 });
  mergeSet(ws, r, third * 2 + 1, r, totalCols, "Accord du responsable : " + (standard.accordResponsable || "—"), { size: 10 });
  r += 2;
  footerNote(ws, r, 1, totalCols);
}

// --- Standard classique (mise en page maison, cohérente avec les 3 autres)

async function buildClassique(workbook, standard, steps) {
  const ws = workbook.addWorksheet("Standard classique", {
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const widths = [6, 20, 34, 20, 20, 12];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  const totalCols = widths.length;

  ws.getRow(1).height = 40;
  mergeSet(ws, 1, 1, 1, 1, "", { fill: ARGB.navy, border: true });
  await placeLogo(workbook, ws, { row: 0.08, col: 0.12, size: 34 });
  mergeSet(ws, 1, 2, 1, totalCols, standard.title, {
    fallback: "Titre du standard",
    bold: true,
    size: 18,
    color: ARGB.white,
    fill: ARGB.navy,
    align: "left",
  });

  ws.getRow(2).height = 20;
  mergeSet(ws, 2, 1, 2, totalCols, `Zone : ${standard.zone || "—"}   |   Référent : ${standard.owner || "—"}`, {
    italic: true,
    size: 10,
  });

  let r = 3;
  mergeSet(ws, r, 1, r, totalCols, "1. Objectif", { bold: true, size: 13, fill: ARGB.lightGray });
  r += 1;
  ws.getRow(r).height = 34;
  mergeSet(ws, r, 1, r, totalCols, standard.objective, { fallback: "Objectif non renseigné", size: 10 });
  r += 1;

  const boxes = [
    ["Sécurité", standard.safety, ARGB.red, ARGB.redText],
    ["Qualité", standard.quality, ARGB.blue, ARGB.blueText],
    ["Moyens nécessaires", standard.materials, ARGB.amber, ARGB.amberText],
  ];
  boxes.forEach(([label, text, fill, color]) => {
    mergeSet(ws, r, 1, r, 2, label, { bold: true, fill, color, align: "left" });
    mergeSet(ws, r, 3, r, totalCols, text, { fallback: "—", fill, color, size: 10 });
    ws.getRow(r).height = 18;
    r += 1;
  });
  r += 1;

  mergeSet(ws, r, 1, r, totalCols, "2. Déroulé opératoire", { bold: true, size: 13, fill: ARGB.lightGray });
  r += 1;

  const tHeaders = ["N°", "Étape", "Description", "Sécurité", "Qualité", "Temps"];
  tHeaders.forEach((h, i) => setCell(ws, `${colLetter(i)}${r}`, h, { bold: true, align: "center", fill: ARGB.lightGray }));
  ws.getRow(r).height = 18;
  r += 1;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const rr = r;
    ws.getRow(rr).height = 46;
    setCell(ws, `A${rr}`, i + 1, { align: "center" });
    setCell(ws, `B${rr}`, step.title, { fallback: "—", bold: true, size: 10 });
    setCell(ws, `C${rr}`, step.description, { fallback: "—", size: 10 });
    setCell(ws, `D${rr}`, step.safety, { fallback: "RAS", size: 10, color: ARGB.redText });
    setCell(ws, `E${rr}`, step.quality, { fallback: "RAS", size: 10, color: ARGB.blueText });
    setCell(ws, `F${rr}`, step.duration, { fallback: "—", align: "center", size: 10 });
    r += 1;

    const photos = [
      ["Photo terrain", step.preview],
      ["Conforme (OK)", step.okPreview],
      ["Non conforme (NOK)", step.nokPreview],
    ].filter(([, url]) => !!url);
    // Une photo par ligne (empilées), pour un rendu fiable quel que soit le
    // tableur utilisé pour ouvrir le fichier.
    for (const [label, url] of photos) {
      const photoRow = r;
      ws.getRow(photoRow).height = 105;
      mergeSet(ws, photoRow, 1, photoRow, 1, label, { bold: true, align: "center", size: 9, wrap: true });
      mergeSet(ws, photoRow, 2, photoRow, totalCols, "", { border: true });
      // eslint-disable-next-line no-await-in-loop
      await placeImage(workbook, ws, url, {
        row: photoRow - 1 + 0.05,
        col: 1.05,
        maxWidth: 340,
        maxHeight: 90,
      });
      r += 1;
    }
  }

  r += 1;
  mergeSet(ws, r, 1, r, totalCols, "3. Critères de validation terrain", { bold: true, size: 13, fill: ARGB.lightGray });
  r += 1;
  ws.getRow(r).height = 30;
  mergeSet(ws, r, 1, r, totalCols, standard.control, { fallback: "—", size: 10 });
  r += 2;
  footerNote(ws, r, 1, totalCols);
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
