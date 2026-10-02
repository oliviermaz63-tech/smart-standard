// Définitions des trames partagées entre le sélecteur de trame, le choix de
// mode (Terrain / manuel) et le mode Terrain lui-même.
export const TRAMES = {
  classique: {
    label: "Standard classique",
    description:
      "Objectif, sécurité, qualité, moyens nécessaires et déroulé opératoire détaillé avec photos Terrain / OK / NOK par étape.",
    icon: "📋",
  },
  instruction_travail: {
    label: "Instruction de travail",
    description:
      "Format compact type fiche de poste : un tableau avec opération, description, une illustration et un temps par étape.",
    icon: "📝",
  },
  gamme_nettoyage: {
    label: "Gamme de nettoyage",
    description:
      "Fiche de nettoyage par élément avec bandeau de photos repères numérotées, conditions machine et action si hors standard.",
    icon: "🧽",
  },
  mode_operatoire: {
    label: "Standard mode opératoire",
    description:
      "Croquis et photo en tête de document, puis séquence d'opérations réparties entre plusieurs opérateurs avec points EHS et Qualité mis en évidence.",
    icon: "👥",
  },
};
