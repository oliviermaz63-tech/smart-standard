// Génère un document Word (.docx) éditable à partir d’un standard, avec une
// mise en page adaptée à la trame choisie. Le fichier produit est un vrai
// document Word (format ouvert OOXML, également lisible/modifiable avec
// LibreOffice ou OpenOffice), que le client peut ensuite adapter librement —
// contrairement au PDF généré par "Imprimer / Export PDF" qui n’est pas
// modifiable.
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
} from "docx";

const COLORS = {
  red: "FDECEC",
  redText: "B42318",
  blue: "E9F1FE",
  blueText: "1D4ED8",
  amber: "FFF6DF",
  amberText: "92400E",
  green: "E9FBEF",
  greenText: "15803D",
  headerGray: "E7EAF0",
  titleBg: "DCE1EA",
};

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
// octets exploitables par docx, en redimensionnant si besoin pour ne pas
// produire un fichier Word trop lourd.
async function loadImage(dataUrl, maxWidth = 380) {
  if (!dataUrl) return null;

  try {
    const res = await fetch(dataUrl);
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const type = imageTypeFromDataUrl(dataUrl);

    const dims = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () =>
        resolve({ w: img.naturalWidth || maxWidth, h: img.naturalHeight || Math.round(maxWidth * 0.6) });
      img.onerror = () => resolve({ w: maxWidth, h: Math.round(maxWidth * 0.6) });
      img.src = dataUrl;
    });

    let width = dims.w;
    let height = dims.h;
    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }

    return { data: bytes, width, height, type };
  } catch (error) {
    console.error("Impossible de charger une image pour l’export Word :", error);
    return null;
  }
}

async function imageParagraph(dataUrl, fallbackText) {
  const img = await loadImage(dataUrl);
  if (!img) {
    return new Paragraph({
      children: [new TextRun({ text: fallbackText || "Aucune photo", italics: true })],
      spacing: { after: 150 },
    });
  }
  return new Paragraph({
    children: [
      new ImageRun({
        type: img.type,
        data: img.data,
        transformation: { width: img.width, height: img.height },
      }),
    ],
    spacing: { after: 150 },
  });
}

function titleParagraph(text) {
  return new Paragraph({
    heading: HeadingLevel.TITLE,
    spacing: { after: 200 },
    children: [new TextRun({ text: text || "Titre du standard" })],
  });
}

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 300, after: 150 },
    children: [new TextRun({ text })],
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text })],
  });
}

function bodyText(text, fallback = "—") {
  return new Paragraph({
    children: [new TextRun({ text: text && String(text).trim() ? text : fallback })],
    spacing: { after: 120 },
  });
}

function kv(labelText, value) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${labelText} : `, bold: true }),
      new TextRun({ text: value && String(value).trim() ? String(value) : "—" }),
    ],
    spacing: { after: 80 },
  });
}

function calloutBox(title, text, bg, fg) {
  return [
    new Paragraph({
      shading: { fill: bg, type: ShadingType.CLEAR, color: "auto" },
      spacing: { before: 100 },
      children: [new TextRun({ text: title, bold: true, color: fg })],
    }),
    new Paragraph({
      shading: { fill: bg, type: ShadingType.CLEAR, color: "auto" },
      spacing: { after: 150 },
      children: [new TextRun({ text: text && text.trim() ? text : "Non renseigné", color: fg })],
    }),
  ];
}

function footerNote() {
  return new Paragraph({
    spacing: { before: 300 },
    children: [
      new TextRun({
        text: "Document généré avec Smart Standard — brouillon de standard opérationnel.",
        italics: true,
        size: 16,
        color: "666666",
      }),
    ],
  });
}

function tableCell(content, { width, header, bg, bold, colSpan, rowSpan } = {}) {
  const paragraphs = Array.isArray(content) ? content : [content];
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    columnSpan: colSpan,
    rowSpan: rowSpan,
    verticalAlign: VerticalAlign.TOP,
    shading:
      header || bg
        ? { fill: header ? COLORS.headerGray : bg, type: ShadingType.CLEAR, color: "auto" }
        : undefined,
    children: paragraphs.map((p) =>
      typeof p === "string"
        ? new Paragraph({ children: [new TextRun({ text: p || "—", bold: !!header || !!bold })] })
        : p
    ),
  });
}

function simpleTable(headerRow, rows, widths) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headerRow.map((h, i) => tableCell(h, { header: true, width: widths[i] })),
      }),
      ...rows.map(
        (r) => new TableRow({ children: r.map((c, i) => tableCell(c, { width: widths[i] })) })
      ),
    ],
  });
}

// --- Trame "classique" ------------------------------------------------

async function buildClassique(standard, steps) {
  const content = [];
  content.push(titleParagraph(standard.title));
  content.push(bodyText(`Zone : ${standard.zone || "Non renseignée"}   |   Référent : ${standard.owner || "Non renseigné"}`));

  content.push(heading1("1. Objectif"));
  content.push(bodyText(standard.objective, "Objectif non renseigné"));

  content.push(...calloutBox("Sécurité", standard.safety, COLORS.red, COLORS.redText));
  content.push(...calloutBox("Qualité", standard.quality, COLORS.blue, COLORS.blueText));
  content.push(...calloutBox("Moyens nécessaires", standard.materials, COLORS.amber, COLORS.amberText));

  content.push(heading1("2. Déroulé opératoire"));
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    content.push(heading2(`${i + 1}. ${step.title || "Étape sans titre"}`));
    content.push(bodyText(step.description, "Description non renseignée"));
    content.push(
      simpleTable(
        ["Sécurité", "Qualité", "Temps"],
        [[step.safety || "RAS", step.quality || "RAS", step.duration || "Non défini"]],
        [34, 33, 33]
      )
    );
    content.push(new Paragraph({ text: "", spacing: { after: 100 } }));

    if (step.preview) content.push(await imageParagraph(step.preview));
    if (step.okPreview) content.push(await imageParagraph(step.okPreview));
    if (step.nokPreview) content.push(await imageParagraph(step.nokPreview));
  }

  content.push(heading1("3. Critères de validation terrain"));
  content.push(bodyText(standard.control));
  content.push(footerNote());

  return content;
}

// --- Trame "instruction_travail" --------------------------------------

async function buildInstructionTravail(standard, steps) {
  const content = [];
  content.push(titleParagraph(standard.title));

  content.push(
    simpleTable(
      ["Propriétaire", "Date", "Machine / Zone", "Réf"],
      [[standard.owner || "Non renseigné", standard.date || "Non renseignée", standard.zone || "Non renseignée", standard.reference || "Non renseignée"]],
      [25, 25, 25, 25]
    )
  );
  content.push(new Paragraph({ text: "", spacing: { after: 150 } }));

  const rows = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const descParas = [
      new Paragraph({ children: [new TextRun(step.description || "Description non renseignée")] }),
    ];
    if (step.safety) {
      descParas.push(
        new Paragraph({
          spacing: { before: 60 },
          children: [
            new TextRun({ text: "✦ Sécurité : ", bold: true, color: COLORS.redText }),
            new TextRun({ text: step.safety, color: COLORS.redText }),
          ],
        })
      );
    }
    if (step.quality) {
      descParas.push(
        new Paragraph({
          spacing: { before: 60 },
          children: [
            new TextRun({ text: "♦ Qualité : ", bold: true, color: COLORS.blueText }),
            new TextRun({ text: step.quality, color: COLORS.blueText }),
          ],
        })
      );
    }

    const illustration = step.preview
      ? await imageParagraph(step.preview)
      : new Paragraph({ children: [new TextRun({ text: "—" })] });

    rows.push([
      String(i + 1),
      step.title || "Opération non renseignée",
      descParas,
      [illustration],
      step.duration || "—",
    ]);
  }

  content.push(
    simpleTable(
      ["No.", "Opération", "Description détaillée de l’opération", "Illustration", "Temps (mn)"],
      rows,
      [6, 16, 42, 22, 14]
    )
  );

  content.push(footerNote());
  return content;
}

// --- Trame "gamme_nettoyage" ------------------------------------------

async function buildGammeNettoyage(standard, steps) {
  const content = [];
  content.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: "Gamme de Nettoyage" })],
    })
  );

  content.push(
    simpleTable(
      ["Unité", "Zone", "Equipements", "Périodicité", "Date création", "Date modif.", "Resp", "Référence"],
      [
        [
          standard.unite || "—",
          standard.zone || "—",
          standard.equipements || "—",
          standard.periodicite || "—",
          standard.date || "—",
          standard.dateModif || "—",
          standard.owner || "—",
          standard.reference || "—",
        ],
      ],
      [14, 12, 13, 12, 12, 12, 12, 13]
    )
  );
  content.push(new Paragraph({ text: "", spacing: { after: 100 } }));

  const photoSteps = steps
    .map((step, i) => ({ step, num: i + 1 }))
    .filter(({ step }) => step.preview || step.preview2);

  if (photoSteps.length === 0) {
    content.push(
      new Paragraph({
        children: [new TextRun({ text: "Aucune photo repère ajoutée.", italics: true })],
        spacing: { after: 150 },
      })
    );
  } else {
    for (const { step, num } of photoSteps) {
      content.push(heading2(`Repère ${num} — ${step.title || "Élément"}`));
      if (step.preview) content.push(await imageParagraph(step.preview));
      if (step.preview2) content.push(await imageParagraph(step.preview2));
    }
  }

  content.push(...calloutBox("Sécurité", standard.safety, COLORS.red, COLORS.redText));
  content.push(...calloutBox("Qualité", standard.quality, COLORS.blue, COLORS.blueText));

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
      ["N°", "Elements", "Etat standard de propreté", "Conditions", "Outillage", "Si hors standard", "Durée"],
      rows,
      [5, 13, 25, 12, 12, 21, 12]
    )
  );

  content.push(
    new Paragraph({
      spacing: { before: 150 },
      children: [
        new TextRun({
          text: "Légende : OC = Outil Condamné · A = à l’Arrêt · M = en Marche sans produire · P = en marche et en Production",
          size: 16,
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
  content.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: standard.title || "Titre du standard" })],
    })
  );

  if (standard.sketch) {
    content.push(heading2("Croquis / Schéma"));
    content.push(await imageParagraph(standard.sketch));
  }
  if (standard.photo) {
    content.push(heading2("Photo"));
    content.push(await imageParagraph(standard.photo));
  }

  const operators = standard.operators && standard.operators.length ? standard.operators : ["Opérateur A", "Opérateur B"];
  const opWidth = Math.min(30, 6 * operators.length);
  const otherWidth = 100 - opWidth;
  const opColWidth = opWidth / operators.length;

  const header = [...operators, "Qui", "Comment", "Points clés"];
  const widths = [...operators.map(() => opColWidth), otherWidth * 0.18, otherWidth * 0.5, otherWidth * 0.32];

  // simpleTable ne gère pas le fond coloré par cellule individuellement ;
  // on construit donc ce tableau à la main pour reprendre la mise en
  // évidence EHS (jaune) / Qualité (rouge) du standard.
  const tableRows = [
    new TableRow({
      tableHeader: true,
      children: header.map((h, i) => tableCell(h, { header: true, width: widths[i] })),
    }),
    ...steps.map((step) => {
      const commentBg =
        step.category === "ehs" ? COLORS.amber : step.category === "quality" ? COLORS.red : undefined;
      const cells = [
        ...operators.map((_, i) =>
          tableCell(step.operatorFlags?.[i] ? "✓" : "", { width: opColWidth, bold: true })
        ),
        tableCell(step.title || "—", { width: otherWidth * 0.18, bold: true }),
        tableCell(step.description || "—", { width: otherWidth * 0.5, bg: commentBg }),
        tableCell(step.keyPoints || "—", { width: otherWidth * 0.32 }),
      ];
      return new TableRow({ children: cells });
    }),
  ];

  content.push(
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows })
  );

  content.push(new Paragraph({ text: "", spacing: { after: 100 } }));

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

// Point d’entrée : construit puis déclenche le téléchargement du document
// Word correspondant à la trame en cours.
export async function exportStandardToWord(trame, standard, steps) {
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

  const doc = new Document({
    sections: [{ properties: {}, children: content }],
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
