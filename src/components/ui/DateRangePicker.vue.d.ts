interface DateRange {
    start: string;
    end: string;
}
type __VLS_Props = {
    modelValue?: DateRange;
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {
    navigateRangeByMonth: (direction: "prev" | "next") => void;
}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {} & {
    "update:modelValue": (value: DateRange) => any;
    "navigate-month": (direction: "prev" | "next") => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    "onUpdate:modelValue"?: ((value: DateRange) => any) | undefined;
    "onNavigate-month"?: ((direction: "prev" | "next") => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
