import * as React from 'react';
import styles from './ConfirmDialogProvider.module.css';

type ConfirmState = {
  message: string;
  detail?: string;
  resolve: (confirmed: boolean) => void;
};

type ConfirmFn = (message: string, detail?: string) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmFn | null>(null);

let globalConfirm: ConfirmFn | null = null;

/** Register app-styled confirm (falls back to window.confirm if provider not mounted). */
export async function confirmUserAction(message: string, detail?: string): Promise<boolean> {
  if (globalConfirm) {
    return globalConfirm(message, detail);
  }
  if (typeof window === 'undefined') return false;
  const text = detail ? `${message}\n\n${detail}` : message;
  return window.confirm(text);
}

export function useConfirm(): ConfirmFn {
  const fn = React.useContext(ConfirmContext);
  return fn ?? confirmUserAction;
}

export const ConfirmDialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = React.useState<ConfirmState | null>(null);

  const confirm = React.useCallback((message: string, detail?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ message, detail, resolve });
    });
  }, []);

  React.useEffect(() => {
    globalConfirm = confirm;
    return () => {
      globalConfirm = null;
    };
  }, [confirm]);

  const close = React.useCallback(
    (confirmed: boolean) => {
      if (!state) return;
      state.resolve(confirmed);
      setState(null);
    },
    [state]
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state ? (
        <div
          className={styles.backdrop}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close(false);
          }}
        >
          <div className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby="th-confirm-title">
            <h2 id="th-confirm-title" className={styles.title}>
              Confirm
            </h2>
            <p className={styles.message}>{state.message}</p>
            {state.detail ? <p className={styles.detail}>{state.detail}</p> : null}
            <div className={styles.actions}>
              <button type="button" className={styles.cancelBtn} onClick={() => close(false)}>
                Cancel
              </button>
              <button type="button" className={styles.confirmBtn} onClick={() => close(true)}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
};
