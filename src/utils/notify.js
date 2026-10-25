// Notifications non bloquantes (remplacent alert() et confirm()).
//
//   notify("Message", "success" | "error" | "info")
//   if (await confirmAction("Supprimer ?", { confirmLabel: "Supprimer", danger: true })) { ... }
//
// Le composant <FeedbackHost /> (monté une fois dans main.jsx) affiche les
// messages. Si l'hôte n'est pas monté, on retombe sur alert/confirm pour ne
// jamais perdre un message important.
const TOAST_EVENT = "ss-toast";
const CONFIRM_EVENT = "ss-confirm";
let hostMounted = false;

export const feedbackEvents = { TOAST_EVENT, CONFIRM_EVENT };
export function setFeedbackHostMounted(value) {
  hostMounted = value;
}

export function notify(message, type = "info") {
  if (!hostMounted) {
    window.alert(message);
    return;
  }
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, type } }));
}

export function confirmAction(message, { confirmLabel = "Confirmer", danger = false } = {}) {
  if (!hostMounted) return Promise.resolve(window.confirm(message));
  return new Promise((resolve) => {
    window.dispatchEvent(
      new CustomEvent(CONFIRM_EVENT, { detail: { message, confirmLabel, danger, resolve } })
    );
  });
}
