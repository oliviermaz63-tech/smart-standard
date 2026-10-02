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
    <div className="min-h-screen px-6 py-10">
      <div className="max-w-6xl mx-auto">
        <button onClick={onBack} className="btn-secondary mb-6 px-4 py-2">
          ← Retour
        </button>

        <div className="ss-hero px-8 py-10 mb-8">
          <div className="ss-hero-blob -right-12 -top-12 w-56 h-56" />
          <h1 className="relative z-10 text-3xl font-bold">Bibliothèque de standards</h1>
          <p className="relative z-10 mt-2 text-indigo-50">
            Les standards sauvegardés depuis l'éditeur (mode Terrain ou mode manuel). Sauvegarde locale à ce navigateur uniquement.
          </p>
        </div>

        <div className="grid gap-4">
          {standards.length === 0 && (
            <div className="ss-card p-6">
              Aucun standard sauvegardé pour l'instant.
            </div>
          )}

          {standards.map((item) => (
            <div
              key={item.id}
              className="ss-card p-6 flex flex-wrap items-center justify-between gap-4"
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
                  className="btn-primary px-4 py-2"
                >
                  Rouvrir dans l'éditeur
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