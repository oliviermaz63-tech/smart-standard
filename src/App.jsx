import { useState } from "react";

import Home from "./pages/Home";
import Editor from "./pages/Editor";
import ImportStandard from "./pages/ImportStandard";
import TerrainStandard from "./components/TerrainStandard";

export default function App() {
  const [view, setView] = useState("home");

  if (view === "editor") {
    return <Editor onBack={() => setView("home")} />;
  }

  if (view === "import") {
    return <ImportStandard onBack={() => setView("home")} />;
  }

  if (view === "terrain") {
    return <TerrainStandard />;
  }

  return <Home setView={setView} />;
}