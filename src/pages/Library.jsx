import { useState } from "react";

const LIBRARY_KEY = "smart-standard-library";

const TRAME_LABELS = {
  classique: "Standard classique",
  instruction_travail: "Instruction de travail",
  gamme_nettoyage: "Gamme de nettoyage",
  mode_operatoire: "Standard mode opératoire",
};

export default function Library({ onBack, onOpenStandard }) {
  const [standards, setStandards] = useState(() =>
    JSON.parse(localStorage.getItem(LIBRARY_KEY) || "[]")
  );

  function deleteStandard(id) {
    if (!confirm("Supprimer définitivement ce standard de la bibliothèque ?")) {
      return;
    }
    const updated = standards.filter((item) => item.id !== id);
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(updated));
    setStandards(updated);
  }

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="max-w-6xl mx-auto">
        <button onClick={onBack} className="mb-6 px-4 py-2 rounded-xl bg-white border">
          ← Retour
        </button>

        <h1 className="text-4xl font-bold text-slate-900">Bibliothèque de standards</h1>
        <p className="mt-2 text-slate-600">
          Les standards sauvegardés depuis l’éditeur (bouton « Sauvegarder dans la
          bibliothèque »). Sauvegarde locale à ce navigateur uniquement.
        </p>

        <div className="mt-8 grid gap-4">
          {standards.length === 0 && (
            <div className="bg-white rounded-2xl p-6 border">
              Aucun standard sauvegardé pour l’instant.
            </div>
          )}

          {standards.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl p-6 border shadow-sm flex flex-wrap items-center justify-between gap-4"
            >
              <div>
                <h2 className="text-2xl font-bold">{item.standard.title || "Standard sans titre"}</h2>
                <p className="text-slate-600 mt-2">
                  {TRAME_LABELS[item.trame] || "Trame classique"} — Zone :{" "}
                  {item.standard.zone || "Non renseignée"} — Étapes : {item.steps.length}
                </p>
                <p className="text-sm text-slate-400 mt-2">
                  Sauvegardé le {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => onOpenStandard(item)}
                  className="px-4 py-2 rounded-xl bg-slate-950 text-white hover:bg-slate-800"
                >
                  Rouvrir dans l’éditeur
                </button>
                <button
                  onClick={() => deleteStandard(item.id)}
                  className="px-4 py-2 rounded-xl bg-red-100 text-red-700 font-bold hover:bg-red-200"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}