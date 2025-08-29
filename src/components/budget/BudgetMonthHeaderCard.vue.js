import CurrencyDisplay from "../ui/CurrencyDisplay.vue";
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useCategoryStore } from "../../stores/categoryStore";
import ConfirmationModal from "../ui/ConfirmationModal.vue";
import { Icon } from "@iconify/vue";
import { BudgetService } from "../../services/BudgetService";
import { debugLog } from "../../utils/logger";
import { toDateOnlyString } from "../../utils/formatters";
const props = defineProps();
const categoryStore = useCategoryStore();
/* ----------------------------------------------------------- */
/* ------------------- Monats‑Hilfslogik --------------------- */
/* ----------------------------------------------------------- */
const isCurrentMonth = computed(() => {
    if (!props.month)
        return false;
    const now = new Date(toDateOnlyString(new Date()));
    const monthStart = new Date(toDateOnlyString(props.month.start));
    return (now.getFullYear() === monthStart.getFullYear() &&
        now.getMonth() === monthStart.getMonth());
});
/* ----------------------------------------------------------- */
/* ------------------- Budget-Aktions-Menü ------------------- */
/* ----------------------------------------------------------- */
const isBudgetMenuOpen = ref(false);
const budgetMenuButtonRef = ref(null);
const budgetMenuRef = ref(null);
const budgetMenuStyle = ref({});
function openBudgetMenu() {
    if (!budgetMenuButtonRef.value)
        return;
    const rect = budgetMenuButtonRef.value.getBoundingClientRect();
    budgetMenuStyle.value = {
        position: "fixed",
        top: `${rect.bottom}px`,
        left: `${rect.right}px`,
        transform: "translateX(-100%)",
        zIndex: 5000,
    };
    isBudgetMenuOpen.value = true;
}
function closeBudgetMenu() {
    isBudgetMenuOpen.value = false;
}
function toggleBudgetMenu() {
    if (isBudgetMenuOpen.value) {
        closeBudgetMenu();
    }
    else {
        openBudgetMenu();
    }
}
function handleBudgetMenuClickOutside(event) {
    if ((budgetMenuRef.value && budgetMenuRef.value.contains(event.target)) ||
        (budgetMenuButtonRef.value &&
            budgetMenuButtonRef.value.contains(event.target))) {
        return;
    }
    closeBudgetMenu();
}
function handleBudgetAction(action) {
    debugLog("[BudgetMonthHeaderCard]", `Budget-Aktion ausgeführt: ${action}`);
    if (!props.month) {
        console.warn('Kein Monat definiert für Budget-Aktion');
        return;
    }
    // Menü sofort schließen für bessere UX
    closeBudgetMenu();
    // Asynchrone Aktionen im Hintergrund ausführen
    switch (action) {
        case 'carry-surplus':
            console.log('Überschuss in Folgemonat übertragen');
            break;
        case 'show-template':
            console.log('Budget-Template anzeigen');
            break;
        case 'apply-template':
            handleApplyTemplate().catch(error => {
                console.error('Fehler beim Anwenden des Budget-Templates:', error);
            });
            break;
        case 'overwrite-template':
            handleOverwriteTemplate().catch(error => {
                console.error('Fehler beim Überschreiben mit Budget-Template:', error);
            });
            break;
        case 'copy-last-month':
            console.log('Letztes Monatsbudget kopieren');
            break;
        case 'set-3month-average':
            console.log('3-Monats-Durchschnitt setzen');
            break;
        case 'reset-budget':
            handleResetBudget();
            break;
    }
}
async function handleApplyTemplate() {
    if (!props.month)
        return;
    try {
        debugLog("[BudgetMonthHeaderCard]", `Wende Budget-Template an für ${props.month.start.toISOString().split('T')[0]} bis ${props.month.end.toISOString().split('T')[0]}`);
        const transfersCreated = await BudgetService.applyBudgetTemplate(props.month.start, props.month.end, true // additive = true (zu bestehenden Budgets hinzufügen)
        );
        console.log(`Budget-Template angewendet: ${transfersCreated} Transfers erstellt`);
    }
    catch (error) {
        console.error('Fehler beim Anwenden des Budget-Templates:', error);
    }
}
async function handleOverwriteTemplate() {
    if (!props.month)
        return;
    try {
        debugLog("[BudgetMonthHeaderCard]", `Überschreibe mit Budget-Template für ${props.month.start.toISOString().split('T')[0]} bis ${props.month.end.toISOString().split('T')[0]}`);
        const result = await BudgetService.overwriteWithBudgetTemplate(props.month.start, props.month.end);
        console.log(`Budget überschrieben: ${result.deleted} gelöscht, ${result.created} erstellt`);
    }
    catch (error) {
        console.error('Fehler beim Überschreiben mit Budget-Template:', error);
    }
}
function handleResetBudget() {
    if (!props.month) {
        console.warn('Kein Monat definiert für Budget-Reset');
        return;
    }
    showConfirmationModal.value = true;
}
function confirmResetBudget() {
    console.log('[BudgetMonthHeaderCard] confirmResetBudget aufgerufen');
    if (!props.month) {
        return;
    }
    // 1. UI-Aktion sofort ausführen: Das Modal wird direkt geschlossen.
    showConfirmationModal.value = false;
    // 2. Langlaufende Aufgabe im Hintergrund starten, ohne 'await'.
    BudgetService.resetMonthBudget(props.month.start, props.month.end)
        .then((deletedCount) => {
        // 3. Ergebnis verarbeiten, wenn es verfügbar ist (z.B. Logging).
        //    Dies geschieht, ohne die UI erneut zu beeinflussen.
        console.log(`Budget zurückgesetzt: ${deletedCount} Kategorieumbuchungen gelöscht`);
    })
        .catch((error) => {
        // 4. Fehler behandeln, falls die Hintergrundaufgabe fehlschlägt.
        console.error('Fehler beim Zurücksetzen des Budgets:', error);
        // Hier könnte man z.B. eine dezente Fehlermeldung (Toast) anzeigen.
    });
}
function cancelResetBudget() {
    showConfirmationModal.value = false;
}
onMounted(() => {
    document.addEventListener("click", handleBudgetMenuClickOutside);
});
onUnmounted(() => {
    document.removeEventListener("click", handleBudgetMenuClickOutside);
});
/* ------------------- Confirmation Modal -------------------- */
/* ----------------------------------------------------------- */
const showConfirmationModal = ref(false);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: ([
            'relative min-w-[12rem] border border-accent/50 rounded-lg shadow-md sticky top-0 z-10 m-2',
            __VLS_ctx.isCurrentMonth
                ? 'border border-none outline-accent/75 outline-double outline-2 outline-offset-2'
                : 'border border-base-300',
        ]) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: ([
            'p-2 text-center font-bold relative',
            __VLS_ctx.isCurrentMonth
                ? 'border-b border-accent opacity-70 bg-accent/20'
                : 'border-b border-base-300',
        ]) },
});
(props.label);
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.toggleBudgetMenu) },
    ref: "budgetMenuButtonRef",
    ...{ class: "btn btn-xs btn-ghost btn-circle absolute top-1 right-1 opacity-60 hover:opacity-100" },
    title: "Budget-Aktionen",
});
/** @type {typeof __VLS_ctx.budgetMenuButtonRef} */ ;
const __VLS_0 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    icon: "mdi:dots-vertical",
    ...{ class: "text-sm" },
}));
const __VLS_2 = __VLS_1({
    icon: "mdi:dots-vertical",
    ...{ class: "text-sm" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "p-2 text-sm space-y-1 flex flex-col items-center" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
/** @type {[typeof CurrencyDisplay, ]} */ ;
// @ts-ignore
const __VLS_4 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
    amount: (props.available ?? 0),
    asInteger: (true),
    showZero: (false),
}));
const __VLS_5 = __VLS_4({
    amount: (props.available ?? 0),
    asInteger: (true),
    showZero: (false),
}, ...__VLS_functionalComponentArgsRest(__VLS_4));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
/** @type {[typeof CurrencyDisplay, ]} */ ;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
    amount: (props.budgeted ?? 0),
    asInteger: (true),
    showZero: (false),
}));
const __VLS_8 = __VLS_7({
    amount: (props.budgeted ?? 0),
    asInteger: (true),
    showZero: (false),
}, ...__VLS_functionalComponentArgsRest(__VLS_7));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "border-t border-base-300" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "p-2 text-center" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "text-base font-semibold" },
});
/** @type {[typeof CurrencyDisplay, ]} */ ;
// @ts-ignore
const __VLS_10 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
    amount: (props.toBudget ?? 0),
    asInteger: (true),
    showZero: (false),
}));
const __VLS_11 = __VLS_10({
    amount: (props.toBudget ?? 0),
    asInteger: (true),
    showZero: (false),
}, ...__VLS_functionalComponentArgsRest(__VLS_10));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "pt-2 pb-1 pl-2 mr-[2.6%]" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "grid grid-cols-4 gap-1" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex justify-end" },
});
const __VLS_13 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_14 = __VLS_asFunctionalComponent(__VLS_13, new __VLS_13({
    icon: "mdi:envelope-outline",
    width: "21",
    height: "21",
    ...{ class: "text-base-content/60 mr-5" },
}));
const __VLS_15 = __VLS_14({
    icon: "mdi:envelope-outline",
    width: "21",
    height: "21",
    ...{ class: "text-base-content/60 mr-5" },
}, ...__VLS_functionalComponentArgsRest(__VLS_14));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex justify-end" },
});
const __VLS_17 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_18 = __VLS_asFunctionalComponent(__VLS_17, new __VLS_17({
    icon: "mdi:target-arrow",
    width: "21",
    height: "21",
    ...{ class: "text-base-content/60 mr-5" },
}));
const __VLS_19 = __VLS_18({
    icon: "mdi:target-arrow",
    width: "21",
    height: "21",
    ...{ class: "text-base-content/60 mr-5" },
}, ...__VLS_functionalComponentArgsRest(__VLS_18));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex justify-end" },
});
const __VLS_21 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_22 = __VLS_asFunctionalComponent(__VLS_21, new __VLS_21({
    icon: "mdi:bank-transfer",
    width: "22",
    height: "22",
    ...{ class: "text-base-content/60 mr-5" },
}));
const __VLS_23 = __VLS_22({
    icon: "mdi:bank-transfer",
    width: "22",
    height: "22",
    ...{ class: "text-base-content/60 mr-5" },
}, ...__VLS_functionalComponentArgsRest(__VLS_22));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex justify-end" },
});
const __VLS_25 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_26 = __VLS_asFunctionalComponent(__VLS_25, new __VLS_25({
    icon: "mdi:scale-balance",
    width: "20",
    height: "20",
    ...{ class: "text-base-content/60 mr-5" },
}));
const __VLS_27 = __VLS_26({
    icon: "mdi:scale-balance",
    width: "20",
    height: "20",
    ...{ class: "text-base-content/60 mr-5" },
}, ...__VLS_functionalComponentArgsRest(__VLS_26));
const __VLS_29 = {}.Teleport;
/** @type {[typeof __VLS_components.Teleport, typeof __VLS_components.Teleport, ]} */ ;
// @ts-ignore
const __VLS_30 = __VLS_asFunctionalComponent(__VLS_29, new __VLS_29({
    to: "body",
}));
const __VLS_31 = __VLS_30({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_30));
__VLS_32.slots.default;
if (__VLS_ctx.isBudgetMenuOpen) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({
        ref: "budgetMenuRef",
        ...{ style: (__VLS_ctx.budgetMenuStyle) },
        ...{ class: "menu p-2 shadow bg-base-100 border border-base-300 rounded-box w-64" },
    });
    /** @type {typeof __VLS_ctx.budgetMenuRef} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
        ...{ class: "menu-title" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isBudgetMenuOpen))
                    return;
                __VLS_ctx.handleBudgetAction('carry-surplus');
            } },
    });
    const __VLS_33 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_34 = __VLS_asFunctionalComponent(__VLS_33, new __VLS_33({
        icon: "mdi:arrow-right-circle",
        ...{ class: "text-lg" },
    }));
    const __VLS_35 = __VLS_34({
        icon: "mdi:arrow-right-circle",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_34));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isBudgetMenuOpen))
                    return;
                __VLS_ctx.handleBudgetAction('show-template');
            } },
    });
    const __VLS_37 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_38 = __VLS_asFunctionalComponent(__VLS_37, new __VLS_37({
        icon: "mdi:eye",
        ...{ class: "text-lg" },
    }));
    const __VLS_39 = __VLS_38({
        icon: "mdi:eye",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_38));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isBudgetMenuOpen))
                    return;
                __VLS_ctx.handleBudgetAction('apply-template');
            } },
    });
    const __VLS_41 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_42 = __VLS_asFunctionalComponent(__VLS_41, new __VLS_41({
        icon: "mdi:content-paste",
        ...{ class: "text-lg" },
    }));
    const __VLS_43 = __VLS_42({
        icon: "mdi:content-paste",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_42));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isBudgetMenuOpen))
                    return;
                __VLS_ctx.handleBudgetAction('overwrite-template');
            } },
    });
    const __VLS_45 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_46 = __VLS_asFunctionalComponent(__VLS_45, new __VLS_45({
        icon: "mdi:file-replace",
        ...{ class: "text-lg" },
    }));
    const __VLS_47 = __VLS_46({
        icon: "mdi:file-replace",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_46));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
        ...{ class: "divider" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isBudgetMenuOpen))
                    return;
                __VLS_ctx.handleBudgetAction('copy-last-month');
            } },
    });
    const __VLS_49 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_50 = __VLS_asFunctionalComponent(__VLS_49, new __VLS_49({
        icon: "mdi:content-copy",
        ...{ class: "text-lg" },
    }));
    const __VLS_51 = __VLS_50({
        icon: "mdi:content-copy",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_50));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isBudgetMenuOpen))
                    return;
                __VLS_ctx.handleBudgetAction('set-3month-average');
            } },
    });
    const __VLS_53 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_54 = __VLS_asFunctionalComponent(__VLS_53, new __VLS_53({
        icon: "mdi:chart-line",
        ...{ class: "text-lg" },
    }));
    const __VLS_55 = __VLS_54({
        icon: "mdi:chart-line",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_54));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
        ...{ class: "divider" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isBudgetMenuOpen))
                    return;
                __VLS_ctx.handleBudgetAction('reset-budget');
            } },
        ...{ class: "text-warning" },
    });
    const __VLS_57 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_58 = __VLS_asFunctionalComponent(__VLS_57, new __VLS_57({
        icon: "mdi:refresh",
        ...{ class: "text-lg" },
    }));
    const __VLS_59 = __VLS_58({
        icon: "mdi:refresh",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_58));
}
var __VLS_32;
if (__VLS_ctx.showConfirmationModal) {
    /** @type {[typeof ConfirmationModal, ]} */ ;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent(ConfirmationModal, new ConfirmationModal({
        ...{ 'onConfirm': {} },
        ...{ 'onCancel': {} },
        title: "Budget auf 0 setzen",
        message: "\u004d\u00f6\u0063\u0068\u0074\u0065\u006e\u0020\u0053\u0069\u0065\u0020\u0077\u0069\u0072\u006b\u006c\u0069\u0063\u0068\u0020\u0061\u006c\u006c\u0065\u0020\u004b\u0061\u0074\u0065\u0067\u006f\u0072\u0069\u0065\u0075\u006d\u0062\u0075\u0063\u0068\u0075\u006e\u0067\u0065\u006e\u0020\u0064\u0069\u0065\u0073\u0065\u0073\u0020\u004d\u006f\u006e\u0061\u0074\u0073\u0020\u006c\u00f6\u0073\u0063\u0068\u0065\u006e\u003f\u0020\u0044\u0069\u0065\u0073\u0065\u0020\u0041\u006b\u0074\u0069\u006f\u006e\u0020\u0062\u0065\u0074\u0072\u0069\u0066\u0066\u0074\u0020\u006e\u0075\u0072\u0020\u0041\u0075\u0073\u0067\u0061\u0062\u0065\u006e\u006b\u0061\u0074\u0065\u0067\u006f\u0072\u0069\u0065\u006e\u0020\u0075\u006e\u0064\u0020\u006b\u0061\u006e\u006e\u0020\u006e\u0069\u0063\u0068\u0074\u0020\u0072\u00fc\u0063\u006b\u0067\u00e4\u006e\u0067\u0069\u0067\u0020\u0067\u0065\u006d\u0061\u0063\u0068\u0074\u0020\u0077\u0065\u0072\u0064\u0065\u006e\u002e\u000d\u000a\u000d\u000a\u0041\u006c\u006c\u0065\u0020\u0043\u0041\u0054\u0045\u0047\u004f\u0052\u0059\u0054\u0052\u0041\u004e\u0053\u0046\u0045\u0052\u002d\u0042\u0075\u0063\u0068\u0075\u006e\u0067\u0065\u006e\u0020\u0064\u0065\u0073\u0020\u004d\u006f\u006e\u0061\u0074\u0073\u0020\u0066\u00fc\u0072\u0020\u0041\u0075\u0073\u0067\u0061\u0062\u0065\u006e\u006b\u0061\u0074\u0065\u0067\u006f\u0072\u0069\u0065\u006e\u0020\u0077\u0065\u0072\u0064\u0065\u006e\u0020\u0075\u006e\u0077\u0069\u0064\u0065\u0072\u0072\u0075\u0066\u006c\u0069\u0063\u0068\u0020\u0067\u0065\u006c\u00f6\u0073\u0063\u0068\u0074\u002e\u0020\u0042\u0075\u0063\u0068\u0075\u006e\u0067\u0065\u006e\u0020\u0076\u006f\u006e\u0020\u0045\u0069\u006e\u006e\u0061\u0068\u006d\u0065\u006b\u0061\u0074\u0065\u0067\u006f\u0072\u0069\u0065\u006e\u0020\u007a\u0075\u0020\u0027\u0056\u0065\u0072\u0066\u00fc\u0067\u0062\u0061\u0072\u0065\u0020\u004d\u0069\u0074\u0074\u0065\u006c\u0027\u0020\u0062\u006c\u0065\u0069\u0062\u0065\u006e\u0020\u0075\u006e\u0062\u0065\u0072\u00fc\u0068\u0072\u0074\u002e",
        confirmText: "Ja, Budget zurücksetzen",
        cancelText: "Abbrechen",
    }));
    const __VLS_62 = __VLS_61({
        ...{ 'onConfirm': {} },
        ...{ 'onCancel': {} },
        title: "Budget auf 0 setzen",
        message: "\u004d\u00f6\u0063\u0068\u0074\u0065\u006e\u0020\u0053\u0069\u0065\u0020\u0077\u0069\u0072\u006b\u006c\u0069\u0063\u0068\u0020\u0061\u006c\u006c\u0065\u0020\u004b\u0061\u0074\u0065\u0067\u006f\u0072\u0069\u0065\u0075\u006d\u0062\u0075\u0063\u0068\u0075\u006e\u0067\u0065\u006e\u0020\u0064\u0069\u0065\u0073\u0065\u0073\u0020\u004d\u006f\u006e\u0061\u0074\u0073\u0020\u006c\u00f6\u0073\u0063\u0068\u0065\u006e\u003f\u0020\u0044\u0069\u0065\u0073\u0065\u0020\u0041\u006b\u0074\u0069\u006f\u006e\u0020\u0062\u0065\u0074\u0072\u0069\u0066\u0066\u0074\u0020\u006e\u0075\u0072\u0020\u0041\u0075\u0073\u0067\u0061\u0062\u0065\u006e\u006b\u0061\u0074\u0065\u0067\u006f\u0072\u0069\u0065\u006e\u0020\u0075\u006e\u0064\u0020\u006b\u0061\u006e\u006e\u0020\u006e\u0069\u0063\u0068\u0074\u0020\u0072\u00fc\u0063\u006b\u0067\u00e4\u006e\u0067\u0069\u0067\u0020\u0067\u0065\u006d\u0061\u0063\u0068\u0074\u0020\u0077\u0065\u0072\u0064\u0065\u006e\u002e\u000d\u000a\u000d\u000a\u0041\u006c\u006c\u0065\u0020\u0043\u0041\u0054\u0045\u0047\u004f\u0052\u0059\u0054\u0052\u0041\u004e\u0053\u0046\u0045\u0052\u002d\u0042\u0075\u0063\u0068\u0075\u006e\u0067\u0065\u006e\u0020\u0064\u0065\u0073\u0020\u004d\u006f\u006e\u0061\u0074\u0073\u0020\u0066\u00fc\u0072\u0020\u0041\u0075\u0073\u0067\u0061\u0062\u0065\u006e\u006b\u0061\u0074\u0065\u0067\u006f\u0072\u0069\u0065\u006e\u0020\u0077\u0065\u0072\u0064\u0065\u006e\u0020\u0075\u006e\u0077\u0069\u0064\u0065\u0072\u0072\u0075\u0066\u006c\u0069\u0063\u0068\u0020\u0067\u0065\u006c\u00f6\u0073\u0063\u0068\u0074\u002e\u0020\u0042\u0075\u0063\u0068\u0075\u006e\u0067\u0065\u006e\u0020\u0076\u006f\u006e\u0020\u0045\u0069\u006e\u006e\u0061\u0068\u006d\u0065\u006b\u0061\u0074\u0065\u0067\u006f\u0072\u0069\u0065\u006e\u0020\u007a\u0075\u0020\u0027\u0056\u0065\u0072\u0066\u00fc\u0067\u0062\u0061\u0072\u0065\u0020\u004d\u0069\u0074\u0074\u0065\u006c\u0027\u0020\u0062\u006c\u0065\u0069\u0062\u0065\u006e\u0020\u0075\u006e\u0062\u0065\u0072\u00fc\u0068\u0072\u0074\u002e",
        confirmText: "Ja, Budget zurücksetzen",
        cancelText: "Abbrechen",
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    let __VLS_64;
    let __VLS_65;
    let __VLS_66;
    const __VLS_67 = {
        onConfirm: (__VLS_ctx.confirmResetBudget)
    };
    const __VLS_68 = {
        onCancel: (__VLS_ctx.cancelResetBudget)
    };
    var __VLS_63;
}
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-[12rem]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-accent/50']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['sticky']} */ ;
/** @type {__VLS_StyleScopedClasses['top-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['m-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['top-1']} */ ;
/** @type {__VLS_StyleScopedClasses['right-1']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:opacity-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['pl-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-[2.6%]']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-4']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-5']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-5']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-5']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-5']} */ ;
/** @type {__VLS_StyleScopedClasses['menu']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
/** @type {__VLS_StyleScopedClasses['w-64']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-title']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['text-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            CurrencyDisplay: CurrencyDisplay,
            ConfirmationModal: ConfirmationModal,
            Icon: Icon,
            isCurrentMonth: isCurrentMonth,
            isBudgetMenuOpen: isBudgetMenuOpen,
            budgetMenuButtonRef: budgetMenuButtonRef,
            budgetMenuRef: budgetMenuRef,
            budgetMenuStyle: budgetMenuStyle,
            toggleBudgetMenu: toggleBudgetMenu,
            handleBudgetAction: handleBudgetAction,
            confirmResetBudget: confirmResetBudget,
            cancelResetBudget: cancelResetBudget,
            showConfirmationModal: showConfirmationModal,
        };
    },
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
