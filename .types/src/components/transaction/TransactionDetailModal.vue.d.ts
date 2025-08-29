import { Transaction } from "../../types";
/**
 * Pfad zur Komponente: components/transaction/TransactionDetailModal.vue
 *
 * Diese Komponente zeigt die Details einer Transaktion in einem Modal an.
 *
 * Komponenten-Props:
 * - transaction: Transaction | null - Die anzuzeigende Transaktion.
 * - isOpen: boolean - Steuert die Sichtbarkeit des Modals.
 *
 * Emits:
 * - close - Wird ausgelöst, wenn das Modal geschlossen wird.
 */
type __VLS_Props = {
    transaction: Transaction | null;
    isOpen: boolean;
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    close: (...args: any[]) => void;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onClose?: ((...args: any[]) => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
