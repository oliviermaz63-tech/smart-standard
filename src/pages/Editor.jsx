import { useEffect, useState } from "react";
import { API_BASE_URL } from "../config";

const STORAGE_KEY = "smart-standard-editor-draft";
const LIBRARY_KEY = "smart-standard-library";

const emptyStandard = {
  title: "",
  zone: "",
  owner: "",
  objective: "",
  safety: "",
  quality: "",
  materials: "",
  control: "",
};

const emptyStep = {
  id: 1,
  title: "",
  description: "",
  safety: "",
  quality: "",
  duration: "",
};

export default function Editor({ onBack }) {
  const [standard, setStandard] = useState(emptyStandard);
  const [steps, setSteps] = useState([emptyStep]);
  const [showPreview, setShowPreview] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);

  useEffect(() => {
    const savedDraft = localStorage.getItem(STORAGE_KEY);
    if (savedDraft) {
      const parsedDraft = JSON.parse(savedDraft);
      setStandard(parsedDraft.standard || emptyStandard);
      setSteps(parsedDraft.steps || [emptyStep]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ standard, steps }));
    setSavedMessage("Brouillon sauvegardé automatiquement");

    const timer = setTimeout(() => setSavedMessage(""), 1500);
    return () => clearTimeout(timer);
  }, [standard, steps]);

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
      },
    ]);
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

  const requiredFields = [
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

        <div className="print:hidden">
          <h1 className="text-4xl font-bold text-slate-900">
            Créer un nouveau standard
          </h1>

          <p className="mt-2 text-slate-600">
            Structure guidée pour créer un standard simple, clair et exploitable terrain.
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
              <input
                className="border rounded-xl p-4"
                placeholder="Titre du standard"
                value={standard.title}
                onChange={(e) => updateField("title", e.target.value)}
              />

              <input
                className="border rounded-xl p-4"
                placeholder="Zone / poste / ligne"
                value={standard.zone}
                onChange={(e) => updateField("zone", e.target.value)}
              />

              <input
                className="border rounded-xl p-4"
                placeholder="Responsable / référent"
                value={standard.owner}
                onChange={(e) => updateField("owner", e.target.value)}
              />

              <textarea
                className="border rounded-xl p-4 min-h-24"
                placeholder="Objectif du standard"
                value={standard.objective}
                onChange={(e) => updateField("objective", e.target.value)}
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
                onChange={(e) => updateField("materials", e.target.value)}
              />
            </div>
          </section>

          <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900">
                Étapes du standard
              </h2>

              <button
                onClick={addStep}
                className="px-5 py-3 rounded-xl bg-slate-950 text-white font-semibold hover:bg-slate-800"
              >
                + Ajouter une étape
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
                      Étape {index + 1}
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
                      placeholder="Nom de l’étape"
                      value={step.title}
                      onChange={(e) =>
                        updateStep(step.id, "title", e.target.value)
                      }
                    />

                    <textarea
                      className="border rounded-xl p-4 min-h-24"
                      placeholder="Description précise de l’étape"
                      value={step.description}
                      onChange={(e) =>
                        updateStep(step.id, "description", e.target.value)
                      }
                    />

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

                    <input
                      className="border rounded-xl p-4"
                      placeholder="Temps estimé"
                      value={step.duration}
                      onChange={(e) =>
                        updateStep(step.id, "duration", e.target.value)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              Validation terrain
            </h2>

            <textarea
              className="border rounded-xl p-4 min-h-28 w-full"
              placeholder="Points de contrôle / critères d’acceptation / erreurs à éviter"
              value={standard.control}
              onChange={(e) => updateField("control", e.target.value)}
            />

            <div className="mt-6 flex flex-wrap gap-4">
              <button
                onClick={generateStandard}
                className="px-6 py-4 rounded-xl bg-slate-950 text-white font-semibold hover:bg-slate-800"
              >
                Générer la trame du standard
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

            <div className="border rounded-2xl overflow-hidden print:border-none">
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

                        <div className="mt-4 grid md:grid-cols-3 gap-3 text-sm print:grid-cols-3">
                          <div className="bg-red-50 rounded-lg p-3 print:bg-white print:border">
                            <strong>Sécurité :</strong>{" "}
                            {step.safety || "RAS"}
                          </div>

                          <div className="bg-blue-50 rounded-lg p-3 print:bg-white print:border">
                            <strong>Qualité :</strong>{" "}
                            {step.quality || "RAS"}
                          </div>

                          <div className="bg-slate-100 rounded-lg p-3 print:bg-white print:border">
                            <strong>Temps :</strong>{" "}
                            {step.duration || "Non défini"}
                          </div>
                        </div>
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
          </section>
        )}
      </div>
    </div>
  );
}