import { ref, computed, watch, nextTick } from "vue";
import { Icon } from "@iconify/vue";
import BadgeSoft from "./BadgeSoft.vue";
import { getRandomTagColor } from "../../utils/tagColorUtils";
const props = defineProps();
const emit = defineEmits(["update:modelValue", "create"]);
// Ausgewählte Tag-IDs
const selectedTags = computed({
    get: () => props.modelValue || [],
    set: (val) => emit("update:modelValue", val),
});
// Hilfsfunktion zum Suchen einer Option anhand der Tag-ID
function getTagOption(tagId) {
    return props.options.find((option) => option.id === tagId);
}
// Suchfeld und Dropdown-Status
const searchTerm = ref("");
const isOpen = ref(false);
const highlightedIndex = ref(-1); // -1 = Suchfeld fokussiert, 0+ = Option Index
// Gefilterte Optionen basierend auf dem Suchbegriff,
// es werden bereits ausgewählte Tags nicht angezeigt und alphabetisch sortiert.
const filteredOptions = computed(() => {
    let opts = props.options.filter((opt) => !selectedTags.value.includes(opt.id));
    if (searchTerm.value) {
        const term = searchTerm.value.toLowerCase();
        opts = opts.filter((opt) => opt.name.toLowerCase().includes(term));
    }
    return opts.sort((a, b) => a.name.localeCompare(b.name));
});
// Erlaubt das Anlegen eines neuen Tags, wenn der Suchbegriff nicht exakt existiert
const canCreate = computed(() => {
    const term = searchTerm.value.trim().toLowerCase();
    if (!term)
        return false;
    return !props.options.some((opt) => opt.name.toLowerCase() === term);
});
// Gesamtanzahl der navigierbaren Optionen (gefilterte Tags + "neu anlegen" Option)
const totalOptions = computed(() => {
    return filteredOptions.value.length + (canCreate.value ? 1 : 0);
});
// Fügt einen Tag in die Auswahl ein
function addTag(tagId) {
    if (props.disabled)
        return;
    if (!selectedTags.value.includes(tagId)) {
        selectedTags.value = [...selectedTags.value, tagId];
    }
    searchTerm.value = "";
    isOpen.value = false;
    highlightedIndex.value = -1;
}
// Entfernt einen Tag aus der Auswahl
function removeTag(tagId) {
    selectedTags.value = selectedTags.value.filter((id) => id !== tagId);
}
// Erstellt eine neue Option und gibt sie an den Parent weiter
function createOption() {
    const val = searchTerm.value.trim();
    if (!val)
        return;
    emit("create", { name: val, color: getRandomTagColor() });
    searchTerm.value = "";
    isOpen.value = false;
    highlightedIndex.value = -1;
}
// Behandelt Tastatureingaben im Suchfeld
function handleKeydown(event) {
    if (!isOpen.value)
        return;
    switch (event.key) {
        case "ArrowDown":
            event.preventDefault();
            if (highlightedIndex.value < totalOptions.value - 1) {
                highlightedIndex.value++;
            }
            break;
        case "ArrowUp":
            event.preventDefault();
            if (highlightedIndex.value > -1) {
                highlightedIndex.value--;
            }
            if (highlightedIndex.value === -1) {
                // Fokus zurück ins Suchfeld
                nextTick(() => {
                    const input = document.getElementById("tag-search-input");
                    if (input)
                        input.focus();
                });
            }
            break;
        case "Enter":
            event.preventDefault();
            if (highlightedIndex.value === -1) {
                // Im Suchfeld - neuen Tag erstellen falls möglich
                if (canCreate.value) {
                    createOption();
                }
            }
            else if (highlightedIndex.value < filteredOptions.value.length) {
                // Tag aus der Liste auswählen
                const selectedOption = filteredOptions.value[highlightedIndex.value];
                if (selectedOption) {
                    addTag(selectedOption.id);
                }
            }
            else if (canCreate.value) {
                // "Neu anlegen" Option ausgewählt
                createOption();
            }
            break;
        case "Escape":
            event.preventDefault();
            isOpen.value = false;
            highlightedIndex.value = -1;
            break;
    }
}
// Öffnet/Schließt das Dropdown
function toggleDropdown() {
    if (props.disabled)
        return;
    isOpen.value = !isOpen.value;
    highlightedIndex.value = -1;
    if (isOpen.value) {
        nextTick(() => {
            const input = document.getElementById("tag-search-input");
            if (input)
                input.focus();
        });
    }
}
// Schließt das Dropdown, wenn außerhalb geklickt wird
function handleClickOutside(event) {
    const target = event.target;
    if (!target.closest(".tag-search-dropdown-container")) {
        isOpen.value = false;
        highlightedIndex.value = -1;
    }
}
// Event-Listener an/abmelden
watch(isOpen, (val) => {
    if (val) {
        window.addEventListener("click", handleClickOutside);
    }
    else {
        window.removeEventListener("click", handleClickOutside);
        highlightedIndex.value = -1;
    }
});
// Setzt highlightedIndex zurück, wenn sich die gefilterten Optionen ändern
watch(filteredOptions, () => {
    if (highlightedIndex.value >= totalOptions.value) {
        highlightedIndex.value = totalOptions.value - 1;
    }
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "form-control w-full tag-search-dropdown-container relative" },
    ...{ style: {} },
});
if (__VLS_ctx.label) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label-text" },
    });
    (__VLS_ctx.label);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex flex-wrap items-center gap-1 mb-0 border rounded-lg p-2" },
});
for (const [tagId] of __VLS_getVForSourceType((__VLS_ctx.selectedTags))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (tagId),
        ...{ class: "flex items-center gap-1" },
    });
    /** @type {[typeof BadgeSoft, ]} */ ;
    // @ts-ignore
    const __VLS_0 = __VLS_asFunctionalComponent(BadgeSoft, new BadgeSoft({
        label: (__VLS_ctx.getTagOption(tagId)?.name || tagId),
        colorIntensity: (__VLS_ctx.getTagOption(tagId)?.color || 'neutral'),
    }));
    const __VLS_1 = __VLS_0({
        label: (__VLS_ctx.getTagOption(tagId)?.name || tagId),
        colorIntensity: (__VLS_ctx.getTagOption(tagId)?.color || 'neutral'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_0));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.removeTag(tagId);
            } },
        type: "button",
        ...{ class: "btn btn-ghost btn-xs text-neutral p-0 ml-1" },
    });
    const __VLS_3 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_4 = __VLS_asFunctionalComponent(__VLS_3, new __VLS_3({
        icon: "mdi:close",
        ...{ class: "text-sm" },
    }));
    const __VLS_5 = __VLS_4({
        icon: "mdi:close",
        ...{ class: "text-sm" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_4));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ onClick: (__VLS_ctx.toggleDropdown) },
    ...{ class: "cursor-pointer text-base-content/50 flex items-center" },
    ...{ class: ({ 'opacity-50': __VLS_ctx.disabled }) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.placeholder || "");
const __VLS_7 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({
    icon: "mdi:plus-circle",
    ...{ class: "text-lg" },
}));
const __VLS_9 = __VLS_8({
    icon: "mdi:plus-circle",
    ...{ class: "text-lg" },
}, ...__VLS_functionalComponentArgsRest(__VLS_8));
if (__VLS_ctx.isOpen) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "bg-base-100 border border-base-300 rounded-box shadow-lg p-2 w-72 absolute z-40" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        ...{ onClick: () => { } },
        ...{ onKeydown: (__VLS_ctx.handleKeydown) },
        id: "tag-search-input",
        ...{ class: "input input-sm border-base-300 w-full mb-1" },
        type: "text",
        value: (__VLS_ctx.searchTerm),
        placeholder: "Suchen oder neu anlegen...",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({
        ...{ class: "max-h-60 overflow-y-auto" },
    });
    for (const [option, index] of __VLS_getVForSourceType((__VLS_ctx.filteredOptions))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.isOpen))
                        return;
                    __VLS_ctx.addTag(option.id);
                } },
            ...{ onMouseenter: (...[$event]) => {
                    if (!(__VLS_ctx.isOpen))
                        return;
                    __VLS_ctx.highlightedIndex = index;
                } },
            key: (option.id),
            ...{ class: "p-1 px-2 rounded-lg cursor-pointer flex items-center gap-2" },
            ...{ class: ({
                    'bg-primary text-primary-content': __VLS_ctx.highlightedIndex === index,
                    'hover:bg-base-200': __VLS_ctx.highlightedIndex !== index,
                }) },
        });
        /** @type {[typeof BadgeSoft, ]} */ ;
        // @ts-ignore
        const __VLS_11 = __VLS_asFunctionalComponent(BadgeSoft, new BadgeSoft({
            label: (option.name),
            colorIntensity: (option.color || 'neutral'),
        }));
        const __VLS_12 = __VLS_11({
            label: (option.name),
            colorIntensity: (option.color || 'neutral'),
        }, ...__VLS_functionalComponentArgsRest(__VLS_11));
    }
    if (__VLS_ctx.canCreate) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ onClick: (__VLS_ctx.createOption) },
            ...{ onMouseenter: (...[$event]) => {
                    if (!(__VLS_ctx.isOpen))
                        return;
                    if (!(__VLS_ctx.canCreate))
                        return;
                    __VLS_ctx.highlightedIndex = __VLS_ctx.filteredOptions.length;
                } },
            ...{ class: "py-1 px-2 rounded-lg cursor-pointer flex items-center justify-left" },
            ...{ class: ({
                    'bg-primary text-primary-content': __VLS_ctx.highlightedIndex === __VLS_ctx.filteredOptions.length,
                    'hover:bg-base-300 bg-base-200': __VLS_ctx.highlightedIndex !== __VLS_ctx.filteredOptions.length,
                }) },
        });
        const __VLS_14 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_15 = __VLS_asFunctionalComponent(__VLS_14, new __VLS_14({
            icon: "mdi:plus",
            ...{ class: "text-md mr-1" },
        }));
        const __VLS_16 = __VLS_15({
            icon: "mdi:plus",
            ...{ class: "text-md mr-1" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_15));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        (__VLS_ctx.searchTerm);
    }
}
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['tag-search-dropdown-container']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-0']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-neutral']} */ ;
/** @type {__VLS_StyleScopedClasses['p-0']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/50']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-72']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['z-40']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-60']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary-content']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-left']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary-content']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-md']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Icon: Icon,
            BadgeSoft: BadgeSoft,
            selectedTags: selectedTags,
            getTagOption: getTagOption,
            searchTerm: searchTerm,
            isOpen: isOpen,
            highlightedIndex: highlightedIndex,
            filteredOptions: filteredOptions,
            canCreate: canCreate,
            addTag: addTag,
            removeTag: removeTag,
            createOption: createOption,
            handleKeydown: handleKeydown,
            toggleDropdown: toggleDropdown,
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
