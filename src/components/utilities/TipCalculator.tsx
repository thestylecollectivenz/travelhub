import * as React from 'react';
import styles from './TipCalculator.module.css';

export interface TipCalculatorProps {
  currency: string;
  defaultPercent: number;
  note: string;
  onClose: () => void;
}

export const TipCalculator: React.FC<TipCalculatorProps> = ({ currency, defaultPercent, note, onClose }) => {
  const [amount, setAmount] = React.useState<number>(0);
  const [percent, setPercent] = React.useState<number>(defaultPercent);
  const [people, setPeople] = React.useState<number>(1);

  const tipAmount = amount * (percent / 100);
  const total = amount + tipAmount;
  const perPerson = people > 0 ? total / people : total;

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <h4 className={styles.title}>Tip calculator</h4>
        <button type="button" onClick={onClose} className={styles.closeBtn}>Close</button>
      </div>
      <div className={styles.grid}>
        <label className={styles.label}>
          Bill amount ({currency})
          <input className={styles.input} type="number" min={0} value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))} />
        </label>
        <label className={styles.label}>
          Tip %
          <input className={styles.input} type="number" min={0} value={percent} onChange={(e) => setPercent(Math.max(0, Number(e.target.value) || 0))} />
        </label>
        <label className={styles.label}>
          Split people
          <input className={styles.input} type="number" min={1} value={people} onChange={(e) => setPeople(Math.max(1, Number(e.target.value) || 1))} />
        </label>
        <div className={styles.result}>Tip amount: <strong>{tipAmount.toFixed(2)} {currency}</strong></div>
        <div className={styles.result}>Total: <strong>{total.toFixed(2)} {currency}</strong></div>
        <div className={styles.result}>Per person: <strong>{perPerson.toFixed(2)} {currency}</strong></div>
        <div className={styles.note}>{note}</div>
      </div>
    </div>
  );
};
