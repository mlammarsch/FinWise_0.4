interface Props {
    months?: Array<{
        key: string;
        label: string;
        start: Date;
        end: Date;
    }>;
}
declare const _default: import("vue").DefineComponent<Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    muuriReady: () => any;
}, string, import("vue").PublicProps, Readonly<Props> & Readonly<{
    onMuuriReady?: (() => any) | undefined;
}>, {
    months: Array<{
        key: string;
        label: string;
        start: Date;
        end: Date;
    }>;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
