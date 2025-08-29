interface Props {
    modelValue: string;
    isActive: boolean;
    fieldKey?: string;
    placeholder?: string;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    "update:modelValue": (value: string) => any;
    finish: () => any;
    activate: () => any;
}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{
    "onUpdate:modelValue"?: ((value: string) => any) | undefined;
    onFinish?: (() => any) | undefined;
    onActivate?: (() => any) | undefined;
}>, {
    placeholder: string;
    fieldKey: string;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
