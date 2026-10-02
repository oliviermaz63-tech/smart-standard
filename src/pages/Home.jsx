import logo from "../assets/smart-standard-logo.png";

export default function Home({ setView }) {
  return (
    <div className="min-h-screen px-6 py-10 overflow-x-hidden">
      <div className="max-w-3xl mx-auto">

        <div className="flex justify-end mb-4">
          <button
            onClick={() => setView("library")}
            className="btn-secondary px-4 py-2 text-sm"
          >
            📚 Bibliothèque de standards
          </button>
        </div>

        <header className="ss-hero px-8 py-12 text-center">
          <div className="ss-hero-blob -right-16 -top-16 w-72 h-72" />
          <div className="ss-hero-blob right-24 -bottom-16 w-56 h-56" />

          <img
            src={logo}
            alt="Smart Standard"
            className="relative z-10 w-20 h-20 mx-auto rounded-2xl shadow-lg bg-white/10 p-2"
          />

          <h1 className="relative z-10 text-3xl font-bold mt-6">
            Bienvenue dans Smart Standard
          </h1>

          <p className="relative z-10 mt-3 text-lg text-indigo-50">
            Que voulez-vous faire ?
          </p>
        </header>

        <div className="mt-8 grid sm:grid-cols-2 gap-6">

          <div className="ss-card p-8 text-center flex flex-col items-center">
            <div className="ss-icon-badge w-16 h-16 text-3xl mb-6">✍️</div>
            <h2 className="text-2xl font-bold text-slate-900">Créer un standard</h2>
            <p className="mt-3 text-slate-600">
              Choisis une trame, puis rédige-le toi-même ou fais-toi assister par l'IA sur le terrain.
            </p>
            <button
              onClick={() => setView("trame-select")}
              className="btn-primary mt-8 px-8 py-4 text-lg w-full"
            >
              Créer un standard
            </button>
          </div>

          <div className="ss-card p-8 text-center flex flex-col items-center">
            <div className="ss-icon-badge w-16 h-16 text-3xl mb-6">📥</div>
            <h2 className="text-2xl font-bold text-slate-900">Analyser un standard existant</h2>
            <p className="mt-3 text-slate-600">
              Importe un standard existant (PDF, Excel, texte) pour une critique Lean IA.
            </p>
            <button
              onClick={() => setView("import")}
              className="btn-primary mt-8 px-8 py-4 text-lg w-full"
            >
              Analyser un standard existant
            </button>
          </div>

        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Sauvegarde locale automatique activée
        </p>

      </div>
    </div>
  );
}
