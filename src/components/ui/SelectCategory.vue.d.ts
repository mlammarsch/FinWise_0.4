type __VLS_Props = {
    modelValue?: string;
    filterOutArray?: string[];
    showNoneOption?: boolean;
    rounded?: boolean;
};
declare function focusInput(): void;
declare const _default: import("vue").DefineComponent<__VLS_Props, {
    focusInput: typeof focusInput;
}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    "update:modelValue": (...args: any[]) => void;
    select: (...args: any[]) => void;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    "onUpdate:modelValue"?: ((...args: any[]) => any) | undefined;
    onSelect?: ((...args: any[]) => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
