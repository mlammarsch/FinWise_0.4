/**
 * Pfad zur Komponente: src/components/ui/InfoToast.vue
 * Ein Info-Toast für Benachrichtigungen unten links.
 *
 * Komponenten-Props:
 * - message: string – Die anzuzeigende Nachricht
 * - type?: 'success' | 'error' | 'info' | 'warning' – Toast-Typ (default: 'info')
 * - duration?: number – Anzeigedauer in ms (default: 4000)
 * - autoHide?: boolean – Automatisches Ausblenden (default: true)
 *
 * Emits:
 * - close – wird ausgelöst, wenn der Toast geschlossen wird
 */
type __VLS_Props = {
    message: string;
    type?: "success" | "error" | "info" | "warning";
    duration?: number;
    autoHide?: boolean;
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {} & {
    close: () => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onClose?: (() => any) | undefined;
}>, {
    type: "success" | "error" | "info" | "warning";
    duration: number;
    autoHide: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
