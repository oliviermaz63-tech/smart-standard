export default function CreateStandardCard({ onStart }) {
  return (
    <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
      <div className="text-6xl mb-6">✍️</div>

      <h2 className="text-4xl font-bold text-slate-900">
        Créer un nouveau standard
      </h2>

      <p className="mt-6 text-xl text-slate-600">
        Trame, saisie texte/voix, photos, étapes et document imprimable.
      </p>

      <button
        onClick={onStart}
        className="mt-10 px-8 py-5 rounded-2xl bg-slate-950 text-white text-xl font-semibold hover:bg-slate-800 transition"
      >
        Démarrer un nouveau standard
      </button>
    </div>
  );
}