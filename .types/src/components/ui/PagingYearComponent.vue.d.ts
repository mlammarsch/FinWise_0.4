type __VLS_Props = {
    displayedMonths: number;
    currentStartMonthOffset: number;
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {} & {
    updateStartOffset: (val: number) => any;
    updateDisplayedMonths: (val: number) => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onUpdateStartOffset?: ((val: number) => any) | undefined;
    onUpdateDisplayedMonths?: ((val: number) => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
