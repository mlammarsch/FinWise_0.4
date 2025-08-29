import "dayjs/locale/de";
type __VLS_Props = {
    startDate: string;
    type: "accounts" | "categories";
    filteredAccountId?: string;
    selectedAccountForDetail?: string;
    selectedCategoryForDetail?: string;
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {} & {
    "show-account-detail": (accountId: string) => any;
    "show-category-detail": (categoryId: string) => any;
    "hide-account-detail": () => any;
    "hide-category-detail": () => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    "onShow-account-detail"?: ((accountId: string) => any) | undefined;
    "onShow-category-detail"?: ((categoryId: string) => any) | undefined;
    "onHide-account-detail"?: (() => any) | undefined;
    "onHide-category-detail"?: (() => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
