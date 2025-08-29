import { PlanningTransaction } from "../../types";
type __VLS_Props = {
    planningTransactions: Array<{
        date: string;
        transaction: PlanningTransaction;
    }>;
    searchTerm?: string;
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    delete: (...args: any[]) => void;
    edit: (...args: any[]) => void;
    execute: (...args: any[]) => void;
    skip: (...args: any[]) => void;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onDelete?: ((...args: any[]) => any) | undefined;
    onEdit?: ((...args: any[]) => any) | undefined;
    onExecute?: ((...args: any[]) => any) | undefined;
    onSkip?: ((...args: any[]) => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
