import { Transaction, TransactionType } from "../../types";
type __VLS_Props = {
    transaction?: Transaction | null;
    isEdit?: boolean;
    defaultAccountId?: string;
    initialAccountId?: string;
    initialTransactionType?: TransactionType;
    initialCategoryId?: string;
    initialTagIds?: string[];
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    save: (...args: any[]) => void;
    cancel: (...args: any[]) => void;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onSave?: ((...args: any[]) => any) | undefined;
    onCancel?: ((...args: any[]) => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
