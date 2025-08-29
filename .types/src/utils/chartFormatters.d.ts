/**
 * Formatiert Währungsbeträge für Charts ohne Kommastellen
 * Verwendet 1k€, 1M€ Format für große Beträge
 */
export declare const formatChartCurrency: (value: number) => string;
/**
 * Formatiert Kontostände als runde Zahlen ohne Kommastellen
 */
export declare const formatAccountBalance: (value: number) => string;
