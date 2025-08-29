import { ref, onMounted, onUnmounted } from "vue";
import { Icon } from "@iconify/vue";
const props = defineProps();
const emit = defineEmits([
    "assign-account",
    "change-recipient",
    "assign-category",
    "assign-tags",
    "change-date",
    "set-reconciled",
    "remove-reconciled",
    "delete",
]);
const isDropdownOpen = ref(false);
const dropdownButtonRef = ref(null);
const menuRef = ref(null);
const menuStyle = ref({});
function openDropdown() {
    if (props.disabled || props.selectedCount === 0)
        return;
    if (!dropdownButtonRef.value)
        return;
    const rect = dropdownButtonRef.value.getBoundingClientRect();
    menuStyle.value = {
        position: "fixed",
        top: `${rect.bottom}px`,
        left: `${rect.right}px`,
        transform: "translateX(-100%)",
        zIndex: 5000,
    };
    isDropdownOpen.value = true;
}
function closeDropdown() {
    isDropdownOpen.value = false;
}
function toggleDropdown() {
    if (isDropdownOpen.value) {
        closeDropdown();
    }
    else {
        openDropdown();
    }
}
function handleClickOutside(event) {
    if ((menuRef.value && menuRef.value.contains(event.target)) ||
        (dropdownButtonRef.value &&
            dropdownButtonRef.value.contains(event.target))) {
        return;
    }
    closeDropdown();
}
function handleAction(action) {
    emit(action);
    closeDropdown();
}
onMounted(() => {
    document.addEventListener("click", handleClickOutside);
});
onUnmounted(() => {
    document.removeEventListener("click", handleClickOutside);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "relative" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.toggleDropdown) },
    ref: "dropdownButtonRef",
    ...{ class: "btn btn-sm btn-ghost btn-circle" },
    ...{ class: ({
            'btn-disabled opacity-50': __VLS_ctx.disabled || __VLS_ctx.selectedCount === 0,
        }) },
    disabled: (__VLS_ctx.disabled || __VLS_ctx.selectedCount === 0),
    title: (__VLS_ctx.selectedCount > 0
        ? `${__VLS_ctx.selectedCount} Transaktionen ausgewählt`
        : 'Keine Transaktionen ausgewählt'),
});
/** @type {typeof __VLS_ctx.dropdownButtonRef} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "relative" },
});
const __VLS_0 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    icon: "mdi:menu",
    ...{ class: "text-xl" },
}));
const __VLS_2 = __VLS_1({
    icon: "mdi:menu",
    ...{ class: "text-xl" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
if (__VLS_ctx.selectedCount > 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "absolute -top-2 -right-2 badge badge-primary badge-xs" },
    });
    (__VLS_ctx.selectedCount);
}
const __VLS_4 = {}.Teleport;
/** @type {[typeof __VLS_components.Teleport, typeof __VLS_components.Teleport, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    to: "body",
}));
const __VLS_6 = __VLS_5({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_7.slots.default;
if (__VLS_ctx.isDropdownOpen) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({
        ref: "menuRef",
        ...{ style: (__VLS_ctx.menuStyle) },
        ...{ class: "menu p-2 shadow bg-base-100 border border-base-300 rounded-box w-56" },
    });
    /** @type {typeof __VLS_ctx.menuRef} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
        ...{ class: "menu-title" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isDropdownOpen))
                    return;
                __VLS_ctx.handleAction('assign-account');
            } },
    });
    const __VLS_8 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        icon: "mdi:bank",
        ...{ class: "text-lg" },
    }));
    const __VLS_10 = __VLS_9({
        icon: "mdi:bank",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isDropdownOpen))
                    return;
                __VLS_ctx.handleAction('change-recipient');
            } },
    });
    const __VLS_12 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
        icon: "mdi:account",
        ...{ class: "text-lg" },
    }));
    const __VLS_14 = __VLS_13({
        icon: "mdi:account",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isDropdownOpen))
                    return;
                __VLS_ctx.handleAction('assign-category');
            } },
    });
    const __VLS_16 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
        icon: "mdi:folder",
        ...{ class: "text-lg" },
    }));
    const __VLS_18 = __VLS_17({
        icon: "mdi:folder",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_17));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isDropdownOpen))
                    return;
                __VLS_ctx.handleAction('assign-tags');
            } },
    });
    const __VLS_20 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
        icon: "mdi:tag-multiple",
        ...{ class: "text-lg" },
    }));
    const __VLS_22 = __VLS_21({
        icon: "mdi:tag-multiple",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isDropdownOpen))
                    return;
                __VLS_ctx.handleAction('change-date');
            } },
    });
    const __VLS_24 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
        icon: "mdi:calendar",
        ...{ class: "text-lg" },
    }));
    const __VLS_26 = __VLS_25({
        icon: "mdi:calendar",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
        ...{ class: "divider" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isDropdownOpen))
                    return;
                __VLS_ctx.handleAction('set-reconciled');
            } },
    });
    const __VLS_28 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
        icon: "mdi:check-circle",
        ...{ class: "text-lg" },
    }));
    const __VLS_30 = __VLS_29({
        icon: "mdi:check-circle",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_29));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isDropdownOpen))
                    return;
                __VLS_ctx.handleAction('remove-reconciled');
            } },
    });
    const __VLS_32 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
        icon: "mdi:close-circle",
        ...{ class: "text-lg" },
    }));
    const __VLS_34 = __VLS_33({
        icon: "mdi:close-circle",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
        ...{ class: "divider" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isDropdownOpen))
                    return;
                __VLS_ctx.handleAction('delete');
            } },
        ...{ class: "text-error" },
    });
    const __VLS_36 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
        icon: "mdi:trash-can",
        ...{ class: "text-lg" },
    }));
    const __VLS_38 = __VLS_37({
        icon: "mdi:trash-can",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_37));
}
var __VLS_7;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-disabled']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['-top-2']} */ ;
/** @type {__VLS_StyleScopedClasses['-right-2']} */ ;
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['menu']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
/** @type {__VLS_StyleScopedClasses['w-56']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-title']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Icon: Icon,
            isDropdownOpen: isDropdownOpen,
            dropdownButtonRef: dropdownButtonRef,
            menuRef: menuRef,
            menuStyle: menuStyle,
            toggleDropdown: toggleDropdown,
            handleAction: handleAction,
        };
    },
    emits: {},
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    emits: {},
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
