import { useEffect, useState } from "react";
import { API_BASE_URL } from "../config";
import { PhotoUpload } from "../components/TerrainStandard";
import { compressImage } from "../utils/compressImage";
import { exportStandardToWord } from "../utils/exportWord";

const STORAGE_KEY = "smart-standard-editor-draft";
const LIBRARY_KEY = "smart-standard-library";

const TRAMES = {
  classique: {
    label: "Standard classique",
    description:
      "Objectif, sécurité, qualité, moyens nécessaires et déroulé opératoire détaillé avec photos Terrain / OK / NOK par étape.",
  },
  instruction_travail: {
    label: "Instruction de travail",
    description:
      "Format compact type fiche de poste : un tableau avec opération, description, une illustration et un temps par étape.",
  },
  gamme_nettoyage: {
    label: "Gamme de nettoyage",
    description:
      "Fiche de nettoyage par élément avec bandeau de photos repères numérotées, conditions machine et action si hors standard.",
  },
  mode_operatoire: {
    label: "Standard mode opératoire",
    description:
      "Croquis et photo en tête de document, puis séquence d’opérations réparties entre plusieurs opérateurs (2, 3 ou plus, paramétrable) avec points EHS et Qualité mis en évidence.",
  },
};

const emptyStandard = {
  title: "",
  zone: "",
  owner: "",
  reference: "",
  date: "",
  objective: "",
  safety: "",
  quality: "",
  materials: "",
  control: "",
  unite: "",
  equipements: "",
  periodicite: "",
  dateModif: "",
  sketch: null,
  photo: null,
  autres: "",
  accordResponsable: "",
  operators: ["Opérateur A", "Opérateur B"],
};

const emptyStep = {
  id: 1,
  title: "",
  description: "",
  safety: "",
  quality: "",
  duration: "",
  preview: null,
  preview2: null,
  okPreview: null,
  nokPreview: null,
  conditions: "",
  tooling: "",
  outOfStandard: "",
  operatorFlags: [false, false],
  category: "",
  keyPoints: "",
};

// Génère un nom d’opérateur par défaut (A, B, C, ... puis A2, B2, ... au-delà de 26).
function defaultOperatorName(index) {
  const letter = String.fromCharCode(65 + (index % 26));
  const suffix = Math.floor(index / 26);
  return `Opérateur ${letter}${suffix > 0 ? suffix + 1 : ""}`;
}

// Réduit un nom d’opérateur à un libellé court pour les colonnes étroites du
// tableau imprimé (ex : "Opérateur A" -> "A", "Opérateur A2" -> "A2",
// "Régleur" -> "Rég."). Le nom complet reste visible dans la gestion des
// opérateurs et via le title (survol) de la colonne.
function shortOperatorLabel(name, index) {
  const trimmed = (name || "").trim();
  if (!trimmed) return defaultOperatorName(index).replace("Opérateur ", "");
  const match = trimmed.match(/^Op[ée]rateur\s+(\S+)$/i);
  if (match) return match[1];
  if (trimmed.length <= 4) return trimmed;
  return trimmed.slice(0, 4) + ".";
}

// Exemples pré-remplis affichés dans la fenêtre "Voir un exemple" du choix
// de trame, pour donner un aperçu concret de chaque mise en page sans avoir
// à créer un standard. Ces données ne sont jamais sauvegardées.
const EXAMPLE_DATA = {
  classique: {
    standard: {
      ...emptyStandard,
      title: "Changement de rouleau presse",
      zone: "Atelier presse - Ligne 3",
      owner: "J. Petit",
      objective:
        "Remplacer le rouleau usé en sécurité et sans impact qualité sur la production.",
      safety: "Consignation électrique obligatoire avant toute intervention.",
      quality: "Vérifier l’alignement du nouveau rouleau au montage.",
      materials: "Clé de 17, chariot élévateur, EPI complets.",
      control:
        "Test de production sur 10 pièces sans défaut avant remise en service définitive.",
    },
    steps: [
      {
        ...emptyStep,
        id: 1,
        title: "Consigner la machine",
        description:
          "Couper l’alimentation électrique et poser le cadenas de consignation.",
        safety: "Vérifier l’absence de tension avant d’intervenir.",
        quality: "RAS",
        duration: "5 min",
      },
      {
        ...emptyStep,
        id: 2,
        title: "Démonter le rouleau usé",
        description:
          "Retirer les fixations et sortir le rouleau à l’aide du chariot élévateur.",
        safety: "Ne jamais travailler sous une charge suspendue.",
        quality: "Vérifier l’état de l’axe avant remontage.",
        duration: "15 min",
      },
      {
        ...emptyStep,
        id: 3,
        title: "Monter le rouleau neuf",
        description:
          "Positionner le rouleau neuf sur l’axe et resserrer les fixations à la clé de 17.",
        safety: "Garder les mains à l’écart des points de pincement.",
        quality: "Vérifier l’alignement avant serrage définitif.",
        duration: "20 min",
      },
      {
        ...emptyStep,
        id: 4,
        title: "Déconsigner et tester",
        description:
          "Retirer le cadenas, remettre sous tension et lancer un cycle à vide puis en production.",
        safety: "S’assurer que personne n’intervient sur la machine avant remise sous tension.",
        quality: "Contrôler les 3 premières pièces produites.",
        duration: "10 min",
      },
    ],
  },
  instruction_travail: {
    standard: {
      ...emptyStandard,
      title: "Ajustement des virolles sur le mandrin",
      zone: "END - Enduction",
      owner: "E. Morel",
      date: "20/09/2026",
      reference: "I-END-Virolles-R0",
    },
    steps: [
      {
        ...emptyStep,
        id: 1,
        title: "Ouvrir la porte",
        description: "Ouvrir la porte pour accéder au mandrin.",
        safety: "Ne pas laisser les mains entre le mandrin et la virole.",
        quality: "Vérifier que la porte est bien verrouillée après fermeture.",
        duration: "2",
      },
      {
        ...emptyStep,
        id: 2,
        title: "Ajuster la virolle",
        description: "Positionner la virolle selon le repère gravé.",
        safety: "Porter des gants anti-coupure.",
        quality: "Contrôler le jeu avec la cale de 0,5 mm.",
        duration: "4",
      },
    ],
  },
  gamme_nettoyage: {
    standard: {
      ...emptyStandard,
      unite: "Sainte Foy l’Argentière",
      zone: "SFA 36",
      equipements: "Presse",
      periodicite: "Chaque arrêt",
      date: "11/03/2026",
      owner: "Resp. atelier",
      reference: "xxxxx",
      safety: "Port des gants obligatoire.",
      quality:
        "La présence de terre est une source de pollution pouvant générer des défauts.",
    },
    steps: [
      {
        ...emptyStep,
        id: 1,
        title: "Barrettes",
        description:
          "Il ne doit pas y avoir de morceaux de terre sur les barrettes.",
        conditions: "OC",
        tooling: "Soufflette / Brosse",
        outOfStandard:
          "Retirer les morceaux de terre à la main le plus rapidement possible.",
        duration: "5 min",
      },
      {
        ...emptyStep,
        id: 2,
        title: "Autour des moules",
        description:
          "Pas de morceaux de terre susceptibles de sécher et de tomber dans le convoyeur.",
        conditions: "A",
        tooling: "Soufflette",
        outOfStandard: "Retirer et jeter dans la benne dédiée.",
        duration: "3 min",
      },
    ],
  },
  mode_operatoire: {
    standard: {
      ...emptyStandard,
      title: "Changement de bobine - Ligne Enduction",
      zone: "END - Ligne 2",
      owner: "P. Martin",
      date: "02/09/2026",
      accordResponsable: "Validé - E. Morel",
      autres: "Document conforme ISO 9001.",
      operators: ["Opérateur A", "Opérateur B", "Opérateur C"],
    },
    steps: [
      {
        ...emptyStep,
        id: 1,
        title: "Opérateur A",
        description: "Arrêter la ligne et verrouiller.",
        operatorFlags: [true, false, false],
        category: "ehs",
        keyPoints: "Attendre l’arrêt complet avant intervention.",
      },
      {
        ...emptyStep,
        id: 2,
        title: "Opérateur B",
        description: "Contrôler le diamètre de la nouvelle bobine.",
        operatorFlags: [false, true, false],
        category: "quality",
        keyPoints: "Diamètre attendu : 800 mm +/- 5 mm.",
      },
      {
        ...emptyStep,
        id: 3,
        title: "Opérateurs A + C",
        description: "Positionner et fixer la nouvelle bobine sur le mandrin à deux.",
        operatorFlags: [true, false, true],
        category: "",
        keyPoints: "Coordonner le levage pour éviter tout pincement.",
      },
    ],
  },
};

export default function Editor({ onBack }) {
  const [trame, setTrame] = useState(null);
  const [standard, setStandard] = useState(emptyStandard);
  const [steps, setSteps] = useState([emptyStep]);
  const [showPreview, setShowPreview] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [exampleModal, setExampleModal] = useState(null);
  const [exportingWord, setExportingWord] = useState(false);

  useEffect(() => {
    const savedDraft = localStorage.getItem(STORAGE_KEY);
    if (savedDraft) {
      const parsedDraft = JSON.parse(savedDraft);
      setStandard({ ...emptyStandard, ...(parsedDraft.standard || {}) });
      setSteps(parsedDraft.steps || [emptyStep]);
      // Les brouillons enregistrés avant l'ajout des trames n'ont pas ce
      // champ : on les rattache à la trame classique pour ne pas casser
      // l'expérience des standards déjà en cours de rédaction.
      setTrame(parsedDraft.trame || "classique");
    }
  }, []);

  useEffect(() => {
    if (!trame) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ trame, standard, steps })
    );
    setSavedMessage("Brouillon sauvegardé automatiquement");

    const timer = setTimeout(() => setSavedMessage(""), 1500);
    return () => clearTimeout(timer);
  }, [trame, standard, steps]);

  function chooseTrame(key) {
    setTrame(key);
  }

  function changeTrame() {
    if (
      !confirm(
        "Changer de trame réinitialise le standard en cours. Continuer ?"
      )
    ) {
      return;
    }
    setTrame(null);
    setStandard(emptyStandard);
    setSteps([emptyStep]);
    setShowPreview(false);
    setAiResult("");
    localStorage.removeItem(STORAGE_KEY);
  }

  function updateField(field, value) {
    setStandard({ ...standard, [field]: value });
  }

  function updateStep(id, field, value) {
    setSteps(
      steps.map((step) =>
        step.id === id ? { ...step, [field]: value } : step
      )
    );
  }

  function addStep() {
    setSteps([
      ...steps,
      {
        id: Date.now(),
        title: "",
        description: "",
        safety: "",
        quality: "",
        duration: "",
        preview: null,
        preview2: null,
        okPreview: null,
        nokPreview: null,
        conditions: "",
        tooling: "",
        outOfStandard: "",
        operatorFlags: Array((standard.operators || []).length).fill(false),
        category: "",
        keyPoints: "",
      },
    ]);
  }

  function addOperator() {
    const nextIndex = standard.operators.length;
    const nextOperators = [
      ...standard.operators,
      defaultOperatorName(nextIndex),
    ];
    setStandard({ ...standard, operators: nextOperators });
    setSteps(
      steps.map((step) => ({
        ...step,
        operatorFlags: [...(step.operatorFlags || []), false],
      }))
    );
  }

  function removeOperator(index) {
    if (standard.operators.length <= 1) return;
    const nextOperators = standard.operators.filter((_, i) => i !== index);
    setStandard({ ...standard, operators: nextOperators });
    setSteps(
      steps.map((step) => ({
        ...step,
        operatorFlags: (step.operatorFlags || []).filter(
          (_, i) => i !== index
        ),
      }))
    );
  }

  function renameOperator(index, name) {
    const nextOperators = standard.operators.map((op, i) =>
      i === index ? name : op
    );
    setStandard({ ...standard, operators: nextOperators });
  }

  function toggleStepOperator(id, index) {
    setSteps(
      steps.map((step) => {
        if (step.id !== id) return step;
        const flags = [...(step.operatorFlags || [])];
        flags[index] = !flags[index];
        return { ...step, operatorFlags: flags };
      })
    );
  }

  async function updateStandardPhoto(field, file) {
    if (!file) return;

    try {
      const compressed = await compressImage(file);
      setStandard((current) => ({ ...current, [field]: compressed }));
    } catch (error) {
      console.error("Erreur compression photo :", error);
      alert("Impossible de traiter cette photo, réessaie avec une autre.");
    }
  }

  function removeStandardPhoto(field) {
    setStandard((current) => ({ ...current, [field]: null }));
  }

  async function updatePhoto(id, field, file) {
    if (!file) return;

    try {
      const compressed = await compressImage(file);

      setSteps((current) =>
        current.map((step) =>
          step.id === id
            ? {
                ...step,
                [field]: compressed,
              }
            : step
        )
      );
    } catch (error) {
      console.error("Erreur compression photo :", error);
      alert("Impossible de traiter cette photo, réessaie avec une autre.");
    }
  }

  function removePhoto(id, field) {
    setSteps((current) =>
      current.map((step) =>
        step.id === id
          ? {
              ...step,
              [field]: null,
            }
          : step
      )
    );
  }

  function removeStep(id) {
    if (steps.length === 1) return;
    setSteps(steps.filter((step) => step.id !== id));
  }

  function resetDraft() {
    localStorage.removeItem(STORAGE_KEY);
    setStandard(emptyStandard);
    setSteps([emptyStep]);
    setShowPreview(false);
    setAiResult("");
  }

  function generateStandard() {
    setShowPreview(true);
  }

  function printStandard() {
    window.print();
  }

  async function exportWord() {
    setExportingWord(true);
    try {
      await exportStandardToWord(trame, standard, steps);
    } catch (error) {
      console.error("Erreur export Word :", error);
      alert("Impossible de générer le fichier Word, réessaie.");
    } finally {
      setExportingWord(false);
    }
  }

  function saveToLibrary() {
    const existingLibrary = JSON.parse(
      localStorage.getItem(LIBRARY_KEY) || "[]"
    );

    const newStandard = {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      standard,
      steps,
    };

    localStorage.setItem(
      LIBRARY_KEY,
      JSON.stringify([newStandard, ...existingLibrary])
    );

    alert("Standard sauvegardé dans la bibliothèque.");
  }

  async function improveWithAI(mode = "standard") {
    try {
      setLoadingAI(true);
      setAiResult("");

      const response = await fetch(`${API_BASE_URL}/api/improve-standard`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          standard,
          steps,
          mode,
        }),
      });

      const data = await response.json();
      setAiResult(data.result || "Aucun retour IA.");
    } catch (error) {
      console.error(error);
      setAiResult("Erreur IA serveur.");
    } finally {
      setLoadingAI(false);
    }
  }

  const requiredFields =
    trame === "instruction_travail"
      ? [
          standard.title,
          standard.zone,
          standard.owner,
          ...steps.flatMap((step) => [step.title, step.description]),
        ]
      : trame === "gamme_nettoyage"
      ? [
          standard.unite,
          standard.zone,
          standard.equipements,
          standard.owner,
          ...steps.flatMap((step) => [step.title, step.description]),
        ]
      : trame === "mode_operatoire"
      ? [
          standard.title,
          standard.owner,
          standard.date,
          ...steps.flatMap((step) => [step.title, step.description]),
        ]
      : [
          standard.title,
          standard.zone,
          standard.objective,
          standard.safety,
          standard.quality,
          standard.control,
          ...steps.flatMap((step) => [step.title, step.description]),
        ];

  const completedFields = requiredFields.filter(
    (field) => field && field.trim() !== ""
  ).length;

  const completionScore = Math.round(
    (completedFields / requiredFields.length) * 100
  );

  function renderPrintLayout(trame, standard, steps) {
    return (
      <>
            {trame === "instruction_travail" ? (
              <div
                id="standard-print"
                className="border rounded-2xl overflow-hidden print:border-none"
              >
                <table
                  className="w-full border-collapse"
                  style={{ tableLayout: "fixed" }}
                >
                  <colgroup>
                    <col style={{ width: "22%" }} />
                    <col style={{ width: "56%" }} />
                    <col style={{ width: "22%" }} />
                  </colgroup>
                  <tbody>
                    <tr>
                      <td
                        rowSpan={2}
                        className="border p-4 align-top text-sm"
                      >
                        <p>
                          <strong>Propriétaire :</strong>{" "}
                          {standard.owner || "Non renseigné"}
                        </p>
                        <p className="mt-2">
                          <strong>Date :</strong>{" "}
                          {standard.date || "Non renseignée"}
                        </p>
                      </td>
                      <td
                        rowSpan={2}
                        className="border p-6 bg-slate-200 print:bg-slate-200 text-center align-middle"
                      >
                        <h3 className="text-2xl font-black text-slate-900">
                          {standard.title || "Titre du standard"}
                        </h3>
                      </td>
                      <td className="border p-3 align-top text-sm">
                        <strong>Machine / Zone de travail</strong>
                        <br />
                        {standard.zone || "Non renseignée"}
                      </td>
                    </tr>
                    <tr>
                      <td className="border p-3 align-top text-sm">
                        <strong>Réf</strong>
                        <br />
                        {standard.reference || "Non renseignée"}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <table
                  className="w-full border-collapse text-sm"
                  style={{ tableLayout: "fixed" }}
                >
                  <colgroup>
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "40%" }} />
                    <col style={{ width: "25%" }} />
                    <col style={{ width: "15%" }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-slate-100 text-left">
                      <th className="border p-3">No.</th>
                      <th className="border p-3">Opération</th>
                      <th className="border p-3">
                        Description détaillée de l’opération
                      </th>
                      <th className="border p-3">Illustrations</th>
                      <th className="border p-3">Temps (en mn)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {steps.map((step, index) => (
                      <tr
                        key={step.id}
                        className="align-top break-inside-avoid"
                      >
                        <td className="border p-3 text-center font-black">
                          {index + 1}
                        </td>
                        <td className="border p-3 font-semibold">
                          {step.title || "Opération non renseignée"}
                        </td>
                        <td className="border p-3">
                          <p className="whitespace-pre-line">
                            {step.description || "Description non renseignée"}
                          </p>
                          {step.safety && (
                            <p className="mt-2 text-red-700">
                              <strong>✦ Sécurité :</strong> {step.safety}
                            </p>
                          )}
                          {step.quality && (
                            <p className="mt-2 text-blue-700">
                              <strong>♦ Qualité :</strong> {step.quality}
                            </p>
                          )}
                        </td>
                        <td className="border p-2 align-top">
                          {step.preview && (
                            <img
                              src={step.preview}
                              alt=""
                              className="w-full h-44 object-cover rounded-lg border"
                            />
                          )}
                        </td>
                        <td className="border p-3 text-center">
                          {step.duration || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="text-xs text-slate-500 border-t p-4">
                  Document généré avec Smart Standard — brouillon de standard
                  opérationnel.
                </div>
              </div>
            ) : trame === "gamme_nettoyage" ? (
              <div
                id="standard-print"
                className="border rounded-2xl overflow-hidden print:border-none"
              >
                <div className="bg-slate-200 print:bg-slate-200 text-center py-4 border-b">
                  <h3 className="text-2xl font-black text-slate-900">
                    Gamme de Nettoyage
                  </h3>
                </div>

                <table
                  className="w-full border-collapse text-sm"
                  style={{ tableLayout: "fixed" }}
                >
                  <colgroup>
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "12%" }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-slate-100 text-left">
                      <th className="border p-2">Unité</th>
                      <th className="border p-2">Zone</th>
                      <th className="border p-2">Equipements</th>
                      <th className="border p-2">Périodicité</th>
                      <th className="border p-2">Date de création</th>
                      <th className="border p-2">Date de modification</th>
                      <th className="border p-2">Resp</th>
                      <th className="border p-2">Référence document</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border p-2">
                        {standard.unite || "—"}
                      </td>
                      <td className="border p-2">{standard.zone || "—"}</td>
                      <td className="border p-2">
                        {standard.equipements || "—"}
                      </td>
                      <td className="border p-2">
                        {standard.periodicite || "—"}
                      </td>
                      <td className="border p-2">{standard.date || "—"}</td>
                      <td className="border p-2">
                        {standard.dateModif || "—"}
                      </td>
                      <td className="border p-2">{standard.owner || "—"}</td>
                      <td className="border p-2">
                        {standard.reference || "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="flex gap-2 p-3 border-b flex-wrap">
                  {steps.some((step) => step.preview || step.preview2) ? (
                    steps
                      .map((step, i) => ({ step, num: i + 1 }))
                      .filter(({ step }) => step.preview || step.preview2)
                      .map(({ step, num }) => (
                        <div
                          key={step.id}
                          className="relative flex-1 h-40 min-w-0 flex gap-1"
                        >
                          {step.preview && (
                            <img
                              src={step.preview}
                              alt=""
                              className="w-full h-full object-cover rounded border"
                            />
                          )}
                          {step.preview2 && (
                            <img
                              src={step.preview2}
                              alt=""
                              className="w-full h-full object-cover rounded border"
                            />
                          )}
                          <span className="absolute top-1 left-1 bg-sky-500 text-white text-xs font-bold w-6 h-6 rounded flex items-center justify-center">
                            {num}
                          </span>
                        </div>
                      ))
                  ) : (
                    <p className="text-sm text-slate-400 italic p-4">
                      Aucune photo repère ajoutée.
                    </p>
                  )}
                </div>

                <table className="w-full border-collapse text-sm">
                  <tbody>
                    <tr>
                      <td
                        rowSpan={2}
                        className="border p-3 w-12 text-center align-middle text-xl"
                      >
                        ⚠️
                      </td>
                      <td className="border p-2 font-bold text-red-700 w-32">
                        SÉCURITÉ
                      </td>
                      <td className="border p-2">
                        {standard.safety || "—"}
                      </td>
                    </tr>
                    <tr>
                      <td className="border p-2 font-bold text-blue-700">
                        QUALITÉ
                      </td>
                      <td className="border p-2">
                        {standard.quality || "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <table
                  className="w-full border-collapse text-sm"
                  style={{ tableLayout: "fixed" }}
                >
                  <colgroup>
                    <col style={{ width: "4%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "25%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "27%" }} />
                    <col style={{ width: "8%" }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-slate-100 text-left">
                      <th className="border p-2">N°</th>
                      <th className="border p-2">Elements</th>
                      <th className="border p-2">
                        Etat Standard de propreté
                      </th>
                      <th className="border p-2">Conditions</th>
                      <th className="border p-2">Outillage</th>
                      <th className="border p-2">Si hors Standard</th>
                      <th className="border p-2">Durée</th>
                    </tr>
                  </thead>
                  <tbody>
                    {steps.map((step, index) => (
                      <tr
                        key={step.id}
                        className="align-top break-inside-avoid"
                      >
                        <td className="border p-2 text-center font-black">
                          {index + 1}
                        </td>
                        <td className="border p-2 font-semibold">
                          {step.title || "—"}
                        </td>
                        <td className="border p-2">
                          <p className="whitespace-pre-line">
                            {step.description || "—"}
                          </p>
                        </td>
                        <td className="border p-2 text-center">
                          {step.conditions || "—"}
                        </td>
                        <td className="border p-2">
                          {step.tooling || "—"}
                        </td>
                        <td className="border p-2">
                          <p className="whitespace-pre-line">
                            {step.outOfStandard || "—"}
                          </p>
                        </td>
                        <td className="border p-2 text-center">
                          {step.duration || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="text-xs border-t p-3">
                  <strong>Légende :</strong> OC = Outil Condamné · A = à
                  l’Arrêt · M = en Marche sans produire · P = en marche et en
                  Production
                </div>

                <div className="text-xs text-slate-500 border-t p-4">
                  Document généré avec Smart Standard — brouillon de standard
                  opérationnel.
                </div>
              </div>
            ) : trame === "mode_operatoire" ? (
              <div
                id="standard-print"
                className="border rounded-2xl overflow-hidden print:border-none"
              >
                <div className="bg-slate-200 print:bg-slate-200 text-center py-4 border-b">
                  <h3 className="text-2xl font-black text-slate-900">
                    {standard.title || "Titre du standard"}
                  </h3>
                </div>

                <table
                  className="w-full border-collapse"
                  style={{ tableLayout: "fixed" }}
                >
                  <colgroup>
                    <col style={{ width: "50%" }} />
                    <col style={{ width: "50%" }} />
                  </colgroup>
                  <tbody>
                    <tr>
                      <td className="border p-2 align-top">
                        <p className="text-xs font-bold text-slate-500 mb-2 text-center uppercase tracking-wide">
                          Croquis / Schéma
                        </p>
                        {standard.sketch ? (
                          <img
                            src={standard.sketch}
                            alt=""
                            className="w-full h-48 object-contain"
                          />
                        ) : (
                          <p className="text-sm text-slate-400 italic text-center mt-16">
                            Aucun croquis
                          </p>
                        )}
                      </td>
                      <td className="border p-2 align-top">
                        <p className="text-xs font-bold text-slate-500 mb-2 text-center uppercase tracking-wide">
                          Photo
                        </p>
                        {standard.photo ? (
                          <img
                            src={standard.photo}
                            alt=""
                            className="w-full h-48 object-contain"
                          />
                        ) : (
                          <p className="text-sm text-slate-400 italic text-center mt-16">
                            Aucune photo
                          </p>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {(() => {
                  const operators =
                    standard.operators && standard.operators.length
                      ? standard.operators
                      : ["A", "B"];
                  const operatorsWidth = Math.min(40, 8 * operators.length);
                  const scale = (100 - operatorsWidth) / 92;
                  const operatorColWidth = operatorsWidth / operators.length;

                  return (
                    <table
                      className="w-full border-collapse text-sm"
                      style={{ tableLayout: "fixed" }}
                    >
                      <colgroup>
                        {operators.map((_, i) => (
                          <col key={i} style={{ width: `${operatorColWidth}%` }} />
                        ))}
                        <col style={{ width: `${14 * scale}%` }} />
                        <col style={{ width: `${46 * scale}%` }} />
                        <col style={{ width: `${32 * scale}%` }} />
                      </colgroup>
                      <thead>
                        <tr className="bg-slate-100 text-left">
                          {operators.map((name, i) => (
                            <th
                              key={i}
                              className="border p-1 text-center text-xs leading-tight"
                              title={name || defaultOperatorName(i)}
                            >
                              {shortOperatorLabel(name, i)}
                            </th>
                          ))}
                          <th className="border p-2">Qui</th>
                          <th className="border p-2">Comment</th>
                          <th className="border p-2">Points clés</th>
                        </tr>
                      </thead>
                      <tbody>
                        {steps.map((step) => (
                          <tr
                            key={step.id}
                            className="align-top break-inside-avoid"
                          >
                            {operators.map((_, i) => (
                              <td
                                key={i}
                                className="border p-2 text-center font-black"
                              >
                                {step.operatorFlags?.[i] ? "✓" : ""}
                              </td>
                            ))}
                            <td className="border p-2 font-semibold">
                              {step.title || "—"}
                            </td>
                            <td
                              className={`border p-2 ${
                                step.category === "ehs"
                                  ? "bg-amber-100 print:bg-amber-100"
                                  : step.category === "quality"
                                  ? "bg-red-100 print:bg-red-100"
                                  : ""
                              }`}
                            >
                              <p className="whitespace-pre-line">
                                {step.description || "—"}
                              </p>
                            </td>
                            <td className="border p-2">
                              <p className="whitespace-pre-line">
                                {step.keyPoints || "—"}
                              </p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}

                {standard.autres && (
                  <div className="border-t p-3 text-sm">
                    <strong>Autres :</strong> {standard.autres}
                  </div>
                )}

                <table className="w-full border-collapse text-sm border-t">
                  <colgroup>
                    <col style={{ width: "33%" }} />
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "47%" }} />
                  </colgroup>
                  <tbody>
                    <tr>
                      <td className="border p-2">
                        <strong>Rédacteur :</strong> {standard.owner || "—"}
                      </td>
                      <td className="border p-2">
                        <strong>Date :</strong> {standard.date || "—"}
                      </td>
                      <td className="border p-2">
                        <strong>Accord du responsable :</strong>{" "}
                        {standard.accordResponsable || "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="text-xs text-slate-500 border-t p-4">
                  Document généré avec Smart Standard — brouillon de standard
                  opérationnel.
                </div>
              </div>
            ) : (
            <div id="standard-print" className="border rounded-2xl overflow-hidden print:border-none">
              <div className="bg-slate-950 text-white p-6 print:bg-white print:text-black print:border-b">
                <p className="text-sm uppercase tracking-wide print:text-slate-600">
                  Smart Standard
                </p>

                <h3 className="text-2xl font-bold mt-1">
                  {standard.title || "Titre du standard"}
                </h3>

                <p className="text-slate-300 mt-2 print:text-slate-700">
                  Zone : {standard.zone || "Non renseignée"} | Référent :{" "}
                  {standard.owner || "Non renseigné"}
                </p>
              </div>

              <div className="p-6 grid gap-6">
                <div>
                  <h4 className="font-bold text-slate-900">1. Objectif</h4>
                  <p className="mt-2 text-slate-700 whitespace-pre-line">
                    {standard.objective || "Objectif non renseigné"}
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-4 print:grid-cols-3">
                  <div className="bg-red-50 border border-red-100 rounded-xl p-4 print:bg-white">
                    <h4 className="font-bold text-red-800">Sécurité</h4>
                    <p className="mt-2 text-red-700 whitespace-pre-line">
                      {standard.safety || "Non renseigné"}
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 print:bg-white">
                    <h4 className="font-bold text-blue-800">Qualité</h4>
                    <p className="mt-2 text-blue-700 whitespace-pre-line">
                      {standard.quality || "Non renseigné"}
                    </p>
                  </div>

                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 print:bg-white">
                    <h4 className="font-bold text-amber-800">
                      Moyens nécessaires
                    </h4>
                    <p className="mt-2 text-amber-700 whitespace-pre-line">
                      {standard.materials || "Non renseigné"}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xl font-bold text-slate-900 mb-4">
                    2. Déroulé opératoire
                  </h4>

                  <div className="space-y-4">
                    {steps.map((step, index) => (
                      <div
                        key={step.id}
                        className="border rounded-xl p-5 break-inside-avoid"
                      >
                        <h5 className="font-bold text-slate-900">
                          {index + 1}. {step.title || "Étape sans titre"}
                        </h5>

                        <p className="mt-2 text-slate-700 whitespace-pre-line">
                          {step.description || "Description non renseignée"}
                        </p>

                        <table
                          className="w-full mt-4 text-sm border-collapse"
                          style={{ tableLayout: "fixed" }}
                        >
                          <colgroup>
                            <col style={{ width: "33.33%" }} />
                            <col style={{ width: "33.33%" }} />
                            <col style={{ width: "33.34%" }} />
                          </colgroup>
                          <tbody>
                            <tr>
                              <td className="bg-red-50 print:bg-white print:border p-3 align-top">
                                <strong>Sécurité :</strong>{" "}
                                {step.safety || "RAS"}
                              </td>

                              <td className="bg-blue-50 print:bg-white print:border p-3 align-top">
                                <strong>Qualité :</strong>{" "}
                                {step.quality || "RAS"}
                              </td>

                              <td className="bg-slate-100 print:bg-white print:border p-3 align-top">
                                <strong>Temps :</strong>{" "}
                                {step.duration || "Non défini"}
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        {(step.preview || step.okPreview || step.nokPreview) && (
                          <table
                            className="w-full mt-4 border-collapse"
                            style={{ tableLayout: "fixed" }}
                          >
                            <colgroup>
                              <col style={{ width: "33.33%" }} />
                              <col style={{ width: "33.33%" }} />
                              <col style={{ width: "33.34%" }} />
                            </colgroup>
                            <tbody>
                              <tr>
                                <td className="p-1 align-top">
                                  {step.preview && (
                                    <>
                                      <p className="text-xs font-bold text-slate-500 mb-1 text-center">
                                        Terrain
                                      </p>
                                      <img
                                        src={step.preview}
                                        alt=""
                                        className="w-full h-56 object-cover rounded-lg border"
                                      />
                                    </>
                                  )}
                                </td>

                                <td className="p-1 align-top">
                                  {step.okPreview && (
                                    <>
                                      <p className="text-xs font-bold text-green-700 mb-1 text-center">
                                        OK
                                      </p>
                                      <img
                                        src={step.okPreview}
                                        alt=""
                                        className="w-full h-56 object-cover rounded-lg border"
                                      />
                                    </>
                                  )}
                                </td>

                                <td className="p-1 align-top">
                                  {step.nokPreview && (
                                    <>
                                      <p className="text-xs font-bold text-red-700 mb-1 text-center">
                                        NOK
                                      </p>
                                      <img
                                        src={step.nokPreview}
                                        alt=""
                                        className="w-full h-56 object-cover rounded-lg border"
                                      />
                                    </>
                                  )}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-green-50 border border-green-100 rounded-xl p-4 print:bg-white">
                  <h4 className="font-bold text-green-800">
                    3. Critères de validation terrain
                  </h4>

                  <p className="mt-2 text-green-700 whitespace-pre-line">
                    {standard.control || "Non renseigné"}
                  </p>
                </div>

                <div className="text-xs text-slate-500 border-t pt-4">
                  Document généré avec Smart Standard — brouillon de standard
                  opérationnel.
                </div>
              </div>
            </div>
            )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6 print:hidden">
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-xl bg-white border hover:bg-slate-50"
          >
            ← Retour
          </button>

          {savedMessage && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-2">
              {savedMessage}
            </p>
          )}
        </div>

        {!trame ? (
          <div className="print:hidden">
            <h1 className="text-4xl font-bold text-slate-900">
              Choisis une trame
            </h1>

            <p className="mt-2 text-slate-600">
              Le type de trame détermine les informations demandées et la mise
              en page du standard généré.
            </p>

            <div className="mt-8 grid sm:grid-cols-2 gap-6">
              {Object.entries(TRAMES).map(([key, info]) => (
                <button
                  key={key}
                  onClick={() => chooseTrame(key)}
                  className="text-left bg-white border-2 border-transparent hover:border-slate-950 rounded-3xl p-8 shadow-sm transition"
                >
                  <h2 className="text-xl font-bold text-slate-900">
                    {info.label}
                  </h2>
                  <p className="mt-3 text-slate-600">{info.description}</p>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setExampleModal(key);
                    }}
                    className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-900 underline hover:no-underline"
                  >
                    👁 Voir un exemple
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="print:hidden">
              <h1 className="text-4xl font-bold text-slate-900">
                Créer un nouveau standard
              </h1>

              <p className="mt-2 text-slate-600">
                Trame : <strong>{TRAMES[trame].label}</strong> — Structure
                guidée pour créer un standard simple, clair et exploitable
                terrain. Pour choisir une autre trame,{" "}
                <button
                  onClick={changeTrame}
                  className="text-slate-900 underline hover:no-underline font-medium"
                >
                  cliquez ici
                </button>
                .
              </p>

              <div className="mt-6 bg-white border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-slate-900">
                    Complétude du standard
                  </p>
                  <p className="font-bold text-slate-900">{completionScore}%</p>
                </div>

                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-950 rounded-full"
                    style={{ width: `${completionScore}%` }}
                  />
                </div>

                <p className="mt-2 text-sm text-slate-500">
                  Objectif : avoir un standard suffisamment clair pour être compris,
                  appliqué et audité sur le terrain.
                </p>
              </div>
            </div>

        <div className="mt-8 grid gap-8 print:hidden">
          <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              Informations générales
            </h2>

            <div className="grid gap-5">
              {trame !== "gamme_nettoyage" && (
                <input
                  className="border rounded-xl p-4"
                  placeholder="Titre du standard"
                  value={standard.title}
                  onChange={(e) => updateField("title", e.target.value)}
                />
              )}

              {trame === "gamme_nettoyage" && (
                <input
                  className="border rounded-xl p-4"
                  placeholder="Unité (ex : Sainte Foy l’Argentière)"
                  value={standard.unite}
                  onChange={(e) => updateField("unite", e.target.value)}
                />
              )}

              <input
                className="border rounded-xl p-4"
                placeholder={
                  trame === "instruction_travail"
                    ? "Machine / zone de travail"
                    : trame === "gamme_nettoyage"
                    ? "Zone (ex : SFA 36)"
                    : trame === "mode_operatoire"
                    ? "Lieu / ligne / poste"
                    : "Zone / poste / ligne"
                }
                value={standard.zone}
                onChange={(e) => updateField("zone", e.target.value)}
              />

              {trame === "gamme_nettoyage" && (
                <input
                  className="border rounded-xl p-4"
                  placeholder="Equipements (ex : Presse)"
                  value={standard.equipements}
                  onChange={(e) =>
                    updateField("equipements", e.target.value)
                  }
                />
              )}

              <input
                className="border rounded-xl p-4"
                placeholder={
                  trame === "instruction_travail"
                    ? "Propriétaire"
                    : trame === "gamme_nettoyage"
                    ? "Resp"
                    : trame === "mode_operatoire"
                    ? "Rédacteur"
                    : "Responsable / référent"
                }
                value={standard.owner}
                onChange={(e) => updateField("owner", e.target.value)}
              />

              {trame === "instruction_travail" && (
                <>
                  <input
                    className="border rounded-xl p-4"
                    placeholder="Date (ex : 20/09/2026)"
                    value={standard.date}
                    onChange={(e) => updateField("date", e.target.value)}
                  />

                  <input
                    className="border rounded-xl p-4"
                    placeholder="Référence document (ex : I-END-Gestion-lèves-fûts-R0)"
                    value={standard.reference}
                    onChange={(e) =>
                      updateField("reference", e.target.value)
                    }
                  />
                </>
              )}

              {trame === "gamme_nettoyage" && (
                <>
                  <input
                    className="border rounded-xl p-4"
                    placeholder="Périodicité (ex : Chaque arrêt)"
                    value={standard.periodicite}
                    onChange={(e) =>
                      updateField("periodicite", e.target.value)
                    }
                  />

                  <input
                    className="border rounded-xl p-4"
                    placeholder="Date de création"
                    value={standard.date}
                    onChange={(e) => updateField("date", e.target.value)}
                  />

                  <input
                    className="border rounded-xl p-4"
                    placeholder="Date de modification"
                    value={standard.dateModif}
                    onChange={(e) =>
                      updateField("dateModif", e.target.value)
                    }
                  />

                  <input
                    className="border rounded-xl p-4"
                    placeholder="Référence document (ex : xxxxx)"
                    value={standard.reference}
                    onChange={(e) =>
                      updateField("reference", e.target.value)
                    }
                  />

                  <textarea
                    className="border rounded-xl p-4 min-h-20"
                    placeholder="Consigne sécurité (bandeau)"
                    value={standard.safety}
                    onChange={(e) => updateField("safety", e.target.value)}
                  />

                  <textarea
                    className="border rounded-xl p-4 min-h-20"
                    placeholder="Consigne qualité (bandeau)"
                    value={standard.quality}
                    onChange={(e) => updateField("quality", e.target.value)}
                  />
                </>
              )}

              {trame === "mode_operatoire" && (
                <>
                  <input
                    className="border rounded-xl p-4"
                    placeholder="Date"
                    value={standard.date}
                    onChange={(e) => updateField("date", e.target.value)}
                  />

                  <input
                    className="border rounded-xl p-4"
                    placeholder="Accord du responsable pour implémentation"
                    value={standard.accordResponsable}
                    onChange={(e) =>
                      updateField("accordResponsable", e.target.value)
                    }
                  />

                  <textarea
                    className="border rounded-xl p-4 min-h-20"
                    placeholder="Autres (prérequis, codification, etc.)"
                    value={standard.autres}
                    onChange={(e) => updateField("autres", e.target.value)}
                  />

                  <div className="border rounded-xl p-4 bg-white sm:col-span-2">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-semibold text-slate-900">
                        Opérateurs impliqués
                      </p>
                      <button
                        type="button"
                        onClick={addOperator}
                        className="text-sm px-3 py-1.5 rounded-lg bg-slate-950 text-white hover:bg-slate-800"
                      >
                        + Ajouter un opérateur
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {standard.operators.map((name, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 border rounded-xl px-3 py-2"
                        >
                          <input
                            className="border-none outline-none text-sm w-32"
                            value={name}
                            onChange={(e) =>
                              renameOperator(index, e.target.value)
                            }
                          />
                          {standard.operators.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeOperator(index)}
                              className="text-red-600 text-sm hover:underline"
                            >
                              Supprimer
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4 mt-2">
                    <PhotoUpload
                      title="Croquis / Schéma"
                      preview={standard.sketch}
                      onChange={(file) =>
                        updateStandardPhoto("sketch", file)
                      }
                      onRemove={() => removeStandardPhoto("sketch")}
                    />

                    <PhotoUpload
                      title="Photo"
                      preview={standard.photo}
                      onChange={(file) => updateStandardPhoto("photo", file)}
                      onRemove={() => removeStandardPhoto("photo")}
                    />
                  </div>
                </>
              )}

              {trame === "classique" && (
                <>
                  <textarea
                    className="border rounded-xl p-4 min-h-24"
                    placeholder="Objectif du standard"
                    value={standard.objective}
                    onChange={(e) =>
                      updateField("objective", e.target.value)
                    }
                  />

                  <textarea
                    className="border rounded-xl p-4 min-h-24"
                    placeholder="Points sécurité importants"
                    value={standard.safety}
                    onChange={(e) => updateField("safety", e.target.value)}
                  />

                  <textarea
                    className="border rounded-xl p-4 min-h-24"
                    placeholder="Points qualité importants"
                    value={standard.quality}
                    onChange={(e) => updateField("quality", e.target.value)}
                  />

                  <textarea
                    className="border rounded-xl p-4 min-h-24"
                    placeholder="Matériel / outillage / documents nécessaires"
                    value={standard.materials}
                    onChange={(e) =>
                      updateField("materials", e.target.value)
                    }
                  />
                </>
              )}
            </div>
          </section>

          <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900">
                {trame === "gamme_nettoyage"
                  ? "Éléments à nettoyer"
                  : trame === "mode_operatoire"
                  ? "Séquence d’opérations"
                  : "Étapes du standard"}
              </h2>

              <button
                onClick={addStep}
                className="px-5 py-3 rounded-xl bg-slate-950 text-white font-semibold hover:bg-slate-800"
              >
                {trame === "gamme_nettoyage"
                  ? "+ Ajouter un élément"
                  : trame === "mode_operatoire"
                  ? "+ Ajouter une opération"
                  : "+ Ajouter une étape"}
              </button>
            </div>

            <div className="space-y-6">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className="border rounded-2xl p-6 bg-slate-50"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold">
                      {trame === "gamme_nettoyage"
                        ? `Élément ${index + 1}`
                        : trame === "mode_operatoire"
                        ? `Opération ${index + 1}`
                        : `Étape ${index + 1}`}
                    </h3>

                    <button
                      onClick={() => removeStep(step.id)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Supprimer
                    </button>
                  </div>

                  <div className="grid gap-4">
                    <input
                      className="border rounded-xl p-4"
                      placeholder={
                        trame === "instruction_travail"
                          ? "Opération"
                          : trame === "gamme_nettoyage"
                          ? "Elements (ex : Barrettes)"
                          : trame === "mode_operatoire"
                          ? "Qui (opérateur / rôle)"
                          : "Nom de l’étape"
                      }
                      value={step.title}
                      onChange={(e) =>
                        updateStep(step.id, "title", e.target.value)
                      }
                    />

                    <textarea
                      className="border rounded-xl p-4 min-h-24"
                      placeholder={
                        trame === "instruction_travail"
                          ? "Description détaillée de l’opération"
                          : trame === "gamme_nettoyage"
                          ? "Etat standard de propreté attendu"
                          : trame === "mode_operatoire"
                          ? "Comment (verbe d’action, détail de l’opération)"
                          : "Description précise de l’étape"
                      }
                      value={step.description}
                      onChange={(e) =>
                        updateStep(step.id, "description", e.target.value)
                      }
                    />

                    {trame !== "gamme_nettoyage" && trame !== "mode_operatoire" && (
                      <>
                        <input
                          className="border rounded-xl p-4"
                          placeholder="Point sécurité de l’étape"
                          value={step.safety}
                          onChange={(e) =>
                            updateStep(step.id, "safety", e.target.value)
                          }
                        />

                        <input
                          className="border rounded-xl p-4"
                          placeholder="Point qualité / contrôle de l’étape"
                          value={step.quality}
                          onChange={(e) =>
                            updateStep(step.id, "quality", e.target.value)
                          }
                        />
                      </>
                    )}

                    {trame === "mode_operatoire" && (
                      <>
                        <div className="flex flex-wrap gap-6 items-center bg-white border rounded-xl p-4">
                          {standard.operators.map((name, index) => (
                            <label
                              key={index}
                              className="flex items-center gap-2 font-medium"
                            >
                              <input
                                type="checkbox"
                                checked={!!step.operatorFlags?.[index]}
                                onChange={() =>
                                  toggleStepOperator(step.id, index)
                                }
                              />
                              {name || defaultOperatorName(index)}
                            </label>
                          ))}
                        </div>

                        <select
                          className="border rounded-xl p-4 bg-white"
                          value={step.category}
                          onChange={(e) =>
                            updateStep(step.id, "category", e.target.value)
                          }
                        >
                          <option value="">Type de point (normal)</option>
                          <option value="ehs">EHS (mise en évidence jaune)</option>
                          <option value="quality">
                            Qualité (mise en évidence rouge)
                          </option>
                        </select>

                        <textarea
                          className="border rounded-xl p-4 min-h-24"
                          placeholder="Points clés (détail pour ne pas faire d’erreur)"
                          value={step.keyPoints}
                          onChange={(e) =>
                            updateStep(step.id, "keyPoints", e.target.value)
                          }
                        />
                      </>
                    )}

                    {trame === "gamme_nettoyage" && (
                      <>
                        <select
                          className="border rounded-xl p-4 bg-white"
                          value={step.conditions}
                          onChange={(e) =>
                            updateStep(step.id, "conditions", e.target.value)
                          }
                        >
                          <option value="">Conditions (OC / A / M / P)</option>
                          <option value="OC">OC — Outil condamné</option>
                          <option value="A">A — À l’arrêt</option>
                          <option value="M">M — En marche sans produire</option>
                          <option value="P">P — En marche et en production</option>
                        </select>

                        <input
                          className="border rounded-xl p-4"
                          placeholder="Outillage nécessaire"
                          value={step.tooling}
                          onChange={(e) =>
                            updateStep(step.id, "tooling", e.target.value)
                          }
                        />

                        <textarea
                          className="border rounded-xl p-4 min-h-24"
                          placeholder="Action si hors standard"
                          value={step.outOfStandard}
                          onChange={(e) =>
                            updateStep(
                              step.id,
                              "outOfStandard",
                              e.target.value
                            )
                          }
                        />
                      </>
                    )}

                    {trame !== "mode_operatoire" && (
                      <input
                        className="border rounded-xl p-4"
                        placeholder={
                          trame === "instruction_travail"
                            ? "Temps (en minutes)"
                            : trame === "gamme_nettoyage"
                            ? "Durée (ex : 5 min)"
                            : "Temps estimé"
                        }
                        value={step.duration}
                        onChange={(e) =>
                          updateStep(step.id, "duration", e.target.value)
                        }
                      />
                    )}

                    {trame === "instruction_travail" ? (
                      <div className="grid sm:grid-cols-3 gap-4 mt-2">
                        <PhotoUpload
                          title="Illustration"
                          preview={step.preview}
                          onChange={(file) =>
                            updatePhoto(step.id, "preview", file)
                          }
                          onRemove={() => removePhoto(step.id, "preview")}
                        />
                      </div>
                    ) : trame === "gamme_nettoyage" ? (
                      <div className="grid sm:grid-cols-3 gap-4 mt-2">
                        <PhotoUpload
                          title="Photo repère"
                          preview={step.preview}
                          onChange={(file) =>
                            updatePhoto(step.id, "preview", file)
                          }
                          onRemove={() => removePhoto(step.id, "preview")}
                        />

                        <PhotoUpload
                          title="Photo repère (2)"
                          preview={step.preview2}
                          onChange={(file) =>
                            updatePhoto(step.id, "preview2", file)
                          }
                          onRemove={() => removePhoto(step.id, "preview2")}
                        />
                      </div>
                    ) : trame === "mode_operatoire" ? null : (
                      <div className="grid sm:grid-cols-3 gap-4 mt-2">
                        <PhotoUpload
                          title="Photo terrain"
                          preview={step.preview}
                          onChange={(file) =>
                            updatePhoto(step.id, "preview", file)
                          }
                          onRemove={() => removePhoto(step.id, "preview")}
                        />

                        <PhotoUpload
                          title="Photo OK"
                          preview={step.okPreview}
                          onChange={(file) =>
                            updatePhoto(step.id, "okPreview", file)
                          }
                          onRemove={() => removePhoto(step.id, "okPreview")}
                        />

                        <PhotoUpload
                          title="Photo NOK"
                          preview={step.nokPreview}
                          onChange={(file) =>
                            updatePhoto(step.id, "nokPreview", file)
                          }
                          onRemove={() => removePhoto(step.id, "nokPreview")}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
            {trame === "classique" && (
              <>
                <h2 className="text-2xl font-bold text-slate-900 mb-6">
                  Validation terrain
                </h2>

                <textarea
                  className="border rounded-xl p-4 min-h-28 w-full"
                  placeholder="Points de contrôle / critères d’acceptation / erreurs à éviter"
                  value={standard.control}
                  onChange={(e) => updateField("control", e.target.value)}
                />
              </>
            )}

            <div className="mt-6 flex flex-wrap gap-4">
              <button
                onClick={generateStandard}
                className="px-6 py-4 rounded-xl bg-slate-950 text-white font-semibold hover:bg-slate-800"
              >
                Générer l’aperçu du standard
              </button>

              <button
                onClick={() => improveWithAI("quick")}
                disabled={loadingAI}
                className="px-6 py-4 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-400 disabled:opacity-60"
              >
                ⚡ Analyse rapide
              </button>

              <button
                onClick={() => improveWithAI("standard")}
                disabled={loadingAI}
                className="px-6 py-4 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
              >
                🏭 Analyse standard
              </button>

              <button
                onClick={() => improveWithAI("expert")}
                disabled={loadingAI}
                className="px-6 py-4 rounded-xl bg-purple-700 text-white font-semibold hover:bg-purple-600 disabled:opacity-60"
              >
                🔬 Analyse expert
              </button>

              <button
                onClick={resetDraft}
                className="px-6 py-4 rounded-xl bg-white border text-red-600 font-semibold hover:bg-red-50"
              >
                Réinitialiser
              </button>
            </div>

            {loadingAI && (
              <p className="mt-4 text-sm text-blue-700">
                Analyse IA en cours...
              </p>
            )}
          </section>
        </div>

        {aiResult && (
          <section className="mt-8 bg-white rounded-3xl p-8 shadow-sm border border-slate-200 print:hidden">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold text-slate-900">
                Analyse IA Lean
              </h2>

              <button
                onClick={() => setAiResult("")}
                className="px-4 py-2 rounded-xl bg-slate-100 border hover:bg-slate-200"
              >
                Masquer
              </button>
            </div>

            <div className="whitespace-pre-line text-slate-700 leading-7 bg-slate-50 rounded-2xl p-6 border">
              {aiResult}
            </div>
          </section>
        )}

        {showPreview && (
          <section className="mt-8 bg-white rounded-3xl p-8 shadow-sm border border-slate-200 print:shadow-none print:border-none print:rounded-none print:p-0 print:mt-0">
            <div className="flex items-center justify-between mb-6 print:hidden">
              <h2 className="text-3xl font-bold text-slate-900">
                Aperçu du standard généré
              </h2>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={printStandard}
                  className="px-4 py-2 rounded-xl bg-slate-950 text-white hover:bg-slate-800"
                >
                  Imprimer / Export PDF
                </button>

                <button
                  onClick={exportWord}
                  disabled={exportingWord}
                  className="px-4 py-2 rounded-xl bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {exportingWord
                    ? "Génération du Word…"
                    : "Exporter en Word (.docx)"}
                </button>

                <button
                  onClick={saveToLibrary}
                  className="px-4 py-2 rounded-xl bg-white border hover:bg-slate-50"
                >
                  Sauvegarder dans la bibliothèque
                </button>

                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 border hover:bg-slate-200"
                >
                  Masquer
                </button>
              </div>
            </div>

            {renderPrintLayout(trame, standard, steps)}
          </section>
        )}
          </>
        )}
      </div>

      {exampleModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-start justify-center overflow-y-auto p-6 print:hidden"
          onClick={() => setExampleModal(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-xl w-full max-w-6xl my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 px-8 py-5 border-b">
              <div>
                <p className="text-sm text-slate-500">Exemple de trame</p>
                <h3 className="text-xl font-bold text-slate-900">
                  {TRAMES[exampleModal].label}
                </h3>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    chooseTrame(exampleModal);
                    setExampleModal(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-950 text-white hover:bg-slate-800 whitespace-nowrap"
                >
                  Choisir cette trame
                </button>

                <button
                  onClick={() => setExampleModal(null)}
                  className="px-3 py-2 rounded-xl bg-slate-100 border hover:bg-slate-200"
                  aria-label="Fermer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-8">
              {renderPrintLayout(
                exampleModal,
                EXAMPLE_DATA[exampleModal].standard,
                EXAMPLE_DATA[exampleModal].steps
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}