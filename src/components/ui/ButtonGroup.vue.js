const __VLS_props = defineProps({
    leftLabel: { type: String, required: true },
    rightLabel: { type: String, required: true },
    leftColor: { type: String, default: "btn-soft" },
    rightColor: { type: String, default: "btn-primary" },
    middleLeftLabel: { type: String, default: "" },
    middleLeftColor: { type: String, default: "btn-secondary" },
    middleRightLabel: { type: String, default: "" },
    middleRightColor: { type: String, default: "btn-secondary" },
    border: { type: Boolean, default: true },
});
const emit = defineEmits([
    "left-click",
    "middle-left-click",
    "middle-right-click",
    "right-click",
]);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "join flex" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('left-click');
        } },
    type: "button",
    ...{ class: "btn join-item shadow-none rounded-l-full" },
    ...{ class: ([__VLS_ctx.leftColor, { 'border border-base-300': __VLS_ctx.border }]) },
});
(__VLS_ctx.leftLabel);
if (__VLS_ctx.middleLeftLabel) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.middleLeftLabel))
                    return;
                __VLS_ctx.emit('middle-left-click');
            } },
        type: "button",
        ...{ class: "btn join-item shadow-none" },
        ...{ class: ([__VLS_ctx.middleLeftColor, { 'border border-base-300': __VLS_ctx.border }]) },
    });
    (__VLS_ctx.middleLeftLabel);
}
if (__VLS_ctx.middleRightLabel) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.middleRightLabel))
                    return;
                __VLS_ctx.emit('middle-right-click');
            } },
        type: "button",
        ...{ class: "btn join-item shadow-none" },
        ...{ class: ([__VLS_ctx.middleRightColor, { 'border border-base-300': __VLS_ctx.border }]) },
    });
    (__VLS_ctx.middleRightLabel);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('right-click');
        } },
    type: "button",
    ...{ class: "btn join-item shadow-none rounded-r-full" },
    ...{ class: ([__VLS_ctx.rightColor, { 'border border-base-300': __VLS_ctx.border }]) },
});
(__VLS_ctx.rightLabel);
/** @type {__VLS_StyleScopedClasses['join']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['join-item']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-none']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-l-full']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['join-item']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-none']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['join-item']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-none']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['join-item']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-none']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-r-full']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            $props: __VLS_makeOptional(__VLS_props),
            ...__VLS_props,
            $emit: emit,
            emit: emit,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {
            $props: __VLS_makeOptional(__VLS_props),
            ...__VLS_props,
            $emit: emit,
        };
    },
});
; /* PartiallyEnd: #4569/main.vue */
