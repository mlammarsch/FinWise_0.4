import { ref, computed, watch, onMounted, nextTick, defineExpose } from "vue";
import { useRecipientStore } from "@/stores/recipientStore";
import { debugLog } from "@/utils/logger";
import { Icon } from "@iconify/vue";
const props = defineProps();
const emit = defineEmits(["update:modelValue", "select", "create"]);
const recipientStore = useRecipientStore();
const searchTerm = ref("");
const dropdownOpen = ref(false);
const highlightedIndex = ref(-1);
const inputRef = ref(null);
const selected = ref(props.modelValue || "");
/**
 * Initialisiert den Suchbegriff basierend auf der ausgewählten Empfänger-ID beim Laden.
 */
onMounted(() => {
    if (selected.value) {
        const recipient = recipientStore.recipients.find((r) => r.id === selected.value);
        if (recipient) {
            searchTerm.value = recipient.name;
            debugLog("[SelectRecipient] onMounted → set searchTerm", {
                id: recipient.id,
                name: recipient.name,
            });
        }
    }
});
/**
 * Synchronisiert den lokalen Zustand (selected, searchTerm) mit Änderungen der modelValue-Prop.
 */
watch(() => props.modelValue, (newVal) => {
    selected.value = newVal || "";
    const recipient = recipientStore.recipients.find((r) => r.id === newVal);
    if (recipient && searchTerm.value !== recipient.name) {
        searchTerm.value = recipient.name;
        debugLog("[SelectRecipient] watch:modelValue → set searchTerm", {
            id: recipient.id,
            name: recipient.name,
        });
    }
    else if (!newVal && searchTerm.value && !dropdownOpen.value) {
        // searchTerm.value = ""; // Behalte Text
    }
});
/**
 * Stößt das 'update:modelValue'-Event an, wenn sich die interne Auswahl ändert.
 */
watch(selected, (newVal) => {
    debugLog("[SelectRecipient] watch:selected → emit update:modelValue", {
        newVal,
    });
    emit("update:modelValue", newVal || undefined);
    emit("select", newVal || undefined);
});
/**
 * Filtert die Empfängerliste basierend auf dem Suchbegriff.
 */
const filteredRecipients = computed(() => {
    if (searchTerm.value.trim()) {
        const term = searchTerm.value.toLowerCase();
        return recipientStore.recipients
            .filter((r) => r.name.toLowerCase().includes(term))
            .sort((a, b) => a.name.localeCompare(b.name));
    }
    return recipientStore.recipients.sort((a, b) => a.name.localeCompare(b.name));
});
/**
 * Bestimmt, ob die Option zum Erstellen eines neuen Empfängers angezeigt werden soll.
 */
const canCreateRecipient = computed(() => {
    if (props.disabled)
        return false;
    const term = searchTerm.value.trim();
    if (!term)
        return false;
    return !recipientStore.recipients.some((r) => r.name.toLowerCase() === term.toLowerCase());
});
/**
 * Berechnet die Gesamtzahl der Optionen im Dropdown (Empfänger + ggf. "Neu erstellen").
 */
const totalOptionsCount = computed(() => {
    return filteredRecipients.value.length + (canCreateRecipient.value ? 1 : 0);
});
/**
 * Behandelt Tastatureingaben im Suchfeld (Pfeiltasten, Enter, Escape).
 */
function onKeyDown(e) {
    if (props.disabled)
        return;
    if (!dropdownOpen.value && !["Escape", "Tab"].includes(e.key)) {
        toggleDropdown();
        if (["ArrowDown", "ArrowUp", "Enter"].includes(e.key)) {
            e.preventDefault();
        }
        return;
    }
    switch (e.key) {
        case "ArrowDown":
            e.preventDefault();
            if (highlightedIndex.value < totalOptionsCount.value - 1) {
                highlightedIndex.value++;
                scrollToHighlighted();
            }
            break;
        case "ArrowUp":
            e.preventDefault();
            if (highlightedIndex.value > 0) {
                highlightedIndex.value--;
                scrollToHighlighted();
            }
            break;
        case "Enter":
            e.preventDefault();
            if (highlightedIndex.value >= 0 &&
                highlightedIndex.value < filteredRecipients.value.length) {
                selectRecipient(filteredRecipients.value[highlightedIndex.value]);
            }
            else if (highlightedIndex.value === filteredRecipients.value.length &&
                canCreateRecipient.value) {
                createRecipient();
            }
            else if (canCreateRecipient.value &&
                filteredRecipients.value.length === 0) {
                // Erlaube Erstellen auch ohne Highlight, wenn es die einzige Option ist
                createRecipient();
            }
            break;
        case "Escape":
            e.preventDefault();
            closeDropdown();
            break;
    }
}
/**
 * Scrollt die Dropdown-Liste, sodass die aktuell hervorgehobene Option sichtbar ist.
 */
function scrollToHighlighted() {
    let elementId = "";
    if (highlightedIndex.value >= 0 &&
        highlightedIndex.value < filteredRecipients.value.length) {
        const option = filteredRecipients.value[highlightedIndex.value];
        if (option) {
            elementId = `select-recipient-option-${option.id}`;
        }
    }
    else if (highlightedIndex.value === filteredRecipients.value.length &&
        canCreateRecipient.value) {
        elementId = "select-recipient-create-new";
    }
    if (elementId) {
        const el = document.getElementById(elementId);
        el?.scrollIntoView({ block: "nearest" });
    }
}
/**
 * Öffnet oder schließt das Dropdown-Menü. Setzt den Fokus und den Highlight-Index zurück beim Öffnen.
 */
function toggleDropdown() {
    if (props.disabled)
        return;
    dropdownOpen.value = !dropdownOpen.value;
    if (dropdownOpen.value) {
        highlightedIndex.value = -1;
        const currentSelectionIndex = filteredRecipients.value.findIndex((r) => r.id === selected.value);
        if (currentSelectionIndex !== -1) {
            highlightedIndex.value = currentSelectionIndex;
        }
        nextTick(() => {
            // Fokus wird durch onFocus gesetzt
            if (highlightedIndex.value !== -1) {
                scrollToHighlighted();
            }
        });
    }
}
/**
 * Schließt das Dropdown-Menü und stellt ggf. den Suchtext wieder her.
 */
function closeDropdown() {
    dropdownOpen.value = false;
    highlightedIndex.value = -1;
    const currentRecipient = recipientStore.recipients.find((r) => r.id === selected.value);
    if (currentRecipient && searchTerm.value !== currentRecipient.name) {
        searchTerm.value = currentRecipient.name;
    }
    else if (!selected.value) {
        // searchTerm.value = ""; // Behalte Text
    }
}
/**
 * Schließt das Dropdown verzögert, wenn der Fokus das Element verlässt.
 */
function onBlur(event) {
    if (props.disabled)
        return;
    setTimeout(() => {
        const relatedTarget = event.relatedTarget;
        // Prüfen ob der neue Fokus immer noch Teil der Komponente ist
        if (!relatedTarget || !relatedTarget.closest(".dropdown-container")) {
            closeDropdown();
        }
    }, 200);
}
/**
 * Markiert den gesamten Text im Inputfeld, wenn es den Fokus erhält, und öffnet ggf. das Dropdown.
 */
function onFocus(event) {
    if (props.disabled)
        return;
    const target = event.target;
    setTimeout(() => target.select(), 0);
    // Nur öffnen, wenn noch nicht offen
    if (!dropdownOpen.value) {
        toggleDropdown();
    }
}
/**
 * Wählt einen vorhandenen Empfänger aus, aktualisiert den Zustand und schließt das Dropdown.
 */
function selectRecipient(recipient) {
    if (props.disabled)
        return;
    debugLog("[SelectRecipient] selectRecipient", {
        id: recipient.id,
        name: recipient.name,
    });
    selected.value = recipient.id;
    searchTerm.value = recipient.name;
    closeDropdown();
    debugLog("[SelectRecipient] after selection", { selected: selected.value });
}
/**
 * Löst das 'create'-Event aus, um einen neuen Empfänger zu erstellen, und schließt das Dropdown.
 */
function createRecipient() {
    if (props.disabled || !canCreateRecipient.value)
        return;
    const name = searchTerm.value.trim();
    if (!name)
        return;
    emit("create", { name });
    debugLog("[SelectRecipient] createRecipient emitted", { name });
    closeDropdown(); // Schließen nach dem Emitten
}
/**
 * Löscht den Suchbegriff und die Auswahl, setzt den Fokus zurück auf das Inputfeld.
 */
function clearSearch() {
    if (props.disabled)
        return;
    searchTerm.value = "";
    selected.value = "";
    emit("update:modelValue", undefined);
    emit("select", undefined);
    inputRef.value?.focus();
    if (!dropdownOpen.value) {
        toggleDropdown();
    }
    else {
        highlightedIndex.value = -1;
    }
}
// Exponiert die focusInput Methode nach außen
function focusInput() {
    inputRef.value?.focus();
}
const __VLS_exposed = { focusInput };
defineExpose(__VLS_exposed);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "relative dropdown-container" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "relative" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onInput: (...[$event]) => {
            __VLS_ctx.dropdownOpen = true;
            __VLS_ctx.highlightedIndex = -1;
            ;
        } },
    ...{ onKeydown: (__VLS_ctx.onKeyDown) },
    ...{ onFocus: (__VLS_ctx.onFocus) },
    ...{ onBlur: (__VLS_ctx.onBlur) },
    ref: "inputRef",
    type: "text",
    ...{ class: "input input-bordered w-full pr-8" },
    ...{ class: ({ 'input-disabled opacity-70 cursor-not-allowed': __VLS_ctx.disabled }) },
    value: (__VLS_ctx.searchTerm),
    disabled: (__VLS_ctx.disabled),
    placeholder: "Empfänger suchen oder erstellen...",
    autocomplete: "off",
});
/** @type {typeof __VLS_ctx.inputRef} */ ;
if (__VLS_ctx.searchTerm && !__VLS_ctx.disabled) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onMousedown: (__VLS_ctx.clearSearch) },
        type: "button",
        ...{ class: "absolute right-2 top-1/2 transform -translate-y-1/2 text-base text-neutral/60 hover:text-error/60 btn btn-ghost btn-xs btn-circle" },
        'aria-label': "Suche löschen",
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
if (__VLS_ctx.dropdownOpen && !__VLS_ctx.disabled) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "absolute z-40 w-full bg-base-100 border border-base-300 rounded-lg mt-1 max-h-60 overflow-y-auto shadow-lg dropdown-container" },
        role: "listbox",
    });
    if (__VLS_ctx.filteredRecipients.length === 0 && !__VLS_ctx.canCreateRecipient) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "px-3 py-1.5 text-sm text-base-content/60 italic" },
        });
    }
    else {
        for (const [recipient, idx] of __VLS_getVForSourceType((__VLS_ctx.filteredRecipients))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ onMousedown: (...[$event]) => {
                        if (!(__VLS_ctx.dropdownOpen && !__VLS_ctx.disabled))
                            return;
                        if (!!(__VLS_ctx.filteredRecipients.length === 0 && !__VLS_ctx.canCreateRecipient))
                            return;
                        __VLS_ctx.selectRecipient(recipient);
                    } },
                id: ('select-recipient-option-' + recipient.id),
                key: (recipient.id),
                ...{ class: "px-3 py-1.5 text-sm cursor-pointer hover:bg-base-200" },
                ...{ class: ({
                        'bg-base-300': idx === __VLS_ctx.highlightedIndex, // Hervorhebung Tastatur
                        'font-medium': recipient.id === __VLS_ctx.selected, // Hervorhebung Auswahl
                    }) },
                role: "option",
                'aria-selected': (recipient.id === __VLS_ctx.selected),
            });
            (recipient.name);
        }
        if (__VLS_ctx.canCreateRecipient) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ onMousedown: (__VLS_ctx.createRecipient) },
                id: "select-recipient-create-new",
                ...{ class: "px-3 py-1.5 text-sm cursor-pointer hover:bg-base-200 border-t border-base-300 flex items-center gap-2" },
                ...{ class: ({
                        'bg-base-300': __VLS_ctx.highlightedIndex === __VLS_ctx.filteredRecipients.length,
                    }) },
                role: "option",
                'aria-selected': "false",
            });
            const __VLS_4 = {}.Icon;
            /** @type {[typeof __VLS_components.Icon, ]} */ ;
            // @ts-ignore
            const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
                icon: "mdi:plus-circle-outline",
                ...{ class: "text-lg" },
            }));
            const __VLS_6 = __VLS_5({
                icon: "mdi:plus-circle-outline",
                ...{ class: "text-lg" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_5));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            (__VLS_ctx.searchTerm);
        }
    }
}
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['dropdown-container']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['pr-8']} */ ;
/** @type {__VLS_StyleScopedClasses['input-disabled']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-not-allowed']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['right-2']} */ ;
/** @type {__VLS_StyleScopedClasses['top-1/2']} */ ;
/** @type {__VLS_StyleScopedClasses['transform']} */ ;
/** @type {__VLS_StyleScopedClasses['-translate-y-1/2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['text-neutral/60']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-error/60']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['z-40']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-60']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['dropdown-container']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['italic']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Icon: Icon,
            searchTerm: searchTerm,
            dropdownOpen: dropdownOpen,
            highlightedIndex: highlightedIndex,
            inputRef: inputRef,
            selected: selected,
            filteredRecipients: filteredRecipients,
            canCreateRecipient: canCreateRecipient,
            onKeyDown: onKeyDown,
            onBlur: onBlur,
            onFocus: onFocus,
            selectRecipient: selectRecipient,
            createRecipient: createRecipient,
            clearSearch: clearSearch,
        };
    },
    emits: {},
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {
            ...__VLS_exposed,
        };
    },
    emits: {},
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
