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

// Clé d'application envoyée au backend (header X-App-Key) pour limiter les
// appels directs à l'API (hors de l'appli) — voir server.js et .env.example.
// Ce n'est pas un vrai secret : elle finit dans le JS livré au navigateur,
// donc quelqu'un de déterminé peut la retrouver. Combinée à la limite de
// débit côté serveur, elle bloque surtout les abus automatisés basiques.
const APP_KEY = import.meta.env.VITE_APP_KEY || "";

// Appelle l'API backend en ajoutant automatiquement la clé d'application à
// chaque requête, pour éviter de dupliquer ce header dans chaque appel.
export function apiFetch(path, options = {}) {
  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      "X-App-Key": APP_KEY,
    },
  });
}
