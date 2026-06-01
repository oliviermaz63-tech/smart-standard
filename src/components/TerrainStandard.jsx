import { useState } from "react";
import GeneratedStandard from "./GeneratedStandard";
import StandardsLibrary from "./StandardsLibrary";

export default function TerrainStandard() {
  const [title, setTitle] = useState("");
  const [zone, setZone] = useState("");
  const [machine, setMachine] = useState("");
  const [objective, setObjective] = useState("");
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [listening, setListening] = useState(null);

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

  function updatePhoto(id, field, file) {
    if (!file) return;

    setSteps(
      steps.map((step) =>
        step.id === id
          ? {
              ...step,
              [field]: URL.createObjectURL(file),
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
          "Positionner la pièce sous l’éclairage LED de contrôle à une distance d’environ 30 cm.",
        preview: null,
        okPreview: null,
        nokPreview: null,
      },
      {
        id: Date.now() + 2,
        description:
          "Contrôler l’absence de rayure visible supérieure à 2 mm sur les faces A et B à l’aide de la photo de référence OK.",
        preview: null,
        okPreview: null,
        nokPreview: null,
      },
      {
        id: Date.now() + 3,
        description:
          "Contrôler l’absence de bavure coupante détectable au toucher avec gant nitrile sur les zones d’usinage.",
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

  async function generateStandard() {
    try {
      setLoading(true);
      setResult(null);

      const response = await fetch(
        "http://192.168.68.76:3001/api/generate-terrain-standard",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            zone,
            machine,
            objective,
            steps,
          }),
        }
      );

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error(error);
      alert("Erreur génération IA.");
    } finally {
      setLoading(false);
    }
  }

  function saveStandard() {
    const existing = JSON.parse(localStorage.getItem("smartstandards")) || [];

    const newStandard = {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      result,
      inputSteps: steps,
    };

    localStorage.setItem(
      "smartstandards",
      JSON.stringify([newStandard, ...existing])
    );

    alert("Standard sauvegardé");
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-7xl mx-auto p-6 space-y-8">

        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <p className="uppercase tracking-widest text-sm text-slate-500 font-bold">
              Smart Standard
            </p>

            <h1 className="text-4xl font-black mt-2">
              📸🎤 Création standard terrain IA
            </h1>

            <p className="text-slate-600 mt-2 text-lg max-w-3xl">
              Photos + notes + dictée vocale terrain → standard industriel robuste, visuel et auditables.
            </p>
          </div>

          <button
            onClick={fillDemo}
            className="px-6 py-4 rounded-2xl bg-slate-900 text-white font-bold"
          >
            ⚡ Charger une démo
          </button>
        </div>

        <div className="bg-white rounded-3xl border shadow-sm p-6 space-y-5">
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
              <label className="font-bold">Objectif de l’opération</label>

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
              placeholder="Décrire l’objectif ou dicter avec le micro..."
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className="w-full border rounded-xl p-4 h-28"
            />
          </div>
        </div>

        <div className="bg-white rounded-3xl border shadow-sm p-6">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-black">Étapes terrain</h2>
              <p className="text-slate-500">
                Chaque étape peut contenir une note vocale, une photo terrain, une photo OK et une photo NOK.
              </p>
            </div>

            <button
              onClick={addStep}
              className="bg-slate-900 text-white px-5 py-3 rounded-xl font-bold"
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
                    🎤 {listening === step.id ? "Écoute..." : "Dicter l’étape"}
                  </button>
                </div>

                <div className="grid xl:grid-cols-2 gap-6 p-6">
                  <div>
                    <textarea
                      placeholder="Décrire précisément l’étape observée terrain..."
                      value={step.description}
                      onChange={(e) =>
                        updateStep(step.id, "description", e.target.value)
                      }
                      className="w-full border rounded-xl p-4 h-44"
                    />

                    <p className="mt-3 text-sm text-slate-500">
                      Conseil : préciser action, condition d’observation, critère OK/NOK, réaction en cas d’écart.
                    </p>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <PhotoUpload
                      title="Photo terrain"
                      preview={step.preview}
                      onChange={(file) => updatePhoto(step.id, "preview", file)}
                    />

                    <PhotoUpload
                      title="Photo OK"
                      preview={step.okPreview}
                      onChange={(file) => updatePhoto(step.id, "okPreview", file)}
                    />

                    <PhotoUpload
                      title="Photo NOK"
                      preview={step.nokPreview}
                      onChange={(file) => updatePhoto(step.id, "nokPreview", file)}
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
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white px-12 py-6 rounded-3xl text-2xl font-black shadow-xl"
          >
            {loading ? "Analyse terrain IA..." : "🚀 Générer Smart Standard"}
          </button>
        </div>

        <GeneratedStandard
          result={result}
          inputSteps={steps}
          onSave={saveStandard}
        />

        <StandardsLibrary />
      </div>
    </div>
  );
}

function PhotoUpload({ title, preview, onChange }) {
  return (
    <div className="border rounded-2xl overflow-hidden bg-slate-50">
      <div className="bg-slate-100 px-4 py-3 font-bold text-center">
        {title}
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
          onChange={(e) => onChange(e.target.files[0])}
          className="text-sm w-full"
        />
      </div>
    </div>
  );
}