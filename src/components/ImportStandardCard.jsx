export default function ImportStandardCard({ onImport }) {
  return (
    <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
      <div className="text-6xl mb-6">📥</div>

      <h2 className="text-4xl font-bold text-slate-900">
        Importer un standard existant
      </h2>

      <p className="mt-6 text-xl text-slate-600">
        Lire, critiquer, scorer puis passer un standard en Mode Terrain.
      </p>

      <button
        onClick={onImport}
        className="mt-10 px-8 py-5 rounded-2xl bg-slate-950 text-white text-xl font-semibold hover:bg-slate-800 transition"
      >
        Analyser un standard existant
      </button>
    </div>
  );
}