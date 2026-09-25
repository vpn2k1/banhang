import type { ToastAction, ToastKind } from '../lib/appContext';

export interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
  action?: ToastAction;
}

interface Props {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

export function Toasts({ toasts, onDismiss }: Props) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          <span>{t.message}</span>
          {t.action && (
            <button
              type="button"
              className="btn btn-small"
              onClick={() => {
                t.action!.onClick();
                onDismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button type="button" className="btn-icon" onClick={() => onDismiss(t.id)} aria-label="Đóng">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
