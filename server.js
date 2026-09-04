import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import rateLimit from "express-rate-limit";

dotenv.config();

const app = express();

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

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* =======================================================
   ANALYSE STANDARD EXISTANT
======================================================= */

app.post("/api/analyze-imported-standard", async (req, res) => {
  try {
    const { importedText } = req.body;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.3,
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
      result: completion.choices[0].message.content,
    });
  } catch (error) {
    console.error("Erreur import IA :", error);
    res.status(500).json({
      result: "Erreur IA import standard.",
    });
  }
});

/* =======================================================
   GENERATION STANDARD MODE TERRAIN JSON
======================================================= */

app.post("/api/generate-terrain-standard", async (req, res) => {
  try {
    const { title, zone, machine, objective, steps } = req.body;

    const terrainData = `
TITRE :
${title}

ZONE :
${zone}

MACHINE :
${machine}

OBJECTIF :
${objective}

ETAPES TERRAIN :
${JSON.stringify(steps, null, 2)}
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.15,
      response_format: {
        type: "json_object",
      },
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
  "general": {
    "title": "...",
    "zone": "...",
    "machine": "...",
    "objective": "..."
  },
  "leanAnalysis": {
    "risks": [],
    "muda": [],
    "qualityRisks": [],
    "safetyRisks": [],
    "trainingRisks": []
  },
  "steps": [
    {
      "number": 1,
      "operation": "...",
      "safety": "...",
      "quality": "...",
      "reaction": "...",
      "time": "...",
      "okCriteria": "...",
      "nokCriteria": "...",
      "visualNeed": "Photo OK/NOK nécessaire ou non",
      "confidenceComment": "..."
    }
  ]
}

Réponds uniquement en JSON valide.
`,
        },
        {
          role: "user",
          content: terrainData,
        },
      ],
    });

    const result = JSON.parse(completion.choices[0].message.content);
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
      general: {},
      leanAnalysis: {},
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

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.3,
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
      result: completion.choices[0].message.content,
    });
  } catch (error) {
    console.error("Erreur IA :", error);

    res.status(500).json({
      result: "Erreur IA serveur.",
    });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Serveur Smart Standard démarré sur le port ${PORT}`);
});