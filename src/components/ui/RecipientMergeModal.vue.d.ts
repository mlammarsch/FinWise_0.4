import type { Recipient } from "../../types";
/**
 * Pfad zur Komponente: src/components/ui/RecipientMergeModal.vue
 * Modal-Dialog für das Zusammenführen von Empfängern
 *
 * Props:
 * - selectedRecipients: Recipient[] - Array der ausgewählten Empfänger
 * - show: boolean - Sichtbarkeit des Modals
 *
 * Emits:
 * - update:show: boolean - Modal-Sichtbarkeit aktualisieren
 * - confirm-merge: { targetRecipient: Recipient, sourceRecipients: Recipient[], mergeMode: 'existing' | 'new' } - Merge bestätigen
 * - cancel: void - Modal abbrechen
 */
type __VLS_Props = {
    selectedRecipients: Recipient[];
    show: boolean;
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {} & {
    cancel: () => any;
    "update:show": (value: boolean) => any;
    "confirm-merge": (data: {
        targetRecipient: Recipient;
        sourceRecipients: Recipient[];
        mergeMode: "existing" | "new";
    }) => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onCancel?: (() => any) | undefined;
    "onUpdate:show"?: ((value: boolean) => any) | undefined;
    "onConfirm-merge"?: ((data: {
        targetRecipient: Recipient;
        sourceRecipients: Recipient[];
        mergeMode: "existing" | "new";
    }) => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
