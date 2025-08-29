interface Props {
    modelValue: number;
    isActive: boolean;
    fieldKey?: string;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    "update:modelValue": (value: number) => any;
    finish: () => any;
    activate: () => any;
    "focus-next": () => any;
    "focus-previous": () => any;
}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{
    "onUpdate:modelValue"?: ((value: number) => any) | undefined;
    onFinish?: (() => any) | undefined;
    onActivate?: (() => any) | undefined;
    "onFocus-next"?: (() => any) | undefined;
    "onFocus-previous"?: (() => any) | undefined;
}>, {
    fieldKey: string;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
