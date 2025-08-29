// src/components/ui/SelectAccount.vue
import { ref, computed, watch, onMounted, defineExpose, nextTick } from "vue";
import { useAccountStore } from "@/stores/accountStore";
import CurrencyDisplay from "./CurrencyDisplay.vue";
import { debugLog } from "@/utils/logger";
import { Icon } from "@iconify/vue";
import { AccountService } from "@/services/AccountService";
const props = defineProps();
const emit = defineEmits(["update:modelValue", "select"]);
const accountStore = useAccountStore();
const searchTerm = ref("");
const dropdownOpen = ref(false);
const highlightedIndex = ref(0);
const inputRef = ref(null);
const selected = ref(props.modelValue || "");
/**
 * Initialisiert den Suchbegriff basierend auf der ausgewählten Konto-ID beim Laden.
 */
onMounted(() => {
    if (selected.value) {
        const acc = accountStore.accounts.find((a) => a.id === selected.value);
        if (acc) {
            searchTerm.value = acc.name;
            debugLog("[SelectAccount] onMounted → set searchTerm", {
                id: acc.id,
                name: acc.name,
            });
        }
    }
});
/**
 * Synchronisiert den lokalen Zustand (selected, searchTerm) mit Änderungen der modelValue-Prop.
 */
watch(() => props.modelValue, (newVal) => {
    selected.value = newVal || "";
    const acc = accountStore.accounts.find((a) => a.id === newVal);
    if (acc && searchTerm.value !== acc.name) {
        searchTerm.value = acc.name;
        debugLog("[SelectAccount] watch:modelValue → set searchTerm", {
            id: acc.id,
            name: acc.name,
        });
    }
    else if (!newVal && searchTerm.value && !dropdownOpen.value) {
        // searchTerm.value = ""; // Deaktiviert, um Text bei versehentlichem Schließen zu behalten
    }
});
/**
 * Stößt das 'update:modelValue'-Event an, wenn sich die interne Auswahl ändert.
 */
watch(selected, (newVal) => {
    debugLog("[SelectAccount] watch:selected → emit update:modelValue", {
        newVal,
    });
    emit("update:modelValue", newVal || undefined);
    emit("select", newVal || undefined);
});
/**
 * Berechnet alle verfügbaren Optionen, inklusive Header für Kontogruppen.
 */
const options = computed(() => {
    const opts = [];
    accountStore.accountGroups.forEach((group) => {
        const groupAccounts = accountStore.accounts
            .filter((acc) => acc.accountGroupId === group.id && acc.isActive)
            .sort((a, b) => a.name.localeCompare(b.name)); // Sortieren innerhalb der Gruppe
        if (groupAccounts.length) {
            opts.push({ isHeader: true, headerText: group.name });
            groupAccounts.forEach((acc) => opts.push({ isHeader: false, account: acc }));
        }
    });
    const ungroupped = accountStore.accounts
        .filter((acc) => !acc.accountGroupId && acc.isActive)
        .sort((a, b) => a.name.localeCompare(b.name)); // Sortieren der ungruppierten
    if (ungroupped.length) {
        // Header nur anzeigen, wenn es auch gruppierte Konten gibt, oder wenn explizit gewünscht
        if (opts.length > 0 || ungroupped.length === accountStore.accounts.length) {
            opts.push({ isHeader: true, headerText: "Andere Konten" });
        }
        ungroupped.forEach((acc) => opts.push({ isHeader: false, account: acc }));
    }
    return opts;
});
/**
 * Filtert die Optionen basierend auf dem Suchbegriff und ob das Dropdown offen ist.
 */
const visibleOptions = computed(() => {
    if (!dropdownOpen.value)
        return [];
    if (searchTerm.value.trim()) {
        const term = searchTerm.value.toLowerCase();
        return options.value.filter((opt) => opt.isHeader ? false : opt.account.name.toLowerCase().includes(term));
    }
    return options.value;
});
/**
 * Gibt nur die tatsächlichen Konto-Optionen (keine Header) zurück, die sichtbar sind.
 */
const nonHeaderOptions = computed(() => visibleOptions.value.filter((opt) => !opt.isHeader));
/**
 * Gibt das aktuell durch Tastatur oder Maus hervorgehobene Konto zurück.
 */
const highlightedOption = computed(() => nonHeaderOptions.value[highlightedIndex.value]?.account);
/**
 * Behandelt Tastatureingaben im Suchfeld (Pfeiltasten, Enter, Escape).
 */
function onKeyDown(e) {
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
            if (highlightedIndex.value < nonHeaderOptions.value.length - 1) {
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
            const acc = highlightedOption.value;
            if (acc)
                selectAccount(acc);
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
    const acc = highlightedOption.value;
    if (acc) {
        const el = document.getElementById(`select-account-option-${acc.id}`);
        el?.scrollIntoView({ block: "nearest" });
    }
}
/**
 * Öffnet oder schließt das Dropdown-Menü. Setzt den Fokus und den Highlight-Index zurück beim Öffnen.
 */
function toggleDropdown() {
    dropdownOpen.value = !dropdownOpen.value;
    if (dropdownOpen.value) {
        highlightedIndex.value = 0;
        const currentSelectionIndex = nonHeaderOptions.value.findIndex((opt) => opt.account?.id === selected.value);
        if (currentSelectionIndex !== -1) {
            highlightedIndex.value = currentSelectionIndex;
        }
        nextTick(() => {
            // Fokus wird bereits durch onFocus gesetzt, wenn darüber geöffnet wird.
            // Hier ggf. nur noch scrollen.
            // inputRef.value?.focus();
            // inputRef.value?.select();
            scrollToHighlighted();
        });
    }
}
/**
 * Schließt das Dropdown-Menü.
 */
function closeDropdown() {
    dropdownOpen.value = false;
    const currentAcc = accountStore.accounts.find((a) => a.id === selected.value);
    if (currentAcc && searchTerm.value !== currentAcc.name) {
        searchTerm.value = currentAcc.name;
    }
    else if (!selected.value) {
        // searchTerm.value = ""; // Behalte Text bei
    }
}
/**
 * Schließt das Dropdown verzögert, wenn der Fokus das Element verlässt.
 */
function onBlur(event) {
    setTimeout(() => {
        const relatedTarget = event.relatedTarget;
        if (!relatedTarget || !relatedTarget.closest(".dropdown-container")) {
            closeDropdown();
        }
    }, 200);
}
/**
 * Markiert den gesamten Text im Inputfeld, wenn es den Fokus erhält und öffnet ggf. das Dropdown.
 */
function onFocus(event) {
    const target = event.target;
    setTimeout(() => target.select(), 0);
    // Nur öffnen, wenn noch nicht offen, um Flackern zu vermeiden
    if (!dropdownOpen.value) {
        toggleDropdown();
    }
}
/**
 * Wählt ein Konto aus, aktualisiert den Zustand und schließt das Dropdown.
 */
function selectAccount(acc) {
    debugLog("[SelectAccount] selectAccount", { id: acc.id, name: acc.name });
    selected.value = acc.id;
    searchTerm.value = acc.name;
    closeDropdown();
    debugLog("[SelectAccount] after selection", { selected: selected.value });
}
/**
 * Löscht den Suchbegriff und setzt den Fokus zurück auf das Inputfeld.
 */
function clearSearch() {
    searchTerm.value = "";
    selected.value = ""; // Auswahl aufheben
    emit("update:modelValue", undefined);
    emit("select", undefined);
    inputRef.value?.focus(); // Fokus zurückgeben
    if (!dropdownOpen.value) {
        toggleDropdown(); // Dropdown öffnen nach dem Löschen
    }
    else {
        highlightedIndex.value = 0; // Highlight zurücksetzen
    }
}
// Exponiert die focusInput Methode nach außen
const __VLS_exposed = { focusInput: () => inputRef.value?.focus() };
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
            __VLS_ctx.highlightedIndex = 0;
            ;
        } },
    ...{ onKeydown: (__VLS_ctx.onKeyDown) },
    ...{ onFocus: (__VLS_ctx.onFocus) },
    ...{ onBlur: (__VLS_ctx.onBlur) },
    ref: "inputRef",
    type: "text",
    ...{ class: "input input-bordered w-full pr-8" },
    value: (__VLS_ctx.searchTerm),
    placeholder: "Konto suchen...",
    autocomplete: "off",
});
/** @type {typeof __VLS_ctx.inputRef} */ ;
if (__VLS_ctx.searchTerm) {
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
if (__VLS_ctx.dropdownOpen) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "absolute z-40 w-full bg-base-100 border border-base-300 rounded-lg mt-1 max-h-60 overflow-y-auto shadow-lg dropdown-container" },
        role: "listbox",
    });
    if (__VLS_ctx.visibleOptions.length > 0) {
        for (const [option, idx] of __VLS_getVForSourceType((__VLS_ctx.visibleOptions))) {
            (option.isHeader ? 'header-' + idx : option.account?.id);
            if (option.isHeader) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "px-3 py-1.5 font-semibold text-sm text-primary select-none sticky top-0 bg-base-200 z-10" },
                    role: "separator",
                });
                (option.headerText);
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ onMousedown: (...[$event]) => {
                            if (!(__VLS_ctx.dropdownOpen))
                                return;
                            if (!(__VLS_ctx.visibleOptions.length > 0))
                                return;
                            if (!!(option.isHeader))
                                return;
                            __VLS_ctx.selectAccount(option.account);
                        } },
                    id: ('select-account-option-' + option.account.id),
                    ...{ class: "px-3 py-1.5 text-sm cursor-pointer hover:bg-base-200 flex justify-between items-center" },
                    ...{ class: ({
                            'bg-base-300': __VLS_ctx.nonHeaderOptions.findIndex((o) => o.account?.id === option.account?.id) === __VLS_ctx.highlightedIndex, // Hervorhebung für Tastatur
                            'font-medium': option.account?.id === __VLS_ctx.selected, // Hervorhebung für Auswahl
                        }) },
                    role: "option",
                    'aria-selected': (option.account?.id === __VLS_ctx.selected),
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                (option.account.name);
                if (option.account) {
                    /** @type {[typeof CurrencyDisplay, ]} */ ;
                    // @ts-ignore
                    const __VLS_4 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                        ...{ class: "text-xs opacity-80" },
                        amount: (__VLS_ctx.AccountService.getCurrentBalance(option.account.id)),
                        asInteger: (true),
                    }));
                    const __VLS_5 = __VLS_4({
                        ...{ class: "text-xs opacity-80" },
                        amount: (__VLS_ctx.AccountService.getCurrentBalance(option.account.id)),
                        asInteger: (true),
                    }, ...__VLS_functionalComponentArgsRest(__VLS_4));
                }
            }
        }
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "px-3 py-1.5 text-sm text-base-content/60 italic" },
        });
    }
}
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['dropdown-container']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['pr-8']} */ ;
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
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
/** @type {__VLS_StyleScopedClasses['sticky']} */ ;
/** @type {__VLS_StyleScopedClasses['top-0']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['italic']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            CurrencyDisplay: CurrencyDisplay,
            Icon: Icon,
            AccountService: AccountService,
            searchTerm: searchTerm,
            dropdownOpen: dropdownOpen,
            highlightedIndex: highlightedIndex,
            inputRef: inputRef,
            selected: selected,
            visibleOptions: visibleOptions,
            nonHeaderOptions: nonHeaderOptions,
            onKeyDown: onKeyDown,
            onBlur: onBlur,
            onFocus: onFocus,
            selectAccount: selectAccount,
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
