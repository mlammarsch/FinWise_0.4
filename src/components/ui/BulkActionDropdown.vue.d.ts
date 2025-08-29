type __VLS_Props = {
    selectedCount: number;
    disabled?: boolean;
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    delete: (...args: any[]) => void;
    "assign-account": (...args: any[]) => void;
    "change-recipient": (...args: any[]) => void;
    "assign-category": (...args: any[]) => void;
    "assign-tags": (...args: any[]) => void;
    "change-date": (...args: any[]) => void;
    "set-reconciled": (...args: any[]) => void;
    "remove-reconciled": (...args: any[]) => void;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onDelete?: ((...args: any[]) => any) | undefined;
    "onAssign-account"?: ((...args: any[]) => any) | undefined;
    "onChange-recipient"?: ((...args: any[]) => any) | undefined;
    "onAssign-category"?: ((...args: any[]) => any) | undefined;
    "onAssign-tags"?: ((...args: any[]) => any) | undefined;
    "onChange-date"?: ((...args: any[]) => any) | undefined;
    "onSet-reconciled"?: ((...args: any[]) => any) | undefined;
    "onRemove-reconciled"?: ((...args: any[]) => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
