import { useState } from "react";
import { apiFetch } from "../config";
import { compressImage } from "../utils/compressImage";
import { TRAMES } from "../data/trames";

export default function TerrainStandard({ trame, onBack, onGenerated }) {
  const [title, setTitle] = useState("");
  const [zone, setZone] = useState("");
  const [machine, setMachine] = useState("");
  const [objective, setObjective] = useState("");
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [listening, setListening] = useState(null);

  const trameInfo = TRAMES[trame] || TRAMES.classique;

  function addStep() {
    setSteps([
      ...steps,
      {
        id: Date.now(),
        description: "",
        preview: null,
        okPreview: null,
        nokPreview: null,
      },
    ]);
  }

  function updateStep(id, field, value) {
    setSteps(
      steps.map((step) =>
        step.id === id ? { ...step, [field]: value } : step
      )
    );
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

  function startVoice(target, stepId = null) {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Reconnaissance vocale non disponible. Utilise Chrome ou Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.continuous = false;
    recognition.interimResults = false;

    setListening(stepId || target);

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;

      if (target === "objective") {
        setObjective((prev) => `${prev} ${text}`.trim());
      }

      if (target === "step" && stepId) {
        setSteps((prev) =>
          prev.map((step) =>
            step.id === stepId
              ? {
                  ...step,
                  description: `${step.description} ${text}`.trim(),
                }
              : step
          )
        );
      }
    };

    recognition.onend = () => setListening(null);
    recognition.start();
  }

  function fillDemo() {
    setTitle("Contrôle visuel pièce usinée avant expédition");
    setZone("Usinage");
    setMachine("Poste contrôle final CNC");
    setObjective(
      "Garantir la conformité visuelle des pièces avant emballage et expédition client."
    );

    setSteps([
      {
        id: Date.now() + 1,
        description:
          "Positionner la pièce sous l'éclairage LED de contrôle à une distance d'environ 30 cm.",
        preview: null,
        okPreview: null,
        nokPreview: null,
      },
      {
        id: Date.now() + 2,
        description:
          "Contrôler l'absence de rayure visible supérieure à 2 mm sur les faces A et B à l'aide de la photo de référence OK.",
        preview: null,
        okPreview: null,
        nokPreview: null,
      },
      {
        id: Date.now() + 3,
        description:
          "Contrôler l'absence de bavure coupante détectable au toucher avec gant nitrile sur les zones d'usinage.",
        preview: null,
        okPreview: null,
        nokPreview: null,
      },
      {
        id: Date.now() + 4,
        description:
          "Isoler immédiatement la pièce dans la zone NOK et prévenir le leader en cas de défaut détecté.",
        preview: null,
        okPreview: null,
        nokPreview: null,
      },
    ]);
  }

  // Combine le standard rédigé par l'IA avec les photos prises sur le
  // terrain (l'IA ne génère que du texte, jamais d'image) pour produire un
  // standard exploitable tel quel dans l'éditeur.
  function mergeStepsWithPhotos(aiSteps) {
    return (aiSteps || []).map((step, index) => ({
      id: Date.now() + index,
      title: step.title || `Étape ${index + 1}`,
      description: step.description || "",
      safety: step.safety || "",
      quality: step.quality || "",
      duration: step.duration || "",
      preview: steps[index]?.preview || null,
      preview2: null,
      okPreview: steps[index]?.okPreview || null,
      nokPreview: steps[index]?.nokPreview || null,
      conditions: step.conditions || "",
      tooling: step.tooling || "",
      outOfStandard: step.outOfStandard || "",
      operatorFlags: step.operatorFlags || [false, false],
      category: step.category || "",
      keyPoints: step.keyPoints || "",
    }));
  }

  async function generateStandard() {
    try {
      setLoading(true);
      setResult(null);

      // On n'envoie jamais les photos elles-mêmes à l'IA : elle n'en a pas
      // besoin (le texte seul suffit à rédiger le standard, et les photos
      // terrain sont de toute façon réinjectées localement après coup par
      // mergeStepsWithPhotos). On envoie juste un indicateur de présence
      // pour chaque type de photo, utile à l'IA pour ses remarques sur les
      // contrôles visuels sans photo de référence.
      // Important : ne JAMAIS remettre les champs preview/okPreview/
      // nokPreview (base64) dans ce payload - une poignée de photos de
      // téléphone suffit à produire un prompt de plusieurs Mo de texte,
      // ce qui fait échouer l'appel IA (dépassement de la taille de
      // contexte autorisée) sans message d'erreur clair pour l'utilisateur.
      const sanitizedSteps = steps.map((step) => ({
        description: step.description,
        hasPhotoTerrain: !!step.preview,
        hasPhotoOK: !!step.okPreview,
        hasPhotoNOK: !!step.nokPreview,
      }));

      const response = await apiFetch("/api/generate-terrain-standard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          zone,
          machine,
          objective,
          steps: sanitizedSteps,
          trame,
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error(error);
      alert("Erreur génération IA.");
    } finally {
      setLoading(false);
    }
  }

  function continueToEditor() {
    if (!result) return;
    onGenerated({
      trame,
      standard: { ...(result.standard || {}), machine },
      steps: mergeStepsWithPhotos(result.steps),
    });
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto p-6 space-y-8">

        <div className="flex items-center justify-between gap-4">
          <button onClick={onBack} className="btn-secondary px-4 py-2">
            ← Retour
          </button>
          <p className="text-slate-500 text-sm">
            Trame choisie : <strong className="text-slate-900">{trameInfo.label}</strong>
          </p>
        </div>

        <div className="ss-hero px-8 py-8">
          <div className="ss-hero-blob -right-12 -top-12 w-56 h-56" />
          <div className="relative z-10 flex flex-wrap justify-between items-start gap-4">
            <div>
              <p className="uppercase tracking-widest text-sm text-indigo-100 font-bold">
                Smart Standard
              </p>

              <h1 className="text-3xl font-black mt-2">
                📸🎤 Création standard terrain IA
              </h1>

              <p className="text-indigo-50 mt-2 text-lg max-w-3xl">
                Photos + notes + dictée vocale terrain → l'IA rédige le standard, dans la trame « {trameInfo.label} ».
              </p>
            </div>

            <button
              onClick={fillDemo}
              className="btn-secondary px-6 py-4"
            >
              ⚡ Charger une démo
            </button>
          </div>
        </div>

        <div className="ss-card p-6 space-y-5">
          <h2 className="text-2xl font-black">Informations générales</h2>

          <div className="grid md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Titre du standard"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border rounded-xl p-4"
            />

            <input
              type="text"
              placeholder="Zone"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className="border rounded-xl p-4"
            />

            <input
              type="text"
              placeholder="Machine / Poste"
              value={machine}
              onChange={(e) => setMachine(e.target.value)}
              className="border rounded-xl p-4"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="font-bold">Objectif de l'opération</label>

              <button
                onClick={() => startVoice("objective")}
                className={`px-4 py-2 rounded-xl font-bold ${
                  listening === "objective"
                    ? "bg-red-600 text-white"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                🎤 {listening === "objective" ? "Écoute..." : "Dicter"}
              </button>
            </div>

            <textarea
              placeholder="Décrire l'objectif ou dicter avec le micro..."
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className="w-full border rounded-xl p-4 h-28"
            />
          </div>
        </div>

        <div className="ss-card p-6">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-black">Étapes terrain</h2>
              <p className="text-slate-500">
                Chaque étape peut contenir une note vocale, une photo terrain, une photo OK et une photo NOK.
              </p>
            </div>

            <button
              onClick={addStep}
              className="btn-dark px-5 py-3"
            >
              + Ajouter une étape
            </button>
          </div>

          <div className="space-y-6">
            {steps.map((step, index) => (
              <div key={step.id} className="border rounded-3xl overflow-hidden">
                <div className="bg-slate-950 text-white px-6 py-4 flex justify-between items-center">
                  <div>
                    <p className="uppercase text-xs tracking-widest text-slate-400 font-bold">
                      Observation terrain
                    </p>
                    <h3 className="text-2xl font-black">Étape {index + 1}</h3>
                  </div>

                  <button
                    onClick={() => startVoice("step", step.id)}
                    className={`px-5 py-3 rounded-xl font-bold ${
                      listening === step.id
                        ? "bg-red-600 text-white"
                        : "bg-blue-600 text-white"
                    }`}
                  >
                    🎤 {listening === step.id ? "Écoute..." : "Dicter l'étape"}
                  </button>
                </div>

                <div className="grid xl:grid-cols-2 gap-6 p-6">
                  <div>
                    <textarea
                      placeholder="Décrire précisément l'étape observée terrain..."
                      value={step.description}
                      onChange={(e) =>
                        updateStep(step.id, "description", e.target.value)
                      }
                      className="w-full border rounded-xl p-4 h-44"
                    />

                    <p className="mt-3 text-sm text-slate-500">
                      Conseil : préciser action, condition d'observation, critère OK/NOK, réaction en cas d'écart.
                    </p>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <PhotoUpload
                      title="Photo terrain"
                      preview={step.preview}
                      onChange={(file) => updatePhoto(step.id, "preview", file)}
                      onRemove={() => removePhoto(step.id, "preview")}
                    />

                    <PhotoUpload
                      title="Photo OK"
                      preview={step.okPreview}
                      onChange={(file) => updatePhoto(step.id, "okPreview", file)}
                      onRemove={() => removePhoto(step.id, "okPreview")}
                    />

                    <PhotoUpload
                      title="Photo NOK"
                      preview={step.nokPreview}
                      onChange={(file) => updatePhoto(step.id, "nokPreview", file)}
                      onRemove={() => removePhoto(step.id, "nokPreview")}
                    />
                  </div>
                </div>
              </div>
            ))}

            {steps.length === 0 && (
              <div className="border border-dashed rounded-3xl p-16 text-center text-slate-400">
                <p className="text-6xl">🎤📸</p>
                <p className="mt-4 text-lg">
                  Ajoute une étape ou charge la démo pour tester rapidement.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-center">
          <button
            onClick={generateStandard}
            disabled={loading || steps.length === 0}
            className="btn-primary disabled:opacity-50 px-12 py-6 text-2xl"
          >
            {loading ? "Analyse terrain IA..." : "🚀 Générer Smart Standard"}
          </button>
        </div>

        {result && (
          <div className={`ss-card overflow-hidden border-2 ${
            result.validation?.status === "OK" ? "border-green-300" : "border-red-300"
          }`}>
            <div className={`px-6 py-5 flex flex-wrap justify-between items-center gap-4 ${
              result.validation?.status === "OK" ? "bg-green-50" : "bg-red-50"
            }`}>
              <div>
                <p className="uppercase tracking-widest text-xs font-bold text-slate-500">
                  Smart Standard AI Validation
                </p>
                <h2 className="text-2xl font-black mt-2">
                  {result.validation?.status === "OK"
                    ? "✅ Validation terrain acceptable"
                    : "❌ Validation terrain insuffisante"}
                </h2>
              </div>

              <div className="text-right">
                <p className="text-sm text-slate-500 font-bold uppercase">Score IA</p>
                <p className={`text-5xl font-black ${
                  result.validation?.score >= 80
                    ? "text-green-600"
                    : result.validation?.score >= 70
                    ? "text-orange-500"
                    : "text-red-600"
                }`}>
                  {result.validation?.score}%
                </p>
              </div>
            </div>

            <div className="bg-white p-6 space-y-6">
              {result.validation?.problems?.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold mb-3">⚠️ Problèmes détectés</h3>
                  <ul className="list-disc pl-6 space-y-2">
                    {result.validation.problems.map((problem, index) => (
                      <li key={index}>{problem}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.validation?.weakWords?.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold mb-4">🧠 Formulations faibles détectées</h3>
                  <div className="grid xl:grid-cols-2 gap-4">
                    {result.validation.weakWords.map((word, index) => (
                      <div key={index} className="border rounded-2xl p-5 bg-slate-50">
                        <p className="font-black text-red-600 text-lg">{word.word}</p>
                        <p className="mt-2 text-slate-700">{word.whyProblem}</p>
                        <div className="mt-4 bg-white border rounded-xl p-4">
                          <p className="text-sm uppercase tracking-widest text-slate-400 font-bold">
                            Clarification attendue
                          </p>
                          <p className="mt-2">{word.requiredClarification}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3 justify-end pt-4 border-t">
                <button onClick={() => setResult(null)} className="btn-secondary px-6 py-4">
                  Modifier mes observations
                </button>
                <button onClick={continueToEditor} className="btn-primary px-8 py-4 text-lg">
                  Continuer vers l'éditeur →
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export function PhotoUpload({ title, preview, onChange, onRemove }) {
  return (
    <div className="border rounded-2xl overflow-hidden bg-slate-50">
      <div className="bg-slate-100 px-4 py-3 font-bold text-center flex items-center justify-between">
        <span>{title}</span>

        {preview && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-red-600 text-xs font-bold hover:underline"
          >
            ✕ Supprimer
          </button>
        )}
      </div>

      <div className="h-48 flex items-center justify-center overflow-hidden bg-white">
        {preview ? (
          <img src={preview} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="text-center text-slate-400">
            <p className="text-4xl">📷</p>
            <p className="text-sm mt-2">Ajouter</p>
          </div>
        )}
      </div>

      <div className="p-3">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            onChange(e.target.files[0]);
            // Réinitialise le champ pour permettre de resélectionner exactement
            // le même fichier plus tard (ex: après suppression de la photo) :
            // sans ça, le navigateur ne redéclenche pas onChange si le fichier
            // choisi est identique à la sélection précédente.
            e.target.value = "";
          }}
          className="text-sm w-full"
        />
      </div>
    </div>
  );
}
