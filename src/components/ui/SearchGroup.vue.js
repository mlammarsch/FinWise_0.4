import { ref, defineEmits, defineProps } from "vue";
import { Icon } from "@iconify/vue";
/**
 * Pfad zur Komponente: components/ui/SearchGroup.vue
 * Eine Suchleiste mit optionalen Buttons und Events.
 *
 * Komponenten-Props:
 * - btnLeft?: string - Label für den linken Button (optional)
 * - btnLeftIcon?: string - Icon für den linken Button (optional)
 * - btnMiddle?: string - Label für den mittleren Button (optional)
 * - btnMiddleIcon?: string - Icon für den mittleren Button (optional)
 * - btnMiddleRight?: string - Label für den mittleren rechten Button (optional)
 * - btnMiddleRightIcon?: string - Icon für den mittleren rechten Button (optional)
 * - btnRight?: string - Label für den rechten Button (optional)
 * - btnRightIcon?: string - Icon für den rechten Button (optional)
 *
 * Emits:
 * - search: Löst eine Suche aus (bei Eingabe und Klick auf Lupe)
 * - btn-left-click: Wird ausgelöst, wenn der linke Button geklickt wird
 * - btn-middle-click: Wird ausgelöst, wenn der mittlere Button geklickt wird
 * - btn-middle-right-click: Wird ausgelöst, wenn der mittlere rechte Button geklickt wird
 * - btn-right-click: Wird ausgelöst, wenn der rechte Button geklickt wird
 */
const props = defineProps({
    btnLeft: String,
    btnLeftIcon: String,
    btnMiddle: String,
    btnMiddleIcon: String,
    btnMiddleRight: String,
    btnMiddleRightIcon: String,
    btnRight: String,
    btnRightIcon: String,
});
const searchQuery = ref("");
const emit = defineEmits([
    "search",
    "btn-left-click",
    "btn-middle-click",
    "btn-middle-right-click",
    "btn-right-click",
]);
const triggerSearch = () => {
    emit("search", searchQuery.value);
};
const clearSearch = () => {
    searchQuery.value = "";
    emit("search", "");
};
const selectAll = (e) => {
    const input = e.target;
    input.select();
};
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex justify-end w-full md:w-auto mt-2 md:mt-0" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "join flex items-center relative" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "relative" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onKeyup: (__VLS_ctx.triggerSearch) },
    ...{ onFocus: (__VLS_ctx.selectAll) },
    value: (__VLS_ctx.searchQuery),
    type: "text",
    placeholder: "Suche...",
    ...{ class: "input join-item rounded-l-full input-sm input-bordered border-1 border-base-300 text-center pr-8" },
});
if (__VLS_ctx.searchQuery) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.clearSearch) },
        ...{ class: "absolute right-2 top-1/2 -translate-y-1/2 text-base text-neutral/60 hover:text-error/60" },
    });
    const __VLS_0 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        icon: "mdi:close-circle-outline",
    }));
    const __VLS_2 = __VLS_1({
        icon: "mdi:close-circle-outline",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.triggerSearch) },
    ...{ class: "btn join-item btn-sm btn-soft border border-base-300 flex items-center justify-center" },
});
const __VLS_4 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    icon: "mdi:magnify",
    ...{ class: "text-lg" },
}));
const __VLS_6 = __VLS_5({
    icon: "mdi:magnify",
    ...{ class: "text-lg" },
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
if (__VLS_ctx.btnLeft) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.btnLeft))
                    return;
                __VLS_ctx.$emit('btn-left-click');
            } },
        ...{ class: "btn join-item btn-sm btn-soft border border-base-300 flex items-center justify-center" },
    });
    if (__VLS_ctx.btnLeftIcon) {
        const __VLS_8 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
            icon: (__VLS_ctx.btnLeftIcon),
            ...{ class: "mr-2" },
        }));
        const __VLS_10 = __VLS_9({
            icon: (__VLS_ctx.btnLeftIcon),
            ...{ class: "mr-2" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    }
    (__VLS_ctx.btnLeft);
}
if (__VLS_ctx.btnMiddle) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.btnMiddle))
                    return;
                __VLS_ctx.$emit('btn-middle-click');
            } },
        ...{ class: "btn join-item btn-sm btn-soft border border-base-300 flex items-center justify-center" },
    });
    if (__VLS_ctx.btnMiddleIcon) {
        const __VLS_12 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
            icon: (__VLS_ctx.btnMiddleIcon),
            ...{ class: "mr-2" },
        }));
        const __VLS_14 = __VLS_13({
            icon: (__VLS_ctx.btnMiddleIcon),
            ...{ class: "mr-2" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    }
    (__VLS_ctx.btnMiddle);
}
if (__VLS_ctx.btnMiddleRight) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.btnMiddleRight))
                    return;
                __VLS_ctx.$emit('btn-middle-right-click');
            } },
        ...{ class: "btn join-item btn-sm btn-soft border border-base-300 flex items-center justify-center" },
    });
    if (__VLS_ctx.btnMiddleRightIcon) {
        const __VLS_16 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
            icon: (__VLS_ctx.btnMiddleRightIcon),
            ...{ class: "mr-2" },
        }));
        const __VLS_18 = __VLS_17({
            icon: (__VLS_ctx.btnMiddleRightIcon),
            ...{ class: "mr-2" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_17));
    }
    (__VLS_ctx.btnMiddleRight);
}
if (__VLS_ctx.btnRight) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.btnRight))
                    return;
                __VLS_ctx.$emit('btn-right-click');
            } },
        ...{ class: "btn join-item btn-sm btn-soft border border-base-300 flex items-center justify-center rounded-r-full pr-5" },
    });
    if (__VLS_ctx.btnRightIcon) {
        const __VLS_20 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
            icon: (__VLS_ctx.btnRightIcon),
            ...{ class: "" },
        }));
        const __VLS_22 = __VLS_21({
            icon: (__VLS_ctx.btnRightIcon),
            ...{ class: "" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    }
    (__VLS_ctx.btnRight);
}
/** @type {__VLS_StyleScopedClasses['']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['md:w-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['md:mt-0']} */ ;
/** @type {__VLS_StyleScopedClasses['join']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['join-item']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-l-full']} */ ;
/** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['border-1']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['pr-8']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['right-2']} */ ;
/** @type {__VLS_StyleScopedClasses['top-1/2']} */ ;
/** @type {__VLS_StyleScopedClasses['-translate-y-1/2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['text-neutral/60']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-error/60']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['join-item']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['join-item']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['join-item']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['join-item']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['join-item']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-r-full']} */ ;
/** @type {__VLS_StyleScopedClasses['pr-5']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            $props: __VLS_makeOptional(props),
            ...props,
            $emit: emit,
            Icon: Icon,
            searchQuery: searchQuery,
            triggerSearch: triggerSearch,
            clearSearch: clearSearch,
            selectAll: selectAll,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {
            $props: __VLS_makeOptional(props),
            ...props,
            $emit: emit,
        };
    },
});
; /* PartiallyEnd: #4569/main.vue */
