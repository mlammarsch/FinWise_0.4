import type { Recipient } from "../../types";
/**
 * Pfad zur Komponente: src/components/ui/RecipientDeleteConfirmModal.vue
 * Modal-Dialog für die sichere Löschung von Empfängern mit Validierung
 *
 * Props:
 * - selectedRecipients: Recipient[] - Array der zu löschenden Empfänger
 * - show: boolean - Sichtbarkeit des Modals
 * - validationResults: RecipientValidationResult[] - Validierungsergebnisse für jeden Empfänger
 *
 * Emits:
 * - update:show: boolean - Modal-Sichtbarkeit aktualisieren
 * - confirm: { recipients: Recipient[] } - Löschung bestätigen
 * - cancel: void - Modal abbrechen
 */
interface RecipientValidationResult {
    recipientId: string;
    recipientName: string;
    hasActiveReferences: boolean;
    transactionCount: number;
    planningTransactionCount: number;
    automationRuleCount: number;
    canDelete: boolean;
    warnings: string[];
}
type __VLS_Props = {
    selectedRecipients: Recipient[];
    show: boolean;
    validationResults?: RecipientValidationResult[];
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {} & {
    cancel: () => any;
    confirm: (data: {
        recipients: Recipient[];
    }) => any;
    "update:show": (value: boolean) => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onCancel?: (() => any) | undefined;
    onConfirm?: ((data: {
        recipients: Recipient[];
    }) => any) | undefined;
    "onUpdate:show"?: ((value: boolean) => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
