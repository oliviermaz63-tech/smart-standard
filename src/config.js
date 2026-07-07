// URL de base de l'API backend.
//
// En local (npm run dev), si aucune variable d'environnement n'est définie,
// on retombe sur http://localhost:3001 par défaut.
//
// En production (Vercel), la variable VITE_API_URL est déjà configurée
// dans les paramètres du projet Vercel (Environment Variables), pointant
// vers le backend Railway (ex: https://smart-standard-production.up.railway.app).
export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001";
