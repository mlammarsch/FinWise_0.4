import { AccountGroup } from "../../types";
type __VLS_Props = {
    group: AccountGroup;
    activeAccountId?: string;
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {
    refreshLayout: () => Promise<void>;
}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    selectAccount: (...args: any[]) => void;
    "request-layout-update": (...args: any[]) => void;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onSelectAccount?: ((...args: any[]) => any) | undefined;
    "onRequest-layout-update"?: ((...args: any[]) => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
