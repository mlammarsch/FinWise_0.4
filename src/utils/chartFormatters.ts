/**
 * Formatiert Währungsbeträge für Charts ohne Kommastellen
 * Verwendet 1k€, 1M€ Format für große Beträge
 */
export const formatChartCurrency = (value: number): string => {
  if (value === 0) return "0€";

  const absValue = Math.abs(value);
  let formatted = "";

  if (absValue >= 1000000) {
    formatted = Math.round(value / 1000000) + "M€";
  } else if (absValue >= 1000) {
    formatted = Math.round(value / 1000) + "k€";
  } else {
    formatted = Math.round(value) + "€";
  }

  return formatted;
};

/**
 * Formatiert Kontostände als runde Zahlen ohne Kommastellen
 */
export const formatAccountBalance = (value: number): string => {
  return Math.round(value) + "€";
};
