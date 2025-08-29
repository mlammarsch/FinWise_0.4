type __VLS_Props = {
    isOpen: boolean;
    month?: {
        start: Date;
        end: Date;
    };
    mode?: "fill" | "transfer" | "edit";
    prefillAmount?: number;
    preselectedCategoryId?: string;
    prefillDate?: string;
    transactionId?: string;
    gegentransactionId?: string;
    fromCategoryId?: string;
    toCategoryId?: string;
    note?: string;
    isIncomeCategory?: boolean;
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    close: (...args: any[]) => void;
    transfer: (...args: any[]) => void;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onClose?: ((...args: any[]) => any) | undefined;
    onTransfer?: ((...args: any[]) => any) | undefined;
}>, {
    mode: "fill" | "transfer" | "edit";
    isIncomeCategory: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
