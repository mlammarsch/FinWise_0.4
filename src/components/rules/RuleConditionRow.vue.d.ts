import type { RuleCondition } from "@/types";
interface Props {
    condition: RuleCondition;
    index: number;
    canRemove: boolean;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {} & {
    remove: () => any;
    "update:condition": (condition: RuleCondition) => any;
}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{
    onRemove?: (() => any) | undefined;
    "onUpdate:condition"?: ((condition: RuleCondition) => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
