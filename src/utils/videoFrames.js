// Extrait quelques images clés d'une vidéo, directement dans le navigateur.
//
// La vidéo elle-même n'est jamais envoyée au serveur (trop lourde, surtout
// en 4G) : on ne garde que quelques images réparties régulièrement dans le
// temps, redimensionnées et compressées en JPEG. Ces images servent à la
// fois d'entrée à l'IA et de photos terrain des étapes générées.

export const MAX_VIDEO_SECONDS = 180;

function waitFor(target, eventName, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("La vidéo met trop de temps à se charger."));
    }, timeoutMs);
    const onOk = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Impossible de lire cette vidéo (format non pris en charge ?)."));
    };
    function cleanup() {
      clearTimeout(timer);
      target.removeEventListener(eventName, onOk);
      target.removeEventListener("error", onError);
    }
    target.addEventListener(eventName, onOk, { once: true });
    target.addEventListener("error", onError, { once: true });
  });
}

// Nombre d'images à extraire selon la durée : une toutes les ~4 secondes,
// entre 6 et `maxFrames`.
export function frameCountFor(duration, maxFrames = 12) {
  return Math.max(6, Math.min(maxFrames, Math.round(duration / 4)));
}

export async function extractVideoFrames(
  file,
  { maxFrames = 12, maxDimension = 800, quality = 0.7, onProgress } = {}
) {
  if (!file) throw new Error("Aucune vidéo sélectionnée.");

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;

  try {
    await waitFor(video, "loadedmetadata");

    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("Durée de la vidéo illisible.");
    }
    if (duration > MAX_VIDEO_SECONDS) {
      throw new Error(
        `Vidéo trop longue (${Math.round(duration)} s). Limite : ${MAX_VIDEO_SECONDS / 60} minutes — découpe-la ou filme une opération à la fois.`
      );
    }

    const count = frameCountFor(duration, maxFrames);
    const scale = Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    const frames = [];
    for (let i = 0; i < count; i++) {
      // Milieu de chaque tranche de temps (évite le tout premier / dernier
      // instant, souvent flous ou noirs).
      const time = Math.min(duration - 0.05, ((i + 0.5) / count) * duration);
      const seeked = waitFor(video, "seeked");
      video.currentTime = time;
      await seeked;
      ctx.drawImage(video, 0, 0, width, height);
      frames.push({ dataUrl: canvas.toDataURL("image/jpeg", quality), time });
      if (onProgress) onProgress(i + 1, count);
    }
    return { frames, duration };
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load();
  }
}
