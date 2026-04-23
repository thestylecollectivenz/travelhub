export function convertToHomeCurrency(
  amount: number,
  currency: string,
  rates: Record<string, number>,
  homeCurrency: string
): number {
  const source = (currency || 'NZD').toUpperCase();
  const target = (homeCurrency || 'NZD').toUpperCase();
  if (source === target) return amount;
  if (source === 'NZD') {
    const targetRate = rates[target];
    return targetRate && targetRate !== 0 ? amount * targetRate : amount;
  }
  const sourceRate = rates[source];
  if (!sourceRate || sourceRate === 0) return amount;
  const nzdAmount = amount / sourceRate;
  if (target === 'NZD') return nzdAmount;
  const targetRate = rates[target];
  if (!targetRate || targetRate === 0) return amount;
  return nzdAmount * targetRate;
}
