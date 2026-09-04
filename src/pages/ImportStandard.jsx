import { useState } from "react";
import * as XLSX from "xlsx";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { apiFetch } from "../config";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function ImportStandard({ onBack }) {
  const [importedText, setImportedText] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");

  async function readPdfText(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = "";

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      const pageText = textContent.items.map((item) => item.str).join(" ");

      fullText += `\n\n=== PAGE ${pageNum} ===\n${pageText}`;
    }

    return fullText;
  }

  async function readExcelText(file) {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);

    let fullText = "";

    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      fullText += `\n\n=== FEUILLE : ${sheetName} ===\n`;

      rows.forEach((row) => {
        fullText += row.join(" | ") + "\n";
      });
    });

    return fullText;
  }

  async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setImportedText("");
    setAnalysis("");
    setPdfUrl("");

    try {
      const extension = file.name.split(".").pop().toLowerCase();

      if (extension === "pdf") {
        setPdfUrl(URL.createObjectURL(file));
        const text = await readPdfText(file);
        setImportedText(text);
        return;
      }

      if (["xlsx", "xls"].includes(extension)) {
        const text = await readExcelText(file);
        setImportedText(text);
        return;
      }

      if (["txt", "csv", "md"].includes(extension)) {
        const text = await file.text();
        setImportedText(text);
        return;
      }

      alert("Format non supporté.");
    } catch (error) {
      console.error(error);
      alert("Erreur lecture fichier : " + error.message);
    }
  }

  async function analyzeImportedStandard() {
    try {
      setLoading(true);
      setAnalysis("");

      const response = await apiFetch("/api/analyze-imported-standard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ importedText }),
      });

      const data = await response.json();
      setAnalysis(data.result || "Aucune analyse retournée.");
    } catch (error) {
      console.error(error);
      setAnalysis("Erreur lors de l’analyse du standard importé.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={onBack}
          className="mb-6 px-4 py-2 rounded-xl bg-white border hover:bg-slate-50"
        >
          ← Retour
        </button>

        <h1 className="text-5xl font-bold text-slate-900">
          Importer un standard existant
        </h1>

        <p className="mt-3 text-slate-600 text-lg">
          Import PDF, Excel ou texte pour analyse Lean IA.
        </p>

        <section className="mt-8 bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            Standard à analyser
          </h2>

          <input
            type="file"
            accept=".pdf,.xlsx,.xls,.txt,.csv,.md"
            onChange={handleFileUpload}
            className="mb-5 border rounded-xl p-4 bg-white w-full"
          />

          {fileName && (
            <div className="mb-5 bg-slate-50 border rounded-xl p-4">
              <strong>Fichier chargé :</strong> {fileName}
            </div>
          )}

          {pdfUrl && (
            <div className="mb-8 border rounded-2xl overflow-hidden bg-slate-50">
              <iframe
                src={pdfUrl}
                title="Aperçu PDF"
                className="w-full h-[800px]"
              />
            </div>
          )}

          <textarea
            className="border rounded-xl p-4 min-h-80 w-full"
            placeholder="Contenu texte extrait du document..."
            value={importedText}
            onChange={(e) => setImportedText(e.target.value)}
          />

          <button
            onClick={analyzeImportedStandard}
            disabled={loading || importedText.trim() === ""}
            className="mt-6 px-8 py-5 rounded-2xl bg-blue-600 text-white font-bold text-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading
              ? "Analyse IA en cours..."
              : "Analyser et convertir avec l’IA"}
          </button>
        </section>

        {analysis && (
          <section className="mt-8 bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
            <h2 className="text-3xl font-bold text-slate-900 mb-6">
              Analyse IA du standard importé
            </h2>

            <div className="whitespace-pre-line text-slate-700 leading-7 bg-slate-50 rounded-2xl p-6 border">
              {analysis}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}