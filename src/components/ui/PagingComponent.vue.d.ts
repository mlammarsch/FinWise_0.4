type __VLS_Props = {
    currentPage: number;
    totalPages: number;
    itemsPerPage: number | string;
    itemsPerPageOptions?: Array<number | string>;
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {} & {
    "update:currentPage": (value: number) => any;
    "update:itemsPerPage": (value: string | number) => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    "onUpdate:currentPage"?: ((value: number) => any) | undefined;
    "onUpdate:itemsPerPage"?: ((value: string | number) => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
