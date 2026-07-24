export default function GeneratedStandard({
  result,
  inputSteps,
  onSave,
}) {

  if (!result) return null;

  const isOk =
    result.validation?.status === "OK";





  function printStandard() {
    window.print();
  }





  return (

    <div className="mt-10 space-y-8">




      <div className={`rounded-3xl border overflow-hidden shadow-sm ${
        isOk
          ? "border-green-300"
          : "border-red-300"
      }`}>

        <div className={`px-6 py-5 flex flex-wrap justify-between items-center gap-4 ${
          isOk
            ? "bg-green-50"
            : "bg-red-50"
        }`}>

          <div>

            <p className="uppercase tracking-widest text-xs font-bold text-slate-500">
              Smart Standard AI Validation
            </p>

            <h2 className="text-3xl font-black mt-2">
              {result.validation?.status === "OK"
                ? "✅ Validation terrain acceptable"
                : "❌ Validation terrain insuffisante"}
            </h2>

          </div>





          <div className="text-right">

            <p className="text-sm text-slate-500 font-bold uppercase">
              Score IA
            </p>

            <p className={`text-5xl font-black ${
              result.validation?.score >= 80
                ? "text-green-600"
                : result.validation?.score >= 70
                ? "text-orange-500"
                : "text-red-600"
            }`}>

              {result.validation?.score}%

            </p>

          </div>

        </div>





        <div className="bg-white p-6">

          {result.validation?.problems?.length > 0 && (

            <div>

              <h3 className="text-xl font-bold mb-3">
                ⚠️ Problèmes détectés
              </h3>

              <ul className="list-disc pl-6 space-y-2">

                {result.validation.problems.map((problem, index) => (

                  <li key={index}>
                    {problem}
                  </li>

                ))}

              </ul>

            </div>

          )}






          {result.validation?.weakWords?.length > 0 && (

            <div className="mt-8">

              <h3 className="text-xl font-bold mb-4">
                🧠 Formulations faibles détectées
              </h3>

              <div className="grid xl:grid-cols-2 gap-4">

                {result.validation.weakWords.map((word, index) => (

                  <div
                    key={index}
                    className="border rounded-2xl p-5 bg-slate-50"
                  >

                    <div className="flex justify-between items-start gap-4">

                      <div>

                        <p className="font-black text-red-600 text-lg">
                          {word.word}
                        </p>

                        <p className="mt-2 text-slate-700">
                          {word.whyProblem}
                        </p>

                      </div>

                    </div>





                    <div className="mt-4 bg-white border rounded-xl p-4">

                      <p className="text-sm uppercase tracking-widest text-slate-400 font-bold">
                        Clarification attendue
                      </p>

                      <p className="mt-2">
                        {word.requiredClarification}
                      </p>

                    </div>

                  </div>

                ))}

              </div>

            </div>

          )}

        </div>

      </div>





      {result.steps?.length > 0 && (

        <div
          id="standard-print"
          className="bg-white border rounded-3xl overflow-hidden shadow-sm print:shadow-none print:border-0 print:bg-white"
        >





          <div className="bg-slate-950 text-white p-8">

            <div className="flex justify-between items-start gap-6">

              <div>

                <p className="uppercase tracking-[0.3em] text-xs text-slate-400 font-bold">
                  Smart Standard
                </p>

                <h1 className="text-5xl font-black mt-3">
                  STANDARD DE TRAVAIL
                </h1>

                <p className="text-slate-400 mt-4 max-w-3xl text-lg">
                  Génération automatique IA à partir d'observations terrain.
                </p>

              </div>





              <div className="bg-white/10 rounded-2xl p-5 min-w-[240px]">

                <p className="uppercase text-xs tracking-widest text-slate-400 font-bold">
                  Niveau de confiance
                </p>

                <p className="text-6xl font-black mt-3">
                  {result.validation?.score}%
                </p>

                <div className="mt-4 text-sm space-y-1 text-slate-300">

                  <p>Version : V1 Smart Standard</p>

                  <p>
                    Statut :
                    {" "}
                    {result.validation?.status}
                  </p>

                  <p>
                    Date :
                    {" "}
                    {new Date().toLocaleDateString()}
                  </p>

                </div>

              </div>

            </div>

          </div>






          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-200 border-b print:border-slate-400">

            <div className="bg-white p-4">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-1">
                Usine
              </p>
              <input
                type="text"
                defaultValue=""
                placeholder="À compléter"
                className="w-full bg-transparent font-bold outline-none placeholder:font-normal placeholder:text-slate-400"
              />
            </div>

            <div className="bg-white p-4">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-1">
                N° document
              </p>
              <input
                type="text"
                defaultValue=""
                placeholder="À compléter"
                className="w-full bg-transparent font-bold outline-none placeholder:font-normal placeholder:text-slate-400"
              />
            </div>

            <div className="bg-white p-4">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-1">
                Révision
              </p>
              <input
                type="text"
                defaultValue="V1"
                className="w-full bg-transparent font-bold outline-none"
              />
            </div>

            <div className="bg-white p-4">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-1">
                Page
              </p>
              <p className="font-bold">1 / 1</p>
            </div>

            <div className="bg-white p-4">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-1">
                Aire / Zone
              </p>
              <p className="font-bold">{result.general?.zone || "-"}</p>
            </div>

            <div className="bg-white p-4">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-1">
                Station de travail
              </p>
              <p className="font-bold">{result.general?.machine || "-"}</p>
            </div>

            <div className="bg-white p-4 col-span-2">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-1">
                Objectif
              </p>
              <p className="font-bold">{result.general?.objective || "-"}</p>
            </div>

          </div>


          <div className="p-8 bg-white">

            <div className="flex justify-end gap-3 mb-6 print:hidden">

              <button
                onClick={onSave}
                className="px-6 py-4 rounded-2xl bg-slate-900 text-white font-bold"
              >
                💾 Sauvegarder
              </button>





              <button
                onClick={printStandard}
                className="px-6 py-4 rounded-2xl bg-blue-600 text-white font-bold"
              >
                🖨️ PDF
              </button>

            </div>





            <table className="w-full border-collapse text-sm">

              <thead>

                <tr className="bg-white">

                  <th
                    colSpan="11"
                    className="border text-center text-3xl font-black py-6"
                  >
                    STANDARD DE TRAVAIL
                  </th>

                </tr>





                <tr className="bg-slate-100">

                  <th
                    colSpan="3"
                    className="border p-4 text-left text-lg font-black"
                  >
                    Type de standard
                  </th>

                  <th
                    colSpan="8"
                    className="border p-4 text-left text-lg font-black"
                  >
                    Description du travail
                  </th>

                </tr>





                <tr>

                  <td
                    colSpan="3"
                    className="border p-4 font-bold bg-white"
                  >
                    Standard opératoire
                  </td>

                  <td
                    colSpan="8"
                    className="border p-4 bg-white"
                  >
                    {result.general?.title}
                  </td>

                </tr>





                <tr className="bg-slate-950 text-white">

                  <th className="border p-3 w-[70px]">
                    No.
                  </th>

                  <th
                    colSpan="8"
                    className="border p-3"
                  >
                    Opération
                  </th>

                  <th
                    colSpan="3"
                    className="border p-3"
                  >
                    Sécu / Qualité / Compétence
                  </th>

                </tr>

              </thead>





              <tbody>

                {result.steps?.map((step, index) => (

                  <tr
                    key={index}
                    className="align-top"
                  >

                    <td className="border p-4 text-center font-black text-2xl">
                      {step.number || index + 1}
                    </td>





                    <td
                      colSpan="4"
                      className="border p-4"
                    >

                      <div className="space-y-4">

                        <div>

                          <p className="font-black text-lg mb-3">
                            Opération
                          </p>

                          <p className="leading-7 text-base">
                            {step.operation}
                          </p>

                        </div>





                        <div className="grid grid-cols-2 gap-4">

                          <div>

                            <p className="font-black text-green-700 mb-2">
                              Critère OK
                            </p>

                            <div className="border rounded-xl p-3 bg-green-50 min-h-[90px]">
                              {step.okCriteria || "À préciser"}
                            </div>

                          </div>





                          <div>

                            <p className="font-black text-red-700 mb-2">
                              Critère NOK
                            </p>

                            <div className="border rounded-xl p-3 bg-red-50 min-h-[90px]">
                              {step.nokCriteria || "À préciser"}
                            </div>

                          </div>

                        </div>

                      </div>

                    </td>





                    <td
                      colSpan="4"
                      className="border p-4"
                    >

                      <div className="grid grid-cols-3 gap-3">

                        <Photo
                          label="Terrain"
                          src={inputSteps?.[index]?.preview}
                        />

                        <Photo
                          label="OK"
                          src={inputSteps?.[index]?.okPreview}
                        />

                        <Photo
                          label="NOK"
                          src={inputSteps?.[index]?.nokPreview}
                        />

                      </div>

                    </td>





                    <td className="border p-4 bg-red-50">

                      <p className="font-black text-red-700 mb-2">
                        Sécurité
                      </p>

                      <p className="text-sm leading-6">
                        {step.safety || "-"}
                      </p>

                    </td>





                    <td className="border p-4 bg-blue-50">

                      <p className="font-black text-blue-700 mb-2">
                        Qualité
                      </p>

                      <p className="text-sm leading-6">
                        {step.quality || "-"}
                      </p>

                    </td>





                    <td className="border p-4 bg-amber-50">

                      <p className="font-black text-amber-700 mb-2">
                        Compétence
                      </p>

                      <p className="text-sm leading-6">
                        Formation requise / validation terrain
                      </p>

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>






          <div className="bg-white p-8 border-t print:border-slate-400">

            <p className="uppercase tracking-widest text-xs font-bold text-slate-500 mb-4">
              Règles de non-conformité et validation
            </p>

            <div className="grid md:grid-cols-2 gap-4 mb-8 text-sm">

              <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                <p className="font-black text-red-700 mb-2">Qualité — réaction en cas d'écart</p>
                <ul className="list-disc pl-5 space-y-1">
                  {result.steps?.filter((s) => s.reaction).map((s, i) => (
                    <li key={i}>{s.reaction}</li>
                  ))}
                  {!result.steps?.some((s) => s.reaction) && (
                    <li>À préciser lors de la validation terrain.</li>
                  )}
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <p className="font-black text-amber-700 mb-2">Recommandations avant diffusion</p>
                <ul className="list-disc pl-5 space-y-1">
                  {result.validation?.recommendationsBeforeUse?.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                  {!result.validation?.recommendationsBeforeUse?.length && (
                    <li>Aucune recommandation particulière.</li>
                  )}
                </ul>
              </div>

            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">

              <div>
                <p className="font-bold mb-6">Écrit par</p>
                <p className="border-t pt-2 text-slate-400">Signature :</p>
              </div>

              <div>
                <p className="font-bold mb-6">Vérifié par</p>
                <p className="border-t pt-2 text-slate-400">Signature :</p>
              </div>

              <div>
                <p className="font-bold mb-6">Approuvé par</p>
                <p className="border-t pt-2 text-slate-400">Signature :</p>
              </div>

              <div>
                <p className="font-bold mb-6">Opérateur expérimenté</p>
                <p className="border-t pt-2 text-slate-400">Signature :</p>
              </div>

            </div>

          </div>




          <div className="bg-slate-950 text-slate-300 p-6 text-sm flex justify-between print:hidden">

            <div>
              Smart Standard © — Génération IA de standards industriels
            </div>

            <div>
              Validation terrain obligatoire avant diffusion
            </div>

          </div>

        </div>

      )}

    </div>
  );
}





function Photo({
  label,
  src,
}) {

  return (

    <div className="border rounded-xl overflow-hidden bg-slate-50">

      <div className="bg-slate-100 text-center text-xs font-black py-2">
        {label}
      </div>





      {src ? (

        <img
          src={src}
          alt=""
          className="w-full h-40 object-cover"
        />

      ) : (

        <div className="h-40 flex items-center justify-center text-slate-400">
          Photo
        </div>

      )}

    </div>

  );
}