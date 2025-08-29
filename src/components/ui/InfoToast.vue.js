import { ref, onMounted } from "vue";
import { Icon } from "@iconify/vue";
const props = withDefaults(defineProps(), {
    type: "info",
    duration: 4000,
    autoHide: true,
});
const emit = defineEmits();
const isVisible = ref(true);
function close() {
    isVisible.value = false;
    emit("close");
}
function getToastClasses() {
    const baseClasses = "alert shadow-lg border-2 max-w-md";
    switch (props.type) {
        case "success":
            return `${baseClasses} alert-success border-success`;
        case "error":
            return `${baseClasses} alert-error border-error`;
        case "warning":
            return `${baseClasses} alert-warning border-warning`;
        case "info":
        default:
            return `${baseClasses} alert-info border-info`;
    }
}
function getIcon() {
    switch (props.type) {
        case "success":
            return "mdi:check-circle";
        case "error":
            return "mdi:alert-circle";
        case "warning":
            return "mdi:alert";
        case "info":
        default:
            return "mdi:information";
    }
}
onMounted(() => {
    if (props.autoHide) {
        setTimeout(() => {
            close();
        }, props.duration);
    }
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    type: "info",
    duration: 4000,
    autoHide: true,
});
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
const __VLS_0 = {}.Transition;
/** @type {[typeof __VLS_components.Transition, typeof __VLS_components.Transition, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    enterActiveClass: "transition-all duration-300 ease-out",
    enterFromClass: "transform translate-x-full opacity-0",
    enterToClass: "transform translate-x-0 opacity-100",
    leaveActiveClass: "transition-all duration-300 ease-in",
    leaveFromClass: "transform translate-x-0 opacity-100",
    leaveToClass: "transform translate-x-full opacity-0",
}));
const __VLS_2 = __VLS_1({
    enterActiveClass: "transition-all duration-300 ease-out",
    enterFromClass: "transform translate-x-full opacity-0",
    enterToClass: "transform translate-x-0 opacity-100",
    leaveActiveClass: "transition-all duration-300 ease-in",
    leaveFromClass: "transform translate-x-0 opacity-100",
    leaveToClass: "transform translate-x-full opacity-0",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
if (__VLS_ctx.isVisible) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "fixed bottom-4 left-4 z-50" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: (__VLS_ctx.getToastClasses()) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center" },
    });
    const __VLS_4 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
        icon: (__VLS_ctx.getIcon()),
        ...{ class: "text-xl mr-3 flex-shrink-0" },
    }));
    const __VLS_6 = __VLS_5({
        icon: (__VLS_ctx.getIcon()),
        ...{ class: "text-xl mr-3 flex-shrink-0" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_5));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "flex-1" },
    });
    (__VLS_ctx.message);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.close) },
        ...{ class: "btn btn-ghost btn-xs ml-2" },
    });
    const __VLS_8 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        icon: "mdi:close",
        ...{ class: "text-lg" },
    }));
    const __VLS_10 = __VLS_9({
        icon: "mdi:close",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
}
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-4']} */ ;
/** @type {__VLS_StyleScopedClasses['left-4']} */ ;
/** @type {__VLS_StyleScopedClasses['z-50']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Icon: Icon,
            isVisible: isVisible,
            close: close,
            getToastClasses: getToastClasses,
            getIcon: getIcon,
        };
    },
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
; /* PartiallyEnd: #4569/main.vue */
