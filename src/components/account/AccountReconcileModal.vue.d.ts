import { Account } from "@/types";
/**
 * Pfad zur Komponente: src/components/account/AccountReconcileModal.vue
 * Modal zum Abgleich eines Kontos. Salden‑Berechnung nun über AccountService.
 *
 * Props:
 * - account: Account
 * - isOpen: boolean
 *
 * Emits:
 * - close
 * - reconciled
 */
type __VLS_Props = {
    account: Account;
    isOpen: boolean;
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    reconciled: (...args: any[]) => void;
    close: (...args: any[]) => void;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onReconciled?: ((...args: any[]) => any) | undefined;
    onClose?: ((...args: any[]) => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
