import { ref, computed, watch } from "vue";
import { Icon } from "@iconify/vue";
const props = defineProps();
const emit = defineEmits(["update:modelValue", "create"]);
const searchTerm = ref("");
const isOpen = ref(false);
// Stelle sicher, dass modelValue nie null ist
const selectedValue = computed({
    get: () => props.modelValue !== null ? props.modelValue : props.multiple ? [] : "",
    set: (val) => emit("update:modelValue", val),
});
// Gefilterte Optionen: bereits ausgewählte Werte werden ausgeblendet und alphabetisch sortiert.
const filteredOptions = computed(() => {
    let base = props.options;
    if (props.multiple) {
        base = base.filter((option) => !selectedValue.value.includes(option.id));
    }
    else if (selectedValue.value) {
        base = base.filter((option) => option.id !== selectedValue.value);
    }
    if (searchTerm.value) {
        const term = searchTerm.value.toLowerCase();
        base = base.filter((option) => option.name.toLowerCase().includes(term));
    }
    return base.sort((a, b) => a.name.localeCompare(b.name));
});
// Computed: Prüfe, ob eine neue Option erstellt werden kann
const canCreate = computed(() => {
    if (!props.allowCreate)
        return false;
    const term = searchTerm.value.trim().toLowerCase();
    if (!term)
        return false;
    return !props.options.some((option) => option.name.toLowerCase() === term);
});
// Prüfe, ob eine Option ausgewählt ist
const isSelected = (id) => {
    return props.multiple
        ? selectedValue.value.includes(id)
        : selectedValue.value === id;
};
// Wähle eine Option aus oder entferne sie
const toggleOption = (id) => {
    if (props.disabled)
        return;
    if (props.multiple) {
        const current = [...selectedValue.value];
        const idx = current.indexOf(id);
        if (idx === -1) {
            current.push(id);
        }
        else {
            current.splice(idx, 1);
        }
        selectedValue.value = current;
    }
    else {
        selectedValue.value = id;
        isOpen.value = false;
    }
    searchTerm.value = "";
};
// Erstellt eine neue Option und gibt sie an den Parent weiter
function createOption() {
    if (!searchTerm.value.trim() || !props.allowCreate)
        return;
    const newOption = { name: searchTerm.value.trim() };
    emit("create", newOption);
    searchTerm.value = "";
    isOpen.value = false;
}
// Wird beim Drücken der Enter-Taste ausgelöst
function onEnter() {
    if (canCreate.value) {
        createOption();
    }
}
// Zeige den Namen der ausgewählten Option(en)
const selectedDisplay = computed(() => {
    if (props.multiple) {
        const selectedOpts = props.options.filter((option) => selectedValue.value.includes(option.id));
        if (selectedOpts.length === 0)
            return "";
        if (selectedOpts.length === 1)
            return selectedOpts[0].name;
        return `${selectedOpts.length} ausgewählt`;
    }
    else {
        return (props.options.find((option) => option.id === selectedValue.value)?.name ||
            "");
    }
});
// Schließt das Dropdown, wenn außerhalb geklickt wird
const closeDropdown = (event) => {
    const target = event.target;
    if (!target.closest(".custom-select")) {
        isOpen.value = false;
    }
};
// Event-Listener an/abmelden
watch(isOpen, (newValue) => {
    if (newValue) {
        setTimeout(() => {
            window.addEventListener("click", closeDropdown);
        }, 0);
    }
    else {
        window.removeEventListener("click", closeDropdown);
    }
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "form-control w-full custom-select relative" },
});
if (__VLS_ctx.label) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label-text" },
    });
    (__VLS_ctx.label);
    if (__VLS_ctx.required) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-error" },
        });
    }
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "relative" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.isOpen = !__VLS_ctx.disabled && !__VLS_ctx.isOpen;
        } },
    ...{ class: "input input-bordered w-full flex items-center justify-between cursor-pointer" },
    ...{ class: ({ 'opacity-70': __VLS_ctx.disabled }) },
});
if (__VLS_ctx.selectedDisplay) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "truncate" },
    });
    (__VLS_ctx.selectedDisplay);
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-base-content/50" },
    });
    (__VLS_ctx.placeholder || "Auswählen...");
}
const __VLS_0 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    icon: "mdi:arrow-down-drop",
    ...{ class: "ml-2 text-lg" },
}));
const __VLS_2 = __VLS_1({
    icon: "mdi:arrow-down-drop",
    ...{ class: "ml-2 text-lg" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
if (__VLS_ctx.isOpen) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mt-1 w-full bg-base-100 rounded-box shadow-lg border border-base-300 absolute z-40" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "px-2 pt-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        ...{ onClick: () => { } },
        ...{ onKeydown: (__VLS_ctx.onEnter) },
        type: "text",
        ...{ class: "input input-sm input-bordered border-base-300 w-full" },
        value: (__VLS_ctx.searchTerm),
        placeholder: "Suchen oder neu anlegen...",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({
        ...{ class: "max-h-60 overflow-y-auto p-2" },
    });
    for (const [option] of __VLS_getVForSourceType((__VLS_ctx.filteredOptions))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.isOpen))
                        return;
                    __VLS_ctx.toggleOption(option.id);
                } },
            key: (option.id),
            ...{ class: "" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
            ...{ class: "flex items-center space-x-2 cursor-pointer hover:bg-base-200 rounded-lg p-1" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (option.name);
    }
    if (__VLS_ctx.filteredOptions.length === 0 && __VLS_ctx.searchTerm) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
            ...{ class: "" },
        });
        if (__VLS_ctx.allowCreate) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ onClick: (__VLS_ctx.createOption) },
                ...{ class: "p-2 hover:bg-base-200 rounded-lg cursor-pointer" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "flex items-center hover:bg-base-300 bg-base-200 rounded-lg p-1" },
            });
            const __VLS_4 = {}.Icon;
            /** @type {[typeof __VLS_components.Icon, ]} */ ;
            // @ts-ignore
            const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
                icon: "mdi:plus-circle",
                ...{ class: "mr-2 text-lg" },
            }));
            const __VLS_6 = __VLS_5({
                icon: "mdi:plus-circle",
                ...{ class: "mr-2 text-lg" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_5));
            (__VLS_ctx.searchTerm);
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "p-2 text-base-content/50" },
            });
        }
    }
}
/** @type {__VLS_StyleScopedClasses['']} */ ;
/** @type {__VLS_StyleScopedClasses['']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['custom-select']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/50']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['z-40']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-60']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/50']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Icon: Icon,
            searchTerm: searchTerm,
            isOpen: isOpen,
            filteredOptions: filteredOptions,
            toggleOption: toggleOption,
            createOption: createOption,
            onEnter: onEnter,
            selectedDisplay: selectedDisplay,
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
