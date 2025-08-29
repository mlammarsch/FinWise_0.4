type __VLS_Props = {
    isOpen: boolean;
    duplicates: Array<{
        csvRow: any;
        existingTransaction: any;
        duplicateType: 'exact' | 'similar' | 'account_transfer';
        confidence: number;
    }>;
    mappedColumns: {
        date: string;
        amount: string;
        recipient: string;
        category: string;
        notes: string;
    };
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    close: () => any;
    ignoreDuplicates: (duplicateIndexes: number[]) => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onClose?: (() => any) | undefined;
    onIgnoreDuplicates?: ((duplicateIndexes: number[]) => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
