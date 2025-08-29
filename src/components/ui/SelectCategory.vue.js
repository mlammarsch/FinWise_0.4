import { ref, computed, watch, onMounted, nextTick, defineExpose } from "vue";
import { useCategoryStore } from "@/stores/categoryStore";
import { useTransactionStore } from "@/stores/transactionStore";
import CurrencyDisplay from "./CurrencyDisplay.vue";
import { debugLog } from "@/utils/logger";
import { Icon } from "@iconify/vue";
import { BalanceService } from "@/services/BalanceService";
const props = defineProps();
const emit = defineEmits(["update:modelValue", "select"]);
const categoryStore = useCategoryStore();
const transactionStore = useTransactionStore();
const searchTerm = ref("");
const dropdownOpen = ref(false);
const highlightedIndex = ref(0);
const inputRef = ref(null);
const selected = ref(props.modelValue || "");
/**
 * Initialisiert den Suchbegriff basierend auf der ausgewählten Kategorie-ID beim Laden.
 */
onMounted(() => {
    if (selected.value) {
        if (selected.value === "NO_CATEGORY") {
            searchTerm.value = "Keine Kategorie";
        }
        else {
            const cat = categoryStore.categories.find((c) => c.id === selected.value);
            if (cat) {
                searchTerm.value = cat.name;
                debugLog("[SelectCategory] onMounted → set searchTerm", {
                    id: cat.id,
                    name: cat.name,
                });
            }
        }
    }
});
/**
 * Synchronisiert den lokalen Zustand (selected, searchTerm) mit Änderungen der modelValue-Prop.
 */
watch(() => props.modelValue, (newVal) => {
    selected.value = newVal || "";
    if (newVal === "NO_CATEGORY") {
        searchTerm.value = "Keine Kategorie";
    }
    else {
        const cat = categoryStore.categories.find((c) => c.id === newVal);
        if (cat && searchTerm.value !== cat.name) {
            searchTerm.value = cat.name;
            debugLog("[SelectCategory] watch:modelValue → set searchTerm", {
                id: cat.id,
                name: cat.name,
            });
        }
    }
});
/**
 * Stößt das 'update:modelValue'-Event an, wenn sich die interne Auswahl ändert.
 */
watch(selected, (newVal) => {
    debugLog("[SelectCategory] watch:selected → emit update:modelValue", {
        newVal,
    });
    emit("update:modelValue", newVal || undefined);
    emit("select", newVal || undefined);
});
// Berechne aktuellen Monat für potentielle spätere Verwendung
const currentDate = new Date();
const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
const currentMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
const availableCategory = computed(() => categoryStore.getAvailableFundsCategory());
/**
 * Filtert Kategorien basierend auf filterOutArray und Suchbegriff.
 */
const filteredCategories = computed(() => {
    let cats = categoryStore.categories;
    if (props.filterOutArray?.length) {
        cats = cats.filter((cat) => !props.filterOutArray.includes(cat.id));
    }
    if (availableCategory.value) {
        cats = cats.filter((cat) => cat.id !== availableCategory.value?.id);
    }
    if (searchTerm.value.trim()) {
        const term = searchTerm.value.toLowerCase();
        cats = cats.filter((cat) => cat.name.toLowerCase().includes(term));
    }
    return cats;
});
const expenseCategories = computed(() => filteredCategories.value
    .filter((cat) => !cat.isIncomeCategory)
    .sort((a, b) => a.name.localeCompare(b.name)));
const incomeCategories = computed(() => filteredCategories.value
    .filter((cat) => cat.isIncomeCategory)
    .sort((a, b) => a.name.localeCompare(b.name)));
/**
 * Erstellt die Liste der Dropdown-Optionen, gruppiert nach Einnahmen/Ausgaben.
 */
const options = computed(() => {
    const opts = [];
    let includeAvailable = false;
    if (props.showNoneOption) {
        const noneOptionText = "Keine Kategorie";
        if (!searchTerm.value.trim() ||
            noneOptionText.toLowerCase().includes(searchTerm.value.toLowerCase())) {
            opts.push({
                isHeader: false,
                category: { id: "NO_CATEGORY", name: noneOptionText },
            });
        }
    }
    if (availableCategory.value) {
        const isFilteredOut = props.filterOutArray?.includes(availableCategory.value.id);
        if (!isFilteredOut) {
            includeAvailable =
                !searchTerm.value.trim() ||
                    availableCategory.value.name
                        .toLowerCase()
                        .includes(searchTerm.value.toLowerCase());
        }
    }
    if (includeAvailable) {
        opts.push({ isHeader: false, category: availableCategory.value });
    }
    if (expenseCategories.value.length) {
        if (!searchTerm.value.trim() ||
            incomeCategories.value.length > 0 ||
            includeAvailable) {
            opts.push({ isHeader: true, headerText: "Ausgaben" });
        }
        expenseCategories.value.forEach((cat) => opts.push({ isHeader: false, category: cat }));
    }
    if (incomeCategories.value.length) {
        if (!searchTerm.value.trim() ||
            expenseCategories.value.length > 0 ||
            includeAvailable) {
            opts.push({ isHeader: true, headerText: "Einnahmen" });
        }
        incomeCategories.value.forEach((cat) => opts.push({ isHeader: false, category: cat }));
    }
    return opts;
});
/**
 * Sichtbare Optionen im Dropdown.
 */
const visibleOptions = computed(() => dropdownOpen.value ? options.value : []);
/**
 * Nur Kategorie-Optionen ohne Header.
 */
const nonHeaderOptions = computed(() => visibleOptions.value.filter((opt) => !opt.isHeader));
/**
 * Aktuell hervorgehobene Option.
 */
const highlightedOption = computed(() => nonHeaderOptions.value[highlightedIndex.value]?.category);
/**
 * Tastatursteuerung (Pfeil, Enter, Escape).
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
            const cat = highlightedOption.value;
            if (cat)
                selectCategory(cat);
            break;
        case "Escape":
            e.preventDefault();
            closeDropdown();
            break;
    }
}
/**
 * Scrollt zur hervorgehobenen Option.
 */
function scrollToHighlighted() {
    const opt = nonHeaderOptions.value[highlightedIndex.value];
    if (opt?.category) {
        const el = document.getElementById(`select-category-option-${opt.category.id}`);
        el?.scrollIntoView({ block: "nearest" });
    }
}
/**
 * Öffnet oder schließt das Dropdown.
 */
function toggleDropdown() {
    dropdownOpen.value = !dropdownOpen.value;
    if (dropdownOpen.value) {
        highlightedIndex.value = nonHeaderOptions.value.findIndex((o) => o.category?.id === selected.value);
        if (highlightedIndex.value < 0)
            highlightedIndex.value = 0;
        nextTick(scrollToHighlighted);
    }
}
/**
 * Schließt das Dropdown und setzt Suchtext zurück.
 */
function closeDropdown() {
    dropdownOpen.value = false;
    if (selected.value === "NO_CATEGORY") {
        searchTerm.value = "Keine Kategorie";
    }
    else {
        const cat = categoryStore.categories.find((c) => c.id === selected.value);
        if (cat)
            searchTerm.value = cat.name;
    }
}
/**
 * Verzögerter Blur-Handler, um Klicks innerhalb des Dropdowns zu erlauben.
 */
function onBlur(event) {
    setTimeout(() => {
        const related = event.relatedTarget;
        if (!related || !related.closest(".dropdown-container")) {
            closeDropdown();
        }
    }, 200);
}
/**
 * Markiert gesamten Text und öffnet Dropdown beim Fokus.
 */
function onFocus(event) {
    setTimeout(() => event.target.select(), 0);
    if (!dropdownOpen.value) {
        toggleDropdown();
    }
}
/**
 * Kategorie auswählen.
 */
function selectCategory(cat) {
    debugLog("[SelectCategory] selectCategory", { id: cat.id, name: cat.name });
    selected.value = cat.id;
    searchTerm.value = cat.name;
    closeDropdown();
}
/**
 * Suche löschen und Dropdown öffnen.
 */
function clearSearch() {
    searchTerm.value = "";
    selected.value = "";
    emit("update:modelValue", undefined);
    emit("select", undefined);
    inputRef.value?.focus();
    dropdownOpen.value ? (highlightedIndex.value = 0) : toggleDropdown();
}
// Exponiert focusInput() nach außen
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
            __VLS_ctx.highlightedIndex = 0;
            ;
        } },
    ...{ onKeydown: (__VLS_ctx.onKeyDown) },
    ...{ onFocus: (__VLS_ctx.onFocus) },
    ...{ onBlur: (__VLS_ctx.onBlur) },
    ref: "inputRef",
    type: "text",
    ...{ class: ([
            'input input-bordered input-sm w-full pr-8',
            props.rounded ? 'rounded-full' : '',
        ]) },
    value: (__VLS_ctx.searchTerm),
    placeholder: "Kategorie suchen...",
    autocomplete: "off",
});
/** @type {typeof __VLS_ctx.inputRef} */ ;
if (__VLS_ctx.searchTerm) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onMousedown: (__VLS_ctx.clearSearch) },
        ...{ class: "absolute right-2 top-1/2 transform -translate-y-1/2 btn btn-ghost btn-xs btn-circle" },
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
        for (const [option] of __VLS_getVForSourceType((__VLS_ctx.visibleOptions))) {
            (option.isHeader ? 'header-' + option.headerText : option.category.id);
            if (option.isHeader) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "px-3 py-1 text-sm text-primary select-none sticky top-0 bg-base-200 z-10" },
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
                            __VLS_ctx.selectCategory(option.category);
                        } },
                    id: ('select-category-option-' + option.category.id),
                    ...{ class: "px-3 py-1 cursor-pointer hover:bg-base-200 flex justify-between items-center" },
                    ...{ class: ({
                            'bg-base-300': __VLS_ctx.nonHeaderOptions.findIndex((o) => o.category?.id === option.category.id) === __VLS_ctx.highlightedIndex,
                            'font-medium': option.category.id === __VLS_ctx.selected
                        }) },
                    role: "option",
                    'aria-selected': (option.category.id === __VLS_ctx.selected),
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                (option.category.name);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ class: "opacity-80" },
                });
                /** @type {[typeof CurrencyDisplay, ]} */ ;
                // @ts-ignore
                const __VLS_4 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                    amount: (__VLS_ctx.BalanceService.getTodayBalance('category', option.category.id)),
                    asInteger: (true),
                }));
                const __VLS_5 = __VLS_4({
                    amount: (__VLS_ctx.BalanceService.getTodayBalance('category', option.category.id)),
                    asInteger: (true),
                }, ...__VLS_functionalComponentArgsRest(__VLS_4));
            }
        }
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "px-3 py-1 text-xs text-base-content/60 italic" },
        });
    }
}
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['dropdown-container']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['pr-8']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['right-2']} */ ;
/** @type {__VLS_StyleScopedClasses['top-1/2']} */ ;
/** @type {__VLS_StyleScopedClasses['transform']} */ ;
/** @type {__VLS_StyleScopedClasses['-translate-y-1/2']} */ ;
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
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
/** @type {__VLS_StyleScopedClasses['sticky']} */ ;
/** @type {__VLS_StyleScopedClasses['top-0']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['italic']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            CurrencyDisplay: CurrencyDisplay,
            Icon: Icon,
            BalanceService: BalanceService,
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
            selectCategory: selectCategory,
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
