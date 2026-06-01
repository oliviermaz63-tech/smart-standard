import CreateStandardCard from "../components/CreateStandardCard.jsx";
import ImportStandardCard from "../components/ImportStandardCard.jsx";

export default function Home({ setView }) {
  return (
    <div className="min-h-screen bg-slate-100 px-6 py-10 overflow-x-hidden">
      <div className="max-w-7xl mx-auto">

        <header className="mb-10">
          <h1 className="text-4xl font-bold text-slate-900">
            Smart Standard
          </h1>

          <p className="mt-2 text-xl text-slate-600">
            Créer un nouveau standard ou améliorer un standard existant
          </p>

          <p className="mt-2 text-sm text-slate-500">
            Sauvegarde locale automatique activée
          </p>
        </header>

        <div className="grid lg:grid-cols-2 gap-6">

          <CreateStandardCard onStart={() => setView("editor")} />

          <ImportStandardCard onImport={() => setView("import")} />

        </div>

        <div className="mt-8">
          <button
            onClick={() => setView("terrain")}
            className="px-6 py-4 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
          >
            📸 Mode Terrain
          </button>
        </div>

      </div>
    </div>
  );
}