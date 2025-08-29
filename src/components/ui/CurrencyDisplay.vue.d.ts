/**
 * Farbliche Anzeige der Währung mit verschiedenen Optionen.
 * Pfad: src/components/ui/CurrencyDisplay.vue
 *
 * Komponenten-Props:
 * - amount: number - Die anzuzeigende Zahl (Betrag)
 * - showSign?: boolean - Währungszeichen (€) anzeigen oder nicht (Default: true)
 * - showZero?: boolean - 0-Werte anzeigen oder nicht (Default: true)
 * - asInteger?: boolean - Betrag als Ganzzahl ausgeben (Default: false)
 *
 * Emits:
 * - Keine Emits vorhanden
 */
type __VLS_Props = {
    amount: number;
    showSign?: boolean;
    showZero?: boolean;
    asInteger?: boolean;
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {
    showSign: boolean;
    showZero: boolean;
    asInteger: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
