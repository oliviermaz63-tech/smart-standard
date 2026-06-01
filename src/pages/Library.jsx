export default function Library({ onBack }) {
  const standards = JSON.parse(localStorage.getItem("smart-standard-library") || "[]");

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="max-w-6xl mx-auto">
        <button onClick={onBack} className="mb-6 px-4 py-2 rounded-xl bg-white border">
          ← Retour
        </button>

        <h1 className="text-4xl font-bold text-slate-900">Bibliothèque de standards</h1>

        <div className="mt-8 grid gap-4">
          {standards.length === 0 && (
            <div className="bg-white rounded-2xl p-6 border">
              Aucun standard sauvegardé pour l’instant.
            </div>
          )}

          {standards.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl p-6 border shadow-sm">
              <h2 className="text-2xl font-bold">{item.standard.title || "Standard sans titre"}</h2>
              <p className="text-slate-600 mt-2">
                Zone : {item.standard.zone || "Non renseignée"} — Étapes : {item.steps.length}
              </p>
              <p className="text-sm text-slate-400 mt-2">
                Sauvegardé le {new Date(item.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}