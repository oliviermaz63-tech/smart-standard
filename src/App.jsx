import { useState } from "react";

import Home from "./pages/Home";
import Editor from "./pages/Editor";
import ImportStandard from "./pages/ImportStandard";
import Library from "./pages/Library";
import TerrainStandard from "./components/TerrainStandard";
import TrameSelect from "./components/TrameSelect";
import ModeSelect from "./components/ModeSelect";

export default function App() {
  const [view, setView] = useState("home");
  // Trame choisie au début du parcours "Créer un standard", transportée
  // jusqu'à l'éditeur ou le mode terrain.
  const [selectedTrame, setSelectedTrame] = useState(null);
  // Standard choisi dans la bibliothèque (ou généré en Mode Terrain) pour
  // être (r)ouvert dans l'éditeur.
  const [standardToOpen, setStandardToOpen] = useState(null);

  function resetAndGoHome() {
    setStandardToOpen(null);
    setSelectedTrame(null);
    setView("home");
  }

  if (view === "trame-select") {
    return (
      <TrameSelect
        onBack={() => setView("home")}
        onSelect={(trameKey) => {
          setSelectedTrame(trameKey);
          setView("mode-select");
        }}
      />
    );
  }

  if (view === "mode-select") {
    return (
      <ModeSelect
        trame={selectedTrame}
        onBack={() => setView("trame-select")}
        onSelect={(mode) => setView(mode === "terrain" ? "terrain" : "editor")}
      />
    );
  }

  if (view === "editor") {
    return (
      <Editor
        onBack={resetAndGoHome}
        openStandard={standardToOpen}
        presetTrame={selectedTrame}
      />
    );
  }

  if (view === "import") {
    return <ImportStandard onBack={() => setView("home")} />;
  }

  if (view === "terrain") {
    return (
      <TerrainStandard
        trame={selectedTrame}
        onBack={() => setView("mode-select")}
        onGenerated={(generatedStandard) => {
          setStandardToOpen(generatedStandard);
          setView("editor");
        }}
      />
    );
  }

  if (view === "library") {
    return (
      <Library
        onBack={() => setView("home")}
        onOpenStandard={(entry) => {
          setStandardToOpen(entry);
          setView("editor");
        }}
      />
    );
  }

  return <Home setView={setView} />;
}
