import { useEffect, useState } from "react";

export default function StandardsLibrary() {

  const [standards, setStandards] = useState([]);

  useEffect(() => {

    const saved =
      JSON.parse(localStorage.getItem("smartstandards")) || [];

    setStandards(saved);

  }, []);





  function deleteStandard(id) {

    const updated =
      standards.filter((s) => s.id !== id);

    localStorage.setItem(
      "smartstandards",
      JSON.stringify(updated)
    );

    setStandards(updated);
  }





  return (

    <div className="bg-white rounded-3xl border shadow-sm p-6">

      <div className="flex justify-between items-center mb-6">

        <div>
          <h2 className="text-3xl font-bold">
            📚 Bibliothèque Smart Standards
          </h2>

          <p className="text-slate-500 mt-1">
            Historique des standards générés
          </p>
        </div>

      </div>





      {standards.length === 0 && (

        <div className="text-center py-20 text-slate-400">

          <p className="text-6xl">📄</p>

          <p className="mt-4 text-lg">
            Aucun standard sauvegardé
          </p>

        </div>

      )}






      <div className="grid xl:grid-cols-3 md:grid-cols-2 gap-5">

        {standards.map((standard) => (

          <div
            key={standard.id}
            className="border rounded-2xl overflow-hidden hover:shadow-lg transition bg-white"
          >

            <div className="bg-slate-950 text-white p-5">

              <p className="uppercase text-xs tracking-widest text-slate-400">
                Smart Standard
              </p>

              <h3 className="text-xl font-bold mt-2">
                {standard.result?.general?.title}
              </h3>

            </div>





            <div className="p-5 space-y-3">

              <div>
                <p className="text-xs uppercase text-slate-400 font-bold">
                  Zone
                </p>

                <p className="font-semibold">
                  {standard.result?.general?.zone}
                </p>
              </div>





              <div>
                <p className="text-xs uppercase text-slate-400 font-bold">
                  Machine
                </p>

                <p className="font-semibold">
                  {standard.result?.general?.machine}
                </p>
              </div>





              <div className="flex justify-between items-center">

                <div>

                  <p className="text-xs uppercase text-slate-400 font-bold">
                    Score IA
                  </p>

                  <p className="font-bold text-lg">
                    {standard.result?.validation?.score}%
                  </p>

                </div>





                <div className={`px-4 py-2 rounded-full text-sm font-bold ${
                  standard.result?.validation?.status === "OK"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}>

                  {standard.result?.validation?.status}

                </div>

              </div>





              <div className="pt-4 flex gap-3">

                <button
                  onClick={() => window.print()}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold"
                >
                  PDF
                </button>





                <button
                  onClick={() => deleteStandard(standard.id)}
                  className="px-4 bg-red-100 text-red-700 rounded-xl font-bold"
                >
                  ✕
                </button>

              </div>

            </div>

          </div>

        ))}

      </div>

    </div>
  );
}