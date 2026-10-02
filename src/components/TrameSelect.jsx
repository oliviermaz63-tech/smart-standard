import { TRAMES } from "../data/trames";

const DEFAULT_TRAME = "classique";

export default function TrameSelect({ onBack, onSelect }) {
  return (
    <div className="min-h-screen px-6 py-10">
      <div className="max-w-5xl mx-auto">

        <div className="flex items-center justify-between gap-4 mb-6">
          <button onClick={onBack} className="btn-secondary px-4 py-2">
            ← Retour
          </button>
        </div>

        <header className="ss-hero px-8 py-10 text-center mb-10">
          <div className="ss-hero-blob -right-12 -top-12 w-56 h-56" />
          <h1 className="relative z-10 text-3xl font-bold">Choisissez votre trame</h1>
          <p className="relative z-10 mt-3 text-lg text-indigo-50 max-w-2xl mx-auto">
            Le type de trame détermine les informations demandées et la mise en page du standard généré.
          </p>
        </header>

        <div className="grid sm:grid-cols-2 gap-6">
          {Object.entries(TRAMES).map(([key, info]) => (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className="ss-card text-left p-8 border-2 border-transparent hover:border-indigo-500 transition"
            >
              <div className="ss-icon-badge w-14 h-14 text-2xl mb-5">{info.icon}</div>
              <h2 className="text-xl font-bold text-slate-900">{info.label}</h2>
              <p className="mt-3 text-slate-600">{info.description}</p>
            </button>
          ))}
        </div>

        <div className="mt-8 text-center">
          <p className="text-slate-500 mb-3">Pas envie de choisir maintenant ?</p>
          <button
            onClick={() => onSelect(DEFAULT_TRAME)}
            className="btn-secondary px-6 py-3"
          >
            Continuer avec la trame par défaut ({TRAMES[DEFAULT_TRAME].label})
          </button>
        </div>

      </div>
    </div>
  );
}
