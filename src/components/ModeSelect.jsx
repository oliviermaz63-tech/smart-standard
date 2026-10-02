import { TRAMES } from "../data/trames";

export default function ModeSelect({ trame, onBack, onSelect }) {
  const trameInfo = TRAMES[trame] || TRAMES.classique;

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="max-w-4xl mx-auto">

        <div className="flex items-center justify-between gap-4 mb-6">
          <button onClick={onBack} className="btn-secondary px-4 py-2">
            ← Retour
          </button>
          <p className="text-slate-500 text-sm">
            Trame choisie : <strong className="text-slate-900">{trameInfo.label}</strong>
          </p>
        </div>

        <header className="ss-hero px-8 py-10 text-center mb-10">
          <div className="ss-hero-blob -right-12 -top-12 w-56 h-56" />
          <h1 className="relative z-10 text-3xl font-bold">Comment voulez-vous remplir ce standard ?</h1>
        </header>

        <div className="grid sm:grid-cols-2 gap-6">

          <div className="ss-card p-8 text-center flex flex-col items-center">
            <div className="ss-icon-badge w-16 h-16 text-3xl mb-6">📸</div>
            <h2 className="text-2xl font-bold text-slate-900">Mode Terrain</h2>
            <p className="mt-3 text-slate-600">
              Observations rapides sur le terrain (photos, voix) — l'IA rédige le standard pour toi.
            </p>
            <button
              onClick={() => onSelect("terrain")}
              className="btn-primary mt-8 px-8 py-4 text-lg w-full"
            >
              Mode Terrain
            </button>
          </div>

          <div className="ss-card p-8 text-center flex flex-col items-center">
            <div className="ss-icon-badge w-16 h-16 text-3xl mb-6">✍️</div>
            <h2 className="text-2xl font-bold text-slate-900">Mode manuel</h2>
            <p className="mt-3 text-slate-600">
              Rédige toi-même ton standard, champ par champ, dans le gabarit de la trame choisie.
            </p>
            <button
              onClick={() => onSelect("manuel")}
              className="btn-primary mt-8 px-8 py-4 text-lg w-full"
            >
              Mode manuel
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
