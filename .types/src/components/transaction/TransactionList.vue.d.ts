import { Transaction } from "../../types";
type __VLS_Props = {
    transactions: Transaction[];
    showAccount?: boolean;
    sortKey: keyof Transaction | "";
    sortOrder: "asc" | "desc";
    searchTerm?: string;
};
declare function getSelectedTransactions(): Transaction[];
declare function clearSelection(): void;
declare const _default: import("vue").DefineComponent<__VLS_Props, {
    getSelectedTransactions: typeof getSelectedTransactions;
    clearSelection: typeof clearSelection;
}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    delete: (...args: any[]) => void;
    edit: (...args: any[]) => void;
    "sort-change": (...args: any[]) => void;
    toggleReconciliation: (...args: any[]) => void;
    "selection-changed": (...args: any[]) => void;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onDelete?: ((...args: any[]) => any) | undefined;
    onEdit?: ((...args: any[]) => any) | undefined;
    "onSort-change"?: ((...args: any[]) => any) | undefined;
    onToggleReconciliation?: ((...args: any[]) => any) | undefined;
    "onSelection-changed"?: ((...args: any[]) => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
