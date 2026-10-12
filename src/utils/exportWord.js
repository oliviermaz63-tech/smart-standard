// Génère un document Word (.docx) éditable à partir d’un standard, avec une
// mise en page adaptée à la trame choisie. Le fichier produit est un vrai
// document Word (format ouvert OOXML, également lisible/modifiable avec
// LibreOffice ou OpenOffice), que le client peut ensuite adapter librement —
// contrairement au PDF généré par "Imprimer / Export PDF" qui n’est pas
// modifiable.
//
// Mise en page : A4, marges 1,5 cm, police Calibri, tableaux bordés à largeur
// fixe (rendu identique dans Word et LibreOffice), "cartes" d’étapes qui ne
// se coupent pas entre deux pages, photos côte à côte à proportions
// conservées, en-tête avec logo et pied de page numéroté.
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  ImageRun,
  HeadingLevel,
  VerticalAlign,
  AlignmentType,
  BorderStyle,
  TableLayoutType,
  Header,
  Footer,
  PageNumber,
  TabStopType,
} from "docx";
import logoUrl from "../assets/smart-standard-logo.png?url";

const COLORS = {
  navy: "0F172A",
  indigo: "4F46E5",
  slate: "64748B",
  light: "F1F5F9",
  line: "CBD5E1",
  text: "1F2937",
  red: "FEF2F2",
  redText: "B91C1C",
  blue: "EFF6FF",
  blueText: "1D4ED8",
  amber: "FFFBEB",
  amberText: "92400E",
  green: "ECFDF5",
  greenText: "047857",
  headerGray: "E2E8F0",
};

const FONT = "Calibri";

// Dimensions de page en twips (1/1440 pouce) : A4 avec marges de 1,5 cm.
const MARGIN = 850;
const PAGE_W = 11906;
const PAGE_H = 16838;
// Largeur utile (zone de texte) selon l’orientation.
const CONTENT_W = { portrait: PAGE_W - 2 * MARGIN, landscape: PAGE_H - 2 * MARGIN };

// Largeur utile du document en cours de construction (définie par
// exportStandardToWord avant d’appeler le builder de la trame).
let contentWidth = CONTENT_W.portrait;

// 1 px (96 dpi, unité attendue par ImageRun) = 15 twips.
const pxOf = (twips) => Math.floor(twips / 15);

const BORDER = { style: BorderStyle.SINGLE, size: 4, color: COLORS.line };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };

let logoBytesCache = null;
async function getLogoBytes() {
  if (logoBytesCache) return logoBytesCache;
  try {
    const res = await fetch(logoUrl);
    logoBytesCache = new Uint8Array(await res.arrayBuffer());
  } catch (error) {
    console.error("Logo indisponible pour l’export Word :", error);
    logoBytesCache = null;
  }
  return logoBytesCache;
}

// docx exige de préciser explicitement le type d’image (il ne le déduit pas
// du contenu binaire) : on le lit dans l’en-tête du dataURL, avec un repli
// sur "jpg" (format dans lequel compressImage() ré-encode toutes les photos).
function imageTypeFromDataUrl(dataUrl) {
  const match = /^data:image\/(jpe?g|png|gif|bmp)/i.exec(dataUrl || "");
  if (!match) return "jpg";
  const ext = match[1].toLowerCase();
  return ext === "jpeg" ? "jpg" : ext;
}

// Convertit une image (dataURL base64 déjà stockée dans le standard) en
// octets exploitables par docx, redimensionnée pour tenir dans une boîte
// (maxW x maxH, en pixels) en conservant ses proportions — une photo
// portrait ne prend donc plus toute la page.
async function loadImage(dataUrl, maxW = 380, maxH = 280) {
  if (!dataUrl) return null;

  try {
    const res = await fetch(dataUrl);
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const type = imageTypeFromDataUrl(dataUrl);

    const dims = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () =>
        resolve({ w: img.naturalWidth || maxW, h: img.naturalHeight || Math.round(maxW * 0.6) });
      img.onerror = () => resolve({ w: maxW, h: Math.round(maxW * 0.6) });
      img.src = dataUrl;
    });

    const ratio = Math.min(maxW / dims.w, maxH / dims.h, 1);
    return {
      data: bytes,
      width: Math.max(1, Math.round(dims.w * ratio)),
      height: Math.max(1, Math.round(dims.h * ratio)),
      type,
    };
  } catch (error) {
    console.error("Impossible de charger une image pour l’export Word :", error);
    return null;
  }
}

// Paragraphe contenant une ou plusieurs photos alignées sur la même ligne.
async function imagesParagraph(dataUrls, { maxW, maxH, align = AlignmentType.CENTER, keepNext = false } = {}) {
  const runs = [];
  for (const url of dataUrls) {
    const img = await loadImage(url, maxW, maxH);
    if (!img) continue;
    if (runs.length) runs.push(new TextRun({ text: "  " }));
    runs.push(
      new ImageRun({
        type: img.type,
        data: img.data,
        transformation: { width: img.width, height: img.height },
      })
    );
  }
  if (!runs.length) return null;
  return new Paragraph({ alignment: align, keepNext, spacing: { before: 40, after: 40 }, children: runs });
}

function txt(text, opts = {}) {
  return new TextRun({ text, font: FONT, ...opts });
}

function titleParagraph(text, { center = false } = {}) {
  return new Paragraph({
    heading: HeadingLevel.TITLE,
    alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { after: 120 },
    children: [txt(text || "Titre du standard", { bold: true, size: 40, color: COLORS.navy })],
  });
}

// Bandeau de section pleine largeur (fond indigo, texte blanc).
function sectionBand(text) {
  return new Table({
    width: { size: contentWidth, type: WidthType.DXA },
    columnWidths: [contentWidth],
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: contentWidth, type: WidthType.DXA },
            borders: NO_BORDERS,
            shading: { fill: COLORS.indigo, type: ShadingType.CLEAR, color: "auto" },
            margins: { top: 60, bottom: 60, left: 140, right: 140 },
            children: [
              new Paragraph({
                keepNext: true,
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 0, after: 0 },
                children: [txt(text, { bold: true, size: 24, color: "FFFFFF" })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function spacer(after = 120) {
  return new Paragraph({ spacing: { after }, children: [txt("", { size: 4 })] });
}

function bodyText(text, fallback = "—") {
  return new Paragraph({
    children: [txt(text && String(text).trim() ? text : fallback, { size: 21, color: COLORS.text })],
    spacing: { after: 100 },
  });
}

function kv(labelText, value) {
  return new Paragraph({
    children: [
      txt(`${labelText} : `, { bold: true, size: 21 }),
      txt(value && String(value).trim() ? String(value) : "—", { size: 21 }),
    ],
    spacing: { after: 80 },
  });
}

function footerNote() {
  return new Paragraph({
    spacing: { before: 300 },
    children: [
      txt("Document généré avec Smart Standard — brouillon de standard opérationnel.", {
        italics: true,
        size: 16,
        color: COLORS.slate,
      }),
    ],
  });
}

// Cellule de tableau : largeur en pourcentage de la largeur utile (ou en
// twips via `dxa`). `content` peut être une chaîne, un Paragraph ou un
// tableau de ceux-ci.
function tableCell(content, opts = {}) {
  const {
    width,
    dxa,
    header,
    bg,
    bold,
    color,
    size = 20,
    colSpan,
    align,
    keepNext,
    valign = VerticalAlign.TOP,
    borders = BORDERS,
  } = opts;
  const paragraphs = Array.isArray(content) ? content : [content];
  const w = dxa ?? (width ? Math.round((width * contentWidth) / 100) : undefined);
  const fill = header ? COLORS.headerGray : bg;
  return new TableCell({
    width: w ? { size: w, type: WidthType.DXA } : undefined,
    columnSpan: colSpan,
    verticalAlign: valign,
    borders,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    shading: fill ? { fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
    children: paragraphs.map((p) =>
      typeof p === "string" || p == null
        ? new Paragraph({
            alignment: align,
            keepNext,
            children: [
              txt(p || "—", {
                bold: !!header || !!bold,
                size,
                color: color || COLORS.text,
              }),
            ],
          })
        : p
    ),
  });
}

function simpleTable(headerRow, rows, widths) {
  const dxaWidths = widths.map((w) => Math.round((w * contentWidth) / 100));
  const total = dxaWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: dxaWidths,
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: headerRow.map((h, i) => tableCell(h, { header: true, dxa: dxaWidths[i], size: 19 })),
      }),
      ...rows.map(
        (r) =>
          new TableRow({
            cantSplit: true,
            children: r.map((c, i) => tableCell(c, { dxa: dxaWidths[i] })),
          })
      ),
    ],
  });
}

// Tableau d’information (libellé gris au-dessus, valeur en dessous).
function infoTable(pairs) {
  const n = pairs.length;
  const w = Math.floor(contentWidth / n);
  const widths = pairs.map(() => w);
  return new Table({
    width: { size: w * n, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        cantSplit: true,
        children: pairs.map(([label]) =>
          tableCell(label, { dxa: w, bg: COLORS.light, bold: true, size: 17, color: COLORS.slate })
        ),
      }),
      new TableRow({
        cantSplit: true,
        children: pairs.map(([, value]) =>
          tableCell(value && String(value).trim() ? String(value) : "—", { dxa: w, bold: true, size: 20 })
        ),
      }),
    ],
  });
}

// Bloc d’information coloré à deux colonnes : libellé | texte.
function calloutRows(items) {
  const labelW = Math.round(contentWidth * 0.2);
  const valW = contentWidth - labelW;
  return new Table({
    width: { size: contentWidth, type: WidthType.DXA },
    columnWidths: [labelW, valW],
    layout: TableLayoutType.FIXED,
    rows: items.map(
      ({ label, text, bg, fg }) =>
        new TableRow({
          cantSplit: true,
          children: [
            tableCell(label, { dxa: labelW, bg, color: fg, bold: true, size: 20, valign: VerticalAlign.CENTER }),
            tableCell(text && String(text).trim() ? text : "Non renseigné", { dxa: valW, bg }),
          ],
        })
    ),
  });
}

// --- Trame "classique" ------------------------------------------------

// "Carte" d’une étape : bandeau titre, description, sécurité | qualité, puis
// les trois photos côte à côte (terrain / OK / NOK). Les lignes ne se
// coupent pas et restent liées entre elles (keepNext) pour que la carte
// reste d’un seul tenant sur une page quand c’est possible.
async function stepCard(step, index) {
  // Grille de 6 colonnes : titre/description sur 6, sécurité | qualité sur
  // 3+3, photos sur 2+2+2.
  const sixth = Math.floor(contentWidth / 6);
  const grid = [sixth, sixth, sixth, sixth, sixth, contentWidth - 5 * sixth];
  const colW = sixth * 2;
  const widths = [colW, colW, contentWidth - 2 * colW];
  const half = sixth * 3;
  const photoW = pxOf(colW) - 14;
  const photoH = 175;
  const hasPhotos = !!(step.preview || step.okPreview || step.nokPreview);

  const hasDuration = step.duration && !["", "—", "-"].includes(String(step.duration).trim());
  const duration = hasDuration ? `   ·   Durée : ${step.duration}` : "";

  const rows = [
    new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          columnSpan: 6,
          width: { size: contentWidth, type: WidthType.DXA },
          borders: BORDERS,
          shading: { fill: COLORS.navy, type: ShadingType.CLEAR, color: "auto" },
          margins: { top: 70, bottom: 70, left: 140, right: 140 },
          children: [
            new Paragraph({
              keepNext: true,
              children: [
                txt(`${index + 1}`, { bold: true, size: 28, color: "A5B4FC" }),
                txt(`   ${step.title || "Étape sans titre"}`, { bold: true, size: 24, color: "FFFFFF" }),
                txt(duration, { size: 19, color: "CBD5E1" }),
              ],
            }),
          ],
        }),
      ],
    }),
    new TableRow({
      cantSplit: true,
      children: [
        tableCell(step.description || "Description non renseignée", {
          colSpan: 6,
          dxa: contentWidth,
          size: 21,
          keepNext: true,
        }),
      ],
    }),
    new TableRow({
      cantSplit: true,
      children: [
        tableCell(
          [
            new Paragraph({
              keepNext: hasPhotos,
              children: [
                txt("Sécurité : ", { bold: true, size: 19, color: COLORS.redText }),
                txt(step.safety || "RAS", { size: 19, color: COLORS.redText }),
              ],
            }),
          ],
          { colSpan: 3, dxa: half, bg: COLORS.red }
        ),
        tableCell(
          [
            new Paragraph({
              keepNext: hasPhotos,
              children: [
                txt("Qualité : ", { bold: true, size: 19, color: COLORS.blueText }),
                txt(step.quality || "RAS", { size: 19, color: COLORS.blueText }),
              ],
            }),
          ],
          { colSpan: 3, dxa: contentWidth - half, bg: COLORS.blue }
        ),
      ],
    }),
  ];

  if (hasPhotos) {
    const captions = [
      ["Photo terrain", step.preview, COLORS.slate],
      ["Conforme (OK)", step.okPreview, COLORS.greenText],
      ["Non conforme (NOK)", step.nokPreview, COLORS.redText],
    ];
    rows.push(
      new TableRow({
        cantSplit: true,
        children: captions.map(([label, photo, color], i) =>
          tableCell(
            [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                keepNext: true,
                children: [txt(photo ? label : "", { bold: true, size: 17, color })],
              }),
            ],
            { colSpan: 2, dxa: widths[i], bg: COLORS.light }
          )
        ),
      })
    );
    const photoCells = [];
    for (let i = 0; i < 3; i++) {
      const photo = captions[i][1];
      const p = photo ? await imagesParagraph([photo], { maxW: photoW, maxH: photoH }) : null;
      photoCells.push(
        tableCell(p ? [p] : [new Paragraph({ children: [txt("", { size: 4 })] })], {
          colSpan: 2,
          dxa: widths[i],
          valign: VerticalAlign.CENTER,
        })
      );
    }
    rows.push(new TableRow({ cantSplit: true, children: photoCells }));
  }

  return new Table({
    width: { size: contentWidth, type: WidthType.DXA },
    columnWidths: grid,
    layout: TableLayoutType.FIXED,
    rows,
  });
}

async function buildClassique(standard, steps) {
  const content = [];
  content.push(titleParagraph(standard.title));
  content.push(
    infoTable([
      ["Zone", standard.zone],
      ["Référent", standard.owner],
      ["Nombre d’étapes", String(steps.length)],
    ])
  );
  content.push(spacer(160));

  content.push(sectionBand("1   OBJECTIF"));
  content.push(spacer(60));
  content.push(bodyText(standard.objective, "Objectif non renseigné"));
  content.push(
    calloutRows([
      { label: "Sécurité", text: standard.safety, bg: COLORS.red, fg: COLORS.redText },
      { label: "Qualité", text: standard.quality, bg: COLORS.blue, fg: COLORS.blueText },
      { label: "Moyens nécessaires", text: standard.materials, bg: COLORS.amber, fg: COLORS.amberText },
    ])
  );
  content.push(spacer(160));

  content.push(sectionBand("2   DÉROULÉ OPÉRATOIRE"));
  content.push(spacer(100));
  for (let i = 0; i < steps.length; i++) {
    content.push(await stepCard(steps[i], i));
    content.push(spacer(160));
  }

  content.push(sectionBand("3   CRITÈRES DE VALIDATION TERRAIN"));
  content.push(spacer(60));
  content.push(bodyText(standard.control));
  content.push(footerNote());

  return content;
}

// --- Trame "instruction_travail" --------------------------------------

async function buildInstructionTravail(standard, steps) {
  const content = [];
  content.push(titleParagraph(standard.title));

  content.push(
    infoTable([
      ["Propriétaire", standard.owner || "Non renseigné"],
      ["Date", standard.date || "Non renseignée"],
      ["Machine / Zone", standard.zone || "Non renseignée"],
      ["Référence", standard.reference || "Non renseignée"],
    ])
  );
  content.push(spacer(160));

  const widths = [5, 15, 40, 28, 12];
  const illW = pxOf(Math.round((widths[3] * contentWidth) / 100)) - 16;

  const rows = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const descParas = [
      new Paragraph({ children: [txt(step.description || "Description non renseignée", { size: 20 })] }),
    ];
    if (step.safety) {
      descParas.push(
        new Paragraph({
          spacing: { before: 60 },
          children: [
            txt("Sécurité : ", { bold: true, size: 19, color: COLORS.redText }),
            txt(step.safety, { size: 19, color: COLORS.redText }),
          ],
        })
      );
    }
    if (step.quality) {
      descParas.push(
        new Paragraph({
          spacing: { before: 60 },
          children: [
            txt("Qualité : ", { bold: true, size: 19, color: COLORS.blueText }),
            txt(step.quality, { size: 19, color: COLORS.blueText }),
          ],
        })
      );
    }

    const illustration = step.preview
      ? await imagesParagraph([step.preview], { maxW: illW, maxH: 150 })
      : null;

    rows.push([
      String(i + 1),
      step.title || "Opération non renseignée",
      descParas,
      illustration ? [illustration] : "—",
      step.duration || "—",
    ]);
  }

  content.push(
    simpleTable(
      ["N°", "Opération", "Description détaillée de l’opération", "Illustration", "Temps (mn)"],
      rows,
      widths
    )
  );

  content.push(footerNote());
  return content;
}

// --- Trame "gamme_nettoyage" ------------------------------------------

async function buildGammeNettoyage(standard, steps) {
  const content = [];
  content.push(titleParagraph("Gamme de Nettoyage", { center: true }));

  content.push(
    infoTable([
      ["Unité", standard.unite],
      ["Zone", standard.zone],
      ["Équipements", standard.equipements],
      ["Périodicité", standard.periodicite],
      ["Date création", standard.date],
      ["Date modif.", standard.dateModif],
      ["Responsable", standard.owner],
      ["Référence", standard.reference],
    ])
  );
  content.push(spacer(140));

  const photoSteps = steps
    .map((step, i) => ({ step, num: i + 1 }))
    .filter(({ step }) => step.preview || step.preview2);

  if (photoSteps.length === 0) {
    content.push(
      new Paragraph({
        children: [txt("Aucune photo repère ajoutée.", { italics: true, size: 20 })],
        spacing: { after: 150 },
      })
    );
  } else {
    // Repères photo : 3 par ligne, chaque repère avec sa/ses photo(s).
    const perRow = 3;
    const cellW = Math.floor(contentWidth / perRow);
    const colWidths = Array(perRow).fill(cellW);
    const trows = [];
    for (let r = 0; r < photoSteps.length; r += perRow) {
      const chunk = photoSteps.slice(r, r + perRow);
      const cells = [];
      for (let c = 0; c < perRow; c++) {
        const item = chunk[c];
        if (!item) {
          cells.push(tableCell([new Paragraph({ children: [txt("", { size: 4 })] })], { dxa: cellW, borders: NO_BORDERS }));
          continue;
        }
        const urls = [item.step.preview, item.step.preview2].filter(Boolean);
        const n = urls.length;
        const maxW = Math.floor((pxOf(cellW) - 24) / n) - (n > 1 ? 4 : 0);
        const p = await imagesParagraph(urls, { maxW, maxH: 150 });
        cells.push(
          tableCell(
            [
              new Paragraph({
                keepNext: true,
                children: [
                  txt(`Repère ${item.num}`, { bold: true, size: 19, color: COLORS.indigo }),
                  txt(` — ${item.step.title || "Élément"}`, { bold: true, size: 19 }),
                ],
              }),
              p,
            ].filter(Boolean),
            { dxa: cellW }
          )
        );
      }
      trows.push(new TableRow({ cantSplit: true, children: cells }));
    }
    content.push(
      new Table({
        width: { size: cellW * perRow, type: WidthType.DXA },
        columnWidths: colWidths,
        layout: TableLayoutType.FIXED,
        rows: trows,
      })
    );
  }
  content.push(spacer(140));

  content.push(
    calloutRows([
      { label: "Sécurité", text: standard.safety, bg: COLORS.red, fg: COLORS.redText },
      { label: "Qualité", text: standard.quality, bg: COLORS.blue, fg: COLORS.blueText },
    ])
  );
  content.push(spacer(140));

  const rows = steps.map((step, index) => [
    String(index + 1),
    step.title || "—",
    step.description || "—",
    step.conditions || "—",
    step.tooling || "—",
    step.outOfStandard || "—",
    step.duration || "—",
  ]);

  content.push(
    simpleTable(
      ["N°", "Éléments", "État standard de propreté", "Conditions", "Outillage", "Si hors standard", "Durée"],
      rows,
      [5, 14, 27, 11, 12, 21, 10]
    )
  );

  content.push(
    new Paragraph({
      spacing: { before: 150 },
      children: [
        txt("Légende : OC = Outil Condamné · A = à l’Arrêt · M = en Marche sans produire · P = en marche et en Production", {
          size: 16,
          color: COLORS.slate,
        }),
      ],
    })
  );

  content.push(footerNote());
  return content;
}

// --- Trame "mode_operatoire" -------------------------------------------

async function buildModeOperatoire(standard, steps) {
  const content = [];
  content.push(titleParagraph(standard.title, { center: true }));

  // Croquis et photo côte à côte quand les deux existent.
  const visuals = [];
  if (standard.sketch) visuals.push(["Croquis / Schéma", standard.sketch]);
  if (standard.photo) visuals.push(["Photo", standard.photo]);
  if (visuals.length) {
    const cellW = Math.floor(contentWidth / visuals.length);
    const cells = [];
    for (const [label, url] of visuals) {
      const p = await imagesParagraph([url], { maxW: pxOf(cellW) - 20, maxH: 260 });
      cells.push(
        tableCell(
          [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              keepNext: true,
              children: [txt(label, { bold: true, size: 18, color: COLORS.slate })],
            }),
            p,
          ].filter(Boolean),
          { dxa: cellW }
        )
      );
    }
    content.push(
      new Table({
        width: { size: cellW * visuals.length, type: WidthType.DXA },
        columnWidths: visuals.map(() => cellW),
        layout: TableLayoutType.FIXED,
        rows: [new TableRow({ cantSplit: true, children: cells })],
      })
    );
    content.push(spacer(140));
  }

  const operators = standard.operators && standard.operators.length ? standard.operators : ["Opérateur A", "Opérateur B"];
  const opWidth = Math.min(30, 6 * operators.length);
  const otherWidth = 100 - opWidth;
  const opColWidth = opWidth / operators.length;

  const header = [...operators, "Qui", "Comment", "Points clés"];
  const widths = [...operators.map(() => opColWidth), otherWidth * 0.18, otherWidth * 0.5, otherWidth * 0.32];
  const dxa = widths.map((w) => Math.round((w * contentWidth) / 100));
  const total = dxa.reduce((a, b) => a + b, 0);

  // On construit ce tableau à la main pour reprendre la mise en évidence
  // EHS (jaune) / Qualité (rouge) du standard.
  const tableRows = [
    new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: header.map((h, i) =>
        tableCell(h, { header: true, dxa: dxa[i], size: 19, align: i < operators.length ? AlignmentType.CENTER : undefined })
      ),
    }),
    ...steps.map((step) => {
      const commentBg =
        step.category === "ehs" ? COLORS.amber : step.category === "quality" ? COLORS.red : undefined;
      const cells = [
        ...operators.map((_, i) =>
          tableCell(step.operatorFlags?.[i] ? "✓" : "", {
            dxa: dxa[i],
            bold: true,
            align: AlignmentType.CENTER,
            color: COLORS.greenText,
          })
        ),
        tableCell(step.title || "—", { dxa: dxa[operators.length], bold: true }),
        tableCell(step.description || "—", { dxa: dxa[operators.length + 1], bg: commentBg }),
        tableCell(step.keyPoints || "—", { dxa: dxa[operators.length + 2] }),
      ];
      return new TableRow({ cantSplit: true, children: cells });
    }),
  ];

  content.push(
    new Table({
      width: { size: total, type: WidthType.DXA },
      columnWidths: dxa,
      layout: TableLayoutType.FIXED,
      rows: tableRows,
    })
  );

  content.push(spacer(120));

  if (standard.autres) {
    content.push(kv("Autres", standard.autres));
  }

  content.push(
    simpleTable(
      ["Rédacteur", "Date", "Accord du responsable"],
      [[standard.owner || "—", standard.date || "—", standard.accordResponsable || "—"]],
      [33, 20, 47]
    )
  );

  content.push(footerNote());
  return content;
}

// Nom de fichier propre (sans caractères spéciaux) basé sur le titre du
// standard, ou repli générique.
function fileNameFor(standard) {
  const base = (standard.title || "standard").trim() || "standard";
  const cleaned = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${cleaned || "standard"}.docx`;
}

// Paysage pour les trames larges (tableaux à nombreuses colonnes).
const LANDSCAPE_TRAMES = new Set(["instruction_travail", "gamme_nettoyage"]);

// Point d’entrée : construit puis déclenche le téléchargement du document
// Word correspondant à la trame en cours.
export async function exportStandardToWord(trame, standard, steps) {
  const landscape = LANDSCAPE_TRAMES.has(trame);
  contentWidth = landscape ? CONTENT_W.landscape : CONTENT_W.portrait;

  let content;
  if (trame === "instruction_travail") {
    content = await buildInstructionTravail(standard, steps);
  } else if (trame === "gamme_nettoyage") {
    content = await buildGammeNettoyage(standard, steps);
  } else if (trame === "mode_operatoire") {
    content = await buildModeOperatoire(standard, steps);
  } else {
    content = await buildClassique(standard, steps);
  }

  const logo = await getLogoBytes();
  const docTitle = (standard.title || "Standard").trim() || "Standard";

  const header = new Header({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: contentWidth }],
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.line, space: 4 } },
        children: [
          ...(logo
            ? [new ImageRun({ type: "png", data: logo, transformation: { width: 22, height: 22 } }), txt("  ")]
            : []),
          txt("Smart Standard", { bold: true, size: 18, color: COLORS.navy }),
          txt("\t"),
          txt(docTitle, { size: 17, color: COLORS.slate }),
        ],
      }),
    ],
  });

  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          txt("Page ", { size: 16, color: COLORS.slate }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: COLORS.slate }),
          txt(" / ", { size: 16, color: COLORS.slate }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 16, color: COLORS.slate }),
        ],
      }),
    ],
  });

  const doc = new Document({
    creator: "Smart Standard",
    title: docTitle,
    styles: {
      default: { document: { run: { font: FONT, size: 21, color: COLORS.text } } },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: PAGE_W,
              height: PAGE_H,
              ...(landscape ? { orientation: "landscape" } : {}),
            },
            margin: { top: 1000, bottom: 850, left: MARGIN, right: MARGIN, header: 400, footer: 400 },
          },
        },
        headers: { default: header },
        footers: { default: footer },
        children: content,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileNameFor(standard);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
