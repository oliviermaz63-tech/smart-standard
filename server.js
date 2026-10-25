import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { aiComplete, currentProvider } from "./aiProvider.js";
import rateLimit from "express-rate-limit";

dotenv.config();

const app = express();
// Railway place un proxy devant le serveur : sans ceci, toutes les requêtes
// semblent venir de la même IP et la limite de débit serait partagée.
app.set("trust proxy", 1);

/* =======================================================
   PROTECTION DE L'API
   -------------------------------------------------------
   Ce backend appelle OpenAI (donc coûte de l'argent à chaque
   requête). Sans protection, n'importe qui trouvant l'URL
   Railway pouvait appeler les endpoints sans limite. Trois
   protections complémentaires, aucune n'étant suffisante seule :

   1. CORS restreint : seules les origines listées dans
      ALLOWED_ORIGINS (+ localhost en dev) peuvent appeler l'API
      depuis un navigateur.
   2. Clé d'application partagée (APP_SHARED_KEY) : le frontend
      doit envoyer un header X-App-Key correspondant. Ce n'est PAS
      un vrai secret (elle est visible dans le JS livré au
      navigateur), mais elle bloque les appels directs "au hasard"
      (scripts, scans automatiques) qui ne passent pas par l'appli.
   3. Limite de débit : un nombre de requêtes IA par adresse IP,
      pour plafonner l'impact d'un abus même avec la clé.

   Tant que APP_SHARED_KEY n'est pas défini côté serveur (Railway),
   la vérification de clé est désactivée (pour ne pas casser l'appli
   avant que la variable soit configurée des deux côtés — voir
   .env.example pour l'ordre de déploiement à respecter).
======================================================= */

const allowedOrigins = (
  process.env.ALLOWED_ORIGINS || "https://smart-standard.vercel.app"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Requêtes sans origine (curl, Postman, appels serveur-à-serveur) :
      // on les laisse passer, elles ne sont de toute façon pas soumises
      // à la politique CORS des navigateurs.
      if (!origin) return callback(null, true);
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origine non autorisée par CORS"));
    },
  })
);

// Sans ce gestionnaire, une origine refusée par CORS remonte comme une
// erreur Express générique (page HTML avec la stack trace du serveur).
// On répond ici proprement en JSON, sans exposer de détails internes.
app.use((err, req, res, next) => {
  if (err && err.message === "Origine non autorisée par CORS") {
    return res.status(403).json({ result: "Origine non autorisée." });
  }
  next(err);
});

app.use(express.json({ limit: "10mb" }));

function requireAppKey(req, res, next) {
  const expectedKey = process.env.APP_SHARED_KEY;
  // Pas encore configuré côté serveur : on ne bloque personne (voir
  // .env.example pour activer cette protection en toute sécurité).
  if (!expectedKey) return next();

  const providedKey = req.header("x-app-key");
  if (providedKey !== expectedKey) {
    return res.status(401).json({ result: "Accès non autorisé." });
  }
  next();
}

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 30, // 30 requêtes IA par adresse IP et par heure
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    result:
      "Trop de requêtes IA depuis cette adresse ces dernières minutes, réessaie plus tard.",
  },
});

app.use("/api/", aiLimiter, requireAppKey);

/* =======================================================
   ANALYSE STANDARD EXISTANT
======================================================= */

app.post("/api/analyze-imported-standard", async (req, res) => {
  try {
    const { importedText } = req.body;

    const completion = await aiComplete({
      tier: "fast",
      json: false,
      maxTokens: 4000,
      messages: [
        {
          role: "system",
          content: `
Tu es un expert Lean Manufacturing, standards terrain, qualité industrielle et auditabilité.

Tu analyses un standard existant.

Tu dois être exigeant : un standard vague, non visuel ou non objectivable doit être pénalisé.

Règles clés :
- Un bon standard doit être clair, visuel, observable, auditables.
- Les critères doivent être mesurables ou illustrés.
- Les formulations vagues sont interdites.
- Un contrôle visuel doit idéalement contenir des exemples OK / NOK.
- Ne jamais valoriser un standard qui paraît propre mais reste interprétable.

Mots faibles à détecter et pénaliser :
- défaut
- conforme
- non conforme
- correct
- correctement
- propre
- bon état
- vérifier
- contrôler
- s'assurer que
- si nécessaire
- au besoin
- attention à
- soigneusement
- adapté
- acceptable
- important
- rapide
- régulièrement

Pour chaque mot faible détecté :
- expliquer pourquoi il pose problème
- proposer une reformulation robuste
- demander si besoin un seuil, une photo OK/NOK ou un critère mesurable

Réponds en français avec :
1. Résumé
2. Points forts
3. Faiblesses terrain
4. Mots faibles détectés
5. Risques sécurité / qualité / formation / auditabilité
6. Score de maturité sur 100
7. Recommandations concrètes
8. Questions terrain à clarifier
`,
        },
        {
          role: "user",
          content: importedText,
        },
      ],
    });

    res.json({
      result: completion,
    });
  } catch (error) {
    console.error("Erreur import IA :", error);
    res.status(500).json({
      result: "Erreur IA import standard.",
    });
  }
});

// Consignes spécifiques par trame, partagées par la génération depuis
// des étapes saisies (mode terrain) et depuis une vidéo.
const TRAME_GUIDANCE = {
  classique:
    "Trame CLASSIQUE : priorise standard.safety, standard.quality, standard.materials, standard.control (consignes générales), et pour chaque step remplis title, description, safety, quality, duration.",
  instruction_travail:
    "Trame INSTRUCTION DE TRAVAIL : format compact fiche de poste. Remplis standard.reference et standard.date si déductibles, et pour chaque step remplis surtout title, description et duration (temps estimé si déductible, sinon laisse vide).",
  gamme_nettoyage:
    "Trame GAMME DE NETTOYAGE : remplis standard.unite, standard.equipements (avec la machine/poste fournie), standard.periodicite si déductible. Pour chaque step remplis title, description, conditions (ex: 'OC' = organe en contact, 'A' = autour), tooling (matériel de nettoyage utilisé), outOfStandard (action corrective si hors standard).",
  mode_operatoire:
    "Trame MODE OPÉRATOIRE : plusieurs opérateurs se partagent les opérations. Remplis standard.operators (liste de noms d'opérateurs, déduis-en un nombre raisonnable si non précisé, ex: ['Opérateur A','Opérateur B']). Pour chaque step remplis title, description, operatorFlags (tableau de booléens de la même longueur que standard.operators, true pour les opérateurs concernés par cette étape), category ('ehs' ou 'quality' ou vide), keyPoints (point clé à retenir).",
};

/* =======================================================
   GENERATION STANDARD MODE TERRAIN JSON
======================================================= */

app.post("/api/generate-terrain-standard", async (req, res) => {
  try {
    const { title, zone, machine, objective, steps, trame } = req.body;
    const trameKey = trame || "classique";

    const terrainData = `
TRAME CHOISIE : ${trameKey}

TITRE :
${title}

ZONE :
${zone}

MACHINE / POSTE :
${machine}

OBJECTIF :
${objective}

ETAPES TERRAIN (observations brutes de l'opérateur, un objet par étape) :
Chaque étape a une description texte, et trois indicateurs booléens
(hasPhotoTerrain, hasPhotoOK, hasPhotoNOK) qui précisent si l'opérateur a
pris une photo terrain / une photo de référence OK / une photo de référence
NOK pour cette étape - tu ne reçois jamais les photos elles-mêmes, seulement
le fait qu'elles existent ou non, à utiliser pour juger si un contrôle visuel
dispose bien d'une référence photo.
${JSON.stringify(steps, null, 2)}
`;

    const completion = await aiComplete({
      tier: "fast",
      json: true,
      maxTokens: 6000,
      messages: [
        {
          role: "system",
          content: `
Tu es le moteur IA de Smart Standard.

Tu es un expert Lean Manufacturing, standards terrain, qualité industrielle, sécurité, formation opérateur et auditabilité.

OBJECTIF :
Transformer des observations terrain en standard atelier robuste.

RÈGLE ABSOLUE :
Tu ne dois JAMAIS inventer une opération, un critère qualité, un seuil ou une condition non présente dans les données terrain.

Tu dois d'abord évaluer la qualité des données.
Si les données sont insuffisantes, tu bloques la génération.

CRITÈRES D'ÉVALUATION :

1. Données exploitables
- présence d'au moins 2 étapes concrètes
- description compréhensible
- logique opérationnelle
- vocabulaire métier minimum

2. Niveau de précision
Tu dois pénaliser :
- les phrases génériques
- les verbes seuls comme "contrôler", "vérifier", "faire"
- les critères non mesurables
- les contrôles sans limite d'acceptation
- les mots vagues

3. Mots faibles interdits ou à challenger :
- défaut
- défauts
- conforme
- non conforme
- correct
- correctement
- propre
- bon état
- vérifier
- contrôler
- s'assurer que
- si nécessaire
- au besoin
- attention à
- soigneusement
- adapté
- acceptable
- important
- rapide
- régulièrement

Ces mots ne sont pas toujours interdits dans l'absolu, mais ils doivent être pénalisés s'ils ne sont pas accompagnés :
- d'un seuil mesurable
- d'une photo OK / NOK
- d'une tolérance
- d'un exemple concret
- d'une méthode de contrôle précise

EXEMPLE :
"Contrôler absence de rayure, bavure et défaut de surface"
=> insuffisant.
Pourquoi :
- "défaut de surface" est vague
- rayure : taille acceptable non définie
- bavure : critère non défini
- pas de photo OK/NOK
- pas de condition d'observation

Reformulation attendue :
"Contrôler sous éclairage LED à 30 cm l'absence de rayure visible, bavure coupante au toucher avec gant nitrile, ou impact supérieur à la limite définie par photo NOK de référence."

Mais si ces critères ne sont PAS dans les données terrain, tu ne dois pas les inventer.
Tu dois les demander dans les problèmes à clarifier.

4. Photos
Si une étape parle de contrôle visuel, aspect, défaut, rayure, bavure, couleur, position, montage ou orientation :
- pénaliser si aucune photo OK/NOK n'est mentionnée
- recommander photo OK et photo NOK

5. Score de confiance
- 0 à 40 : données incohérentes ou non exploitables
- 40 à 59 : données compréhensibles mais trop pauvres
- 60 à 74 : générable mais validation terrain forte nécessaire
- 75 à 89 : bon niveau, quelques compléments nécessaires
- 90 à 100 : seulement si données très précises, critères objectifs, logique claire, photos ou références visuelles suffisantes

IMPORTANT :
Ne mets jamais 90 ou plus si :
- il manque des critères OK/NOK
- il y a des mots faibles non levés
- il manque des seuils
- il manque des photos pour un contrôle visuel
- les réactions anomalies sont absentes

VALIDATION (mode test) :
Si score < 70, statut = ECHEC.
Génère quand même le standard à partir des données disponibles, en indiquant clairement les manques et limites dans "problems" et "missingData". Ne bloque jamais complètement la génération.

Si score >= 70, statut = OK.
Tu peux générer le standard, mais tu dois garder les limites visibles.

CONSIGNE SPÉCIFIQUE À LA TRAME CHOISIE :
${TRAME_GUIDANCE[trameKey] || TRAME_GUIDANCE.classique}

Le standard généré doit respecter le format ci-dessous, qui est le même format que celui utilisé par l'éditeur manuel de Smart Standard (pour que ce standard soit ensuite modifiable et exportable en Word/Excel exactement comme un standard rédigé à la main). Ne remplis que les champs pertinents pour la trame choisie ci-dessus ; laisse les autres en chaîne vide "" (ou tableau vide []). N'invente jamais de valeur pour un champ que les données terrain ne permettent pas de déduire : laisse-le vide plutôt que de l'inventer.

FORMAT JSON STRICT :

{
  "validation": {
    "status": "OK ou ECHEC",
    "score": 0,
    "problems": [],
    "weakWords": [
      {
        "word": "...",
        "where": "...",
        "whyProblem": "...",
        "requiredClarification": "..."
      }
    ],
    "missingData": [],
    "recommendationsBeforeUse": []
  },
  "standard": {
    "title": "...",
    "zone": "...",
    "owner": "",
    "reference": "",
    "date": "",
    "objective": "...",
    "safety": "",
    "quality": "",
    "materials": "",
    "control": "",
    "unite": "",
    "equipements": "",
    "periodicite": "",
    "autres": "",
    "accordResponsable": "",
    "operators": ["Opérateur A", "Opérateur B"]
  },
  "steps": [
    {
      "title": "Titre court de l'opération",
      "description": "...",
      "safety": "",
      "quality": "",
      "duration": "",
      "conditions": "",
      "tooling": "",
      "outOfStandard": "",
      "operatorFlags": [false, false],
      "category": "",
      "keyPoints": ""
    }
  ]
}

Le tableau "steps" doit contenir exactement une entrée par étape terrain fournie en entrée, dans le même ordre.

Réponds uniquement en JSON valide.
`,
        },
        {
          role: "user",
          content: terrainData,
        },
      ],
    });

    const result = JSON.parse(completion);
    res.json(result);
  } catch (error) {
    console.error("Erreur terrain IA :", error);

    res.status(500).json({
      validation: {
        status: "ECHEC",
        score: 0,
        problems: ["Erreur serveur IA"],
        weakWords: [],
        missingData: ["Impossible de générer le standard"],
        recommendationsBeforeUse: [],
      },
      standard: {},
      steps: [],
    });
  }
});

/* =======================================================
   AMELIORATION STANDARD
======================================================= */

app.post("/api/improve-standard", async (req, res) => {
  try {
    const { standard, steps, mode } = req.body;

    const standardData = `
STANDARD :
${JSON.stringify(standard, null, 2)}

ETAPES :
${JSON.stringify(steps, null, 2)}
`;

    let systemPrompt = "";

    if (mode === "quick") {
      systemPrompt = `
Tu es un expert Lean Manufacturing.
Fais une analyse rapide mais exigeante.

Tu dois détecter :
- mots faibles
- critères non objectivables
- manque de photos OK/NOK
- manque de réaction anomalie
- risques sécurité / qualité

Réponds avec :
1. Points forts
2. Points faibles
3. Mots faibles détectés
4. Risques principaux
5. 3 améliorations prioritaires
6. Score sur 100
`;
    } else if (mode === "expert") {
      systemPrompt = `
Tu es un expert Lean Manufacturing, excellence opérationnelle, qualité industrielle et audit.

Analyse très approfondie :
1. Diagnostic général
2. Points forts
3. Risques terrain
4. Mots faibles détectés
5. Analyse Lean détaillée
6. MUDA détectés
7. Risques qualité
8. Risques sécurité
9. Risques formation / auditabilité
10. Recommandations détaillées
11. Score sur 100
12. Version améliorée
13. Questions terrain à clarifier

Sois très exigeant.
Un standard vague ne doit jamais recevoir un bon score.
`;
    } else {
      systemPrompt = `
Tu es un expert Lean Manufacturing.
Analyse ce standard :
1. Diagnostic général
2. Points forts
3. Points faibles
4. Mots faibles détectés
5. Analyse Lean
6. Recommandations
7. Score sur 100
8. Conclusion
`;
    }

    const completion = await aiComplete({
      tier: "fast",
      json: false,
      maxTokens: 6000,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: standardData,
        },
      ],
    });

    res.json({
      result: completion,
    });
  } catch (error) {
    console.error("Erreur IA :", error);

    res.status(500).json({
      result: "Erreur IA serveur.",
    });
  }
});

/* =======================================================
   GENERATION STANDARD A PARTIR D'UNE VIDEO
   -------------------------------------------------------
   Le navigateur extrait quelques images clés de la vidéo (la vidéo
   elle-même n'est jamais envoyée) et les envoie ici, dans l'ordre
   chronologique. L'IA les regarde, déduit les opérations et rédige le
   standard ; pour chaque étape elle indique quelle image l'illustre
   (frameIndex), que le navigateur rattache ensuite comme photo terrain.
======================================================= */

const MAX_VIDEO_FRAMES = 16;
const MAX_FRAME_CHARS = 600_000; // ~450 Ko par image en base64

app.post("/api/generate-from-video", async (req, res) => {
  try {
    const { title, zone, machine, objective, notes, trame, frames, frameTimes } = req.body;
    const trameKey = trame || "classique";

    if (
      !Array.isArray(frames) ||
      frames.length < 2 ||
      frames.length > MAX_VIDEO_FRAMES ||
      frames.some(
        (f) =>
          typeof f !== "string" ||
          !f.startsWith("data:image/jpeg;base64,") ||
          f.length > MAX_FRAME_CHARS
      )
    ) {
      return res.status(400).json({
        validation: {
          status: "ECHEC",
          score: 0,
          problems: ["Images de la vidéo invalides ou trop nombreuses"],
          weakWords: [],
          missingData: [],
          recommendationsBeforeUse: [],
        },
        standard: {},
        steps: [],
      });
    }

    const times = Array.isArray(frameTimes) ? frameTimes : [];
    const context = `
TRAME CHOISIE : ${trameKey}

CONTEXTE FOURNI PAR L'UTILISATEUR (peut être vide) :
- Titre : ${title || "non précisé"}
- Zone : ${zone || "non précisée"}
- Machine / poste : ${machine || "non précisé"}
- Objectif : ${objective || "non précisé"}
- Notes de l'opérateur sur la vidéo : ${notes || "aucune"}

Les ${frames.length} images ci-dessous sont extraites d'une vidéo de l'opération, dans l'ordre chronologique.
Numérotation : image 0 à image ${frames.length - 1}${
      times.length === frames.length
        ? ` (instants en secondes : ${times.map((t, i) => `${i}=${Number(t).toFixed(1)}s`).join(", ")})`
        : ""
    }.
`;

    const userContent = [{ type: "text", text: context }];
    frames.forEach((frame, i) => {
      userContent.push({ type: "text", text: `Image ${i} :` });
      userContent.push({ type: "image_url", image_url: { url: frame, detail: "auto" } });
    });

    const completion = await aiComplete({
      tier: "smart",
      json: true,
      maxTokens: 6000,
      messages: [
        {
          role: "system",
          content: `
Tu es le moteur IA de Smart Standard, expert Lean Manufacturing, standards terrain, sécurité, qualité et formation opérateur.

TÂCHE :
À partir d'images extraites d'une vidéo d'opération, rédiger un standard opérationnel exploitable.

RÈGLES ABSOLUES :
- Tu ne décris et ne retiens QUE ce qui est visible sur les images ou fourni par l'utilisateur. Tu n'inventes jamais un seuil, une durée, une référence, un outil ou un critère qui n'est pas visible ou fourni.
- Ce qui ne se voit pas (durées, tolérances, couples, réglages, cadence, consignes implicites) reste vide dans les champs, et tu le listes dans "missingData" avec la question à poser à l'opérateur.
- Les équipements de protection visibles (gants, lunettes, chaussures...) peuvent être cités en sécurité. Un risque évident visible (pièce coupante, partie en mouvement) peut être signalé, mais ne mets pas de consigne chiffrée.
- Regroupe les images consécutives qui montrent la même action en UNE étape. Vise entre 3 et 10 étapes, dans l'ordre chronologique de la vidéo, avec des verbes d'action précis.
- Pour chaque étape, "frameIndex" = numéro de l'image la plus nette et la plus représentative de l'action (photo terrain). "okFrameIndex" / "nokFrameIndex" : mets un numéro SEULEMENT si une image montre clairement l'état conforme / non conforme attendu ; sinon null.
- Si la vidéo est inexploitable (trop sombre, sans opération visible), mets un score < 40 et explique-le dans "problems".

ÉVALUATION :
Score de confiance 0-100. Pénalise : critères non mesurables (aucun seuil visible), absence de références OK/NOK, étapes ambiguës, mots faibles (vérifier, contrôler, correctement, propre, si nécessaire...). Jamais 90+ à partir d'une vidéo seule. Si score < 70 statut ECHEC, sinon OK ; génère toujours le standard dans les deux cas.

CONSIGNE SPÉCIFIQUE À LA TRAME CHOISIE :
${TRAME_GUIDANCE[trameKey] || TRAME_GUIDANCE.classique}

FORMAT JSON STRICT (ne remplis que les champs pertinents pour la trame ; laisse "" ou [] sinon) :
{
  "validation": {
    "status": "OK ou ECHEC",
    "score": 0,
    "problems": [],
    "weakWords": [{ "word": "...", "where": "...", "whyProblem": "...", "requiredClarification": "..." }],
    "missingData": [],
    "recommendationsBeforeUse": []
  },
  "standard": {
    "title": "...", "zone": "...", "owner": "", "reference": "", "date": "",
    "objective": "...", "safety": "", "quality": "", "materials": "", "control": "",
    "unite": "", "equipements": "", "periodicite": "", "autres": "", "accordResponsable": "",
    "operators": ["Opérateur A", "Opérateur B"]
  },
  "steps": [
    {
      "title": "Titre court de l'opération",
      "description": "...",
      "safety": "", "quality": "", "duration": "",
      "conditions": "", "tooling": "", "outOfStandard": "",
      "operatorFlags": [false, false], "category": "", "keyPoints": "",
      "frameIndex": 0, "okFrameIndex": null, "nokFrameIndex": null
    }
  ]
}

Réponds uniquement en JSON valide, en français.
`,
        },
        { role: "user", content: userContent },
      ],
    });

    const result = JSON.parse(completion);
    // Sécurise les indices d'images renvoyés par l'IA (entiers dans la
    // plage des images reçues, sinon null).
    const safeIndex = (v) =>
      Number.isInteger(v) && v >= 0 && v < frames.length ? v : null;
    result.steps = (result.steps || []).map((step) => ({
      ...step,
      frameIndex: safeIndex(step.frameIndex),
      okFrameIndex: safeIndex(step.okFrameIndex),
      nokFrameIndex: safeIndex(step.nokFrameIndex),
    }));
    res.json(result);
  } catch (error) {
    console.error("Erreur vidéo IA :", error);
    res.status(500).json({
      validation: {
        status: "ECHEC",
        score: 0,
        problems: ["Erreur serveur IA"],
        weakWords: [],
        missingData: ["Impossible de générer le standard à partir de la vidéo"],
        recommendationsBeforeUse: [],
      },
      standard: {},
      steps: [],
    });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Serveur Smart Standard démarré sur le port ${PORT} (IA : ${currentProvider()})`);
});