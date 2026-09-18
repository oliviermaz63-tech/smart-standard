import { useState } from "react";

import Home from "./pages/Home";
import Editor from "./pages/Editor";
import ImportStandard from "./pages/ImportStandard";
import Library from "./pages/Library";
import TerrainStandard from "./components/TerrainStandard";

export default function App() {
  const [view, setView] = useState("home");
  // Standard choisi dans la bibliothèque pour être rouvert dans l'éditeur.
  const [standardToOpen, setStandardToOpen] = useState(null);

  if (view === "editor") {
    return (
      <Editor
        onBack={() => {
          setStandardToOpen(null);
          setView("home");
        }}
        openStandard={standardToOpen}
      />
    );
  }

  if (view === "import") {
    return <ImportStandard onBack={() => setView("home")} />;
  }

  if (view === "terrain") {
    return <TerrainStandard />;
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