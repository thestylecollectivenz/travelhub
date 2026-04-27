import * as React from 'react';

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
    <div style={{ marginTop: 'var(--space-2)', border: 'var(--border-default)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', background: 'var(--color-surface-raised)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', alignItems: 'center' }}>
        <strong>Tip calculator</strong>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', color: 'var(--color-primary)', cursor: 'pointer' }}>Close</button>
      </div>
      <div style={{ display: 'grid', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
        <label>
          Bill amount ({currency})
          <input type="number" min={0} value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))} style={{ width: '100%' }} />
        </label>
        <label>
          Tip %
          <input type="number" min={0} value={percent} onChange={(e) => setPercent(Math.max(0, Number(e.target.value) || 0))} style={{ width: '100%' }} />
        </label>
        <label>
          Split people
          <input type="number" min={1} value={people} onChange={(e) => setPeople(Math.max(1, Number(e.target.value) || 1))} style={{ width: '100%' }} />
        </label>
        <div>Tip amount: <strong>{tipAmount.toFixed(2)} {currency}</strong></div>
        <div>Total: <strong>{total.toFixed(2)} {currency}</strong></div>
        <div>Per person: <strong>{perPerson.toFixed(2)} {currency}</strong></div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-sand-600)' }}>{note}</div>
      </div>
    </div>
  );
};
