import { useEffect, useRef, useState } from "react";
import { feedbackEvents, setFeedbackHostMounted } from "../utils/notify";

const STYLES = {
  success: { icon: "✅", bar: "border-emerald-500" },
  error: { icon: "⚠️", bar: "border-red-500" },
  info: { icon: "ℹ️", bar: "border-indigo-500" },
};

export default function FeedbackHost() {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const nextId = useRef(1);

  useEffect(() => {
    setFeedbackHostMounted(true);

    function onToast(event) {
      const { message, type } = event.detail;
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { id, message, type }]);
      // Les erreurs restent plus longtemps : elles sont plus longues à lire.
      const delay = type === "error" ? 10000 : 5000;
      setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), delay);
    }
    function onConfirm(event) {
      setDialog(event.detail);
    }

    window.addEventListener(feedbackEvents.TOAST_EVENT, onToast);
    window.addEventListener(feedbackEvents.CONFIRM_EVENT, onConfirm);
    return () => {
      setFeedbackHostMounted(false);
      window.removeEventListener(feedbackEvents.TOAST_EVENT, onToast);
      window.removeEventListener(feedbackEvents.CONFIRM_EVENT, onConfirm);
    };
  }, []);

  function answer(value) {
    dialog?.resolve(value);
    setDialog(null);
  }

  return (
    <>
      <div
        className="fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const style = STYLES[toast.type] || STYLES.info;
          return (
            <button
              key={toast.id}
              type="button"
              role={toast.type === "error" ? "alert" : "status"}
              onClick={() => setToasts((list) => list.filter((t) => t.id !== toast.id))}
              className={`pointer-events-auto w-full max-w-md text-left bg-white rounded-xl shadow-xl border-l-4 ${style.bar} px-4 py-3 text-sm text-slate-800 flex gap-3 items-start`}
            >
              <span aria-hidden="true">{style.icon}</span>
              <span className="flex-1">{toast.message}</span>
            </button>
          );
        })}
      </div>

      {dialog && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 px-4"
          role="dialog"
          aria-modal="true"
          onClick={() => answer(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-slate-800 mb-6">{dialog.message}</p>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary px-4 py-2" onClick={() => answer(false)}>
                Annuler
              </button>
              <button
                type="button"
                autoFocus
                className={
                  dialog.danger
                    ? "px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold"
                    : "btn-primary px-4 py-2"
                }
                onClick={() => answer(true)}
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
