declare const _default: import("vue").DefineComponent<{}, {
    $emit: (event: "left-click" | "right-click" | "middle-left-click" | "middle-right-click", ...args: any[]) => void;
    leftLabel: string;
    rightLabel: string;
    leftColor: string;
    rightColor: string;
    middleLeftLabel: string;
    middleLeftColor: string;
    middleRightLabel: string;
    middleRightColor: string;
    border: boolean;
    $props: {
        readonly leftLabel?: string | undefined;
        readonly rightLabel?: string | undefined;
        readonly leftColor?: string | undefined;
        readonly rightColor?: string | undefined;
        readonly middleLeftLabel?: string | undefined;
        readonly middleLeftColor?: string | undefined;
        readonly middleRightLabel?: string | undefined;
        readonly middleRightColor?: string | undefined;
        readonly border?: boolean | undefined;
    };
}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
export default _default;
