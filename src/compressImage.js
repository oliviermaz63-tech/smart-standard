// Compresse et redimensionne une photo avant de la stocker/afficher.
//
// Les photos prises directement depuis un téléphone peuvent peser plusieurs
// Mo chacune (résolution native de l'appareil photo). Multipliées par 3
// photos (terrain/OK/NOK) x plusieurs étapes, un export PDF peut vite
// atteindre des dizaines voire des centaines de Mo, inutilisable en
// pratique (partage par email, ouverture rapide...).
//
// Cette fonction redimensionne l'image à une largeur/hauteur maximale
// raisonnable pour un standard terrain (les détails fins ne sont pas
// nécessaires pour ce type de photo) et la ré-encode en JPEG avec une
// qualité réduite mais toujours nette à l'écran comme à l'impression.
export function compressImage(file, maxDimension = 1000, quality = 0.7) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();

      img.onload = () => {
        let { width, height } = img;

        if (width > height && width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else if (height >= width && height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL("image/jpeg", quality));
      };

      img.onerror = reject;
      img.src = event.target.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
