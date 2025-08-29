const __VLS_props = defineProps({
    /**
     * Labeltext für das Badge (z. B. „info“, „error“)
     */
    label: { type: String, required: true },
    /**
     * Farbwert aus DaisyUI-Farbskala (z. B. "primary", "success", "error", etc.)
     */
    colorIntensity: {
        type: String,
        default: "primary",
    },
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "badge badge-soft badge-sm rounded-full" },
    ...{ class: ({
            'badge-primary': __VLS_ctx.colorIntensity === 'primary',
            'badge-secondary': __VLS_ctx.colorIntensity === 'secondary',
            'badge-accent': __VLS_ctx.colorIntensity === 'accent',
            'badge-info': __VLS_ctx.colorIntensity === 'info',
            'badge-success': __VLS_ctx.colorIntensity === 'success',
            'badge-warning': __VLS_ctx.colorIntensity === 'warning',
            'badge-error': __VLS_ctx.colorIntensity === 'error',
            'badge-neutral': __VLS_ctx.colorIntensity === 'neutral',
        }) },
});
(__VLS_ctx.label);
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-accent']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-info']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-success']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-error']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-neutral']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            $props: __VLS_makeOptional(__VLS_props),
            ...__VLS_props,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {
            $props: __VLS_makeOptional(__VLS_props),
            ...__VLS_props,
        };
    },
});
; /* PartiallyEnd: #4569/main.vue */
