/**
 * Pfad zur Komponente: src/components/ui/ConfirmationModal.vue
 * Ein einfacher Bestätigungsdialog für Löschaktionen und ähnliche Zwecke.
 *
 * Komponenten-Props:
 * - title: string – Titel des Dialogs
 * - message: string – Nachricht im Dialog
 * - confirmText: string – Beschriftung des Bestätigungsbuttons
 * - cancelText: string – Beschriftung des Abbrechen-Buttons
 *
 * Emits:
 * - confirm – wird ausgelöst, wenn der Nutzer bestätigt
 * - cancel – wird ausgelöst, wenn der Nutzer abbricht
 */
type __VLS_Props = {
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    useHtml?: boolean;
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {} & {
    cancel: () => any;
    confirm: () => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onCancel?: (() => any) | undefined;
    onConfirm?: (() => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
