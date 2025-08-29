import { computed } from "vue";
import { Icon } from "@iconify/vue";
const props = defineProps();
const emit = defineEmits();
const defaultOptions = [10, 20, 25, 50, 100, 500, "all"];
const pageOptions = computed(() => props.itemsPerPageOptions ?? defaultOptions);
const getPageNumbers = computed(() => {
    const pages = [];
    if (props.totalPages <= 5) {
        for (let i = 1; i <= props.totalPages; i++)
            pages.push(i);
    }
    else {
        pages.push(1);
        if (props.currentPage > 3)
            pages.push("...");
        let start = Math.max(2, props.currentPage - 1);
        let end = Math.min(props.totalPages - 1, props.currentPage + 1);
        for (let i = start; i <= end; i++)
            pages.push(i);
        if (props.currentPage < props.totalPages - 2)
            pages.push("...");
        pages.push(props.totalPages);
    }
    return pages;
});
const selectPage = (page) => {
    if (page !== "..." && page !== props.currentPage) {
        emit("update:currentPage", page);
    }
};
const changeItemsPerPage = (e) => {
    const value = e.target.value;
    const parsed = value === "all" ? "all" : parseInt(value);
    emit("update:itemsPerPage", parsed);
};
const nextPage = () => {
    if (props.currentPage < props.totalPages) {
        emit("update:currentPage", props.currentPage + 1);
    }
};
const prevPage = () => {
    if (props.currentPage > 1) {
        emit("update:currentPage", props.currentPage - 1);
    }
};
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div)({
    ...{ class: "divider mt-5 mb-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex justify-between items-center flex-wrap gap-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "form-control" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "label cursor-pointer space-x-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "label-text" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
    ...{ onChange: (__VLS_ctx.changeItemsPerPage) },
    ...{ class: "select select-sm rounded-full border border-base-300" },
    value: (__VLS_ctx.itemsPerPage),
});
for (const [option] of __VLS_getVForSourceType((__VLS_ctx.pageOptions))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        key: (option),
        value: (option),
    });
    (option);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex justify-center flex-1" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "join" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.prevPage) },
    ...{ class: "join-item btn btn-sm rounded-l-full border border-base-300 flex items-center justify-center" },
    disabled: (__VLS_ctx.currentPage === 1),
});
const __VLS_0 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    icon: "mdi:chevron-left",
    ...{ class: "text-base" },
}));
const __VLS_2 = __VLS_1({
    icon: "mdi:chevron-left",
    ...{ class: "text-base" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
for (const [page] of __VLS_getVForSourceType((__VLS_ctx.getPageNumbers))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.selectPage(page);
            } },
        key: (page),
        ...{ class: "join-item btn btn-sm border border-base-300 shadow-none" },
        ...{ class: ({
                'btn-disabled': page === '...',
                'btn-primary': page === __VLS_ctx.currentPage,
            }) },
    });
    (page);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.nextPage) },
    ...{ class: "join-item btn btn-sm rounded-r-full border border-base-300 flex items-center justify-center" },
    disabled: (__VLS_ctx.currentPage === __VLS_ctx.totalPages),
});
const __VLS_4 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    icon: "mdi:chevron-right",
    ...{ class: "text-base" },
}));
const __VLS_6 = __VLS_5({
    icon: "mdi:chevron-right",
    ...{ class: "text-base" },
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "text-sm text-right whitespace-nowrap" },
});
(__VLS_ctx.currentPage);
(__VLS_ctx.totalPages);
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['join']} */ ;
/** @type {__VLS_StyleScopedClasses['join-item']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-l-full']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['join-item']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-none']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-disabled']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['join-item']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-r-full']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Icon: Icon,
            pageOptions: pageOptions,
            getPageNumbers: getPageNumbers,
            selectPage: selectPage,
            changeItemsPerPage: changeItemsPerPage,
            nextPage: nextPage,
            prevPage: prevPage,
        };
    },
    __typeEmits: {},
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeEmits: {},
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
