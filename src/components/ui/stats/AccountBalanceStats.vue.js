import { ref, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { useAccountStore } from "../../../stores/accountStore";
import { BalanceService } from "../../../services/BalanceService";
import CurrencyDisplay from "../CurrencyDisplay.vue";
const props = withDefaults(defineProps(), {
    showHeader: true,
    showActions: true,
});
const router = useRouter();
const accountStore = useAccountStore();
const totalBalance = computed(() => BalanceService.getTotalBalance());
const accountGroupsWithBalances = computed(() => {
    return accountStore.accountGroups
        .filter((group) => {
        const groupAccounts = accountStore.accounts.filter((account) => account.accountGroupId === group.id &&
            account.isActive &&
            !account.isOfflineBudget);
        return groupAccounts.length > 0;
    })
        .map((group) => {
        const groupBalance = BalanceService.getAccountGroupBalance(group.id);
        const groupAccounts = accountStore.accounts
            .filter((account) => account.accountGroupId === group.id &&
            account.isActive &&
            !account.isOfflineBudget)
            .map((account) => ({
            ...account,
            balance: BalanceService.getTodayBalance("account", account.id),
        }));
        return {
            ...group,
            balance: groupBalance,
            accounts: groupAccounts,
        };
    })
        .sort((a, b) => a.sortOrder - b.sortOrder);
});
//
// Performance: Coalesced ViewModel (rAF + optional Debounce) zur Reduzierung von Re-Renders
//
const displayedTotalBalance = ref(totalBalance.value);
const displayedGroups = ref(accountGroupsWithBalances.value);
const DEBOUNCE_MS = 120;
let rafId = null;
let debounceId = null;
const flushViewModel = () => {
    displayedTotalBalance.value = totalBalance.value;
    displayedGroups.value = accountGroupsWithBalances.value;
};
const scheduleUpdate = (debounce = true) => {
    const run = () => {
        rafId = null;
        flushViewModel();
    };
    if (debounce) {
        if (debounceId)
            window.clearTimeout(debounceId);
        debounceId = window.setTimeout(() => {
            debounceId = null;
            if (rafId)
                return;
            rafId = requestAnimationFrame(run);
        }, DEBOUNCE_MS);
        return;
    }
    if (rafId)
        return;
    rafId = requestAnimationFrame(run);
};
// Rechenintensive Ableitungen (Saldo + Gruppierung) nur gebündelt updaten
watch([totalBalance, accountGroupsWithBalances], () => scheduleUpdate(true));
const GROUP_ROW_ESTIMATE = 52; // px, geschätzte Höhe pro Gruppe
const GROUP_GAP = 8; // px, vertikaler Abstand zwischen Gruppen
const MAX_GROUP_ROWS = 6; // max. sichtbare Gruppen-Zeilen bevor Scroll aktiviert wird
const groupsListStyle = computed(() => {
    const maxHeight = MAX_GROUP_ROWS * GROUP_ROW_ESTIMATE + (MAX_GROUP_ROWS - 1) * GROUP_GAP;
    return {
        maxHeight: `${maxHeight}px`,
        overflowY: "auto",
        overflowX: "hidden",
    };
});
function navigateToAccounts() {
    router.push("/accounts");
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    showHeader: true,
    showActions: true,
});
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['ag-list']} */ ;
/** @type {__VLS_StyleScopedClasses['ag-list']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition-colors duration-150" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card-body h-[160px] p-4 flex flex-col overflow-hidden transform-gpu" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex justify-between items-center mb-4" },
});
if (__VLS_ctx.showHeader) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "card-title text-lg" },
    });
}
if (__VLS_ctx.showActions) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.navigateToAccounts) },
        ...{ class: "btn btn-sm btn-ghost" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "iconify ml-1" },
        'data-icon': "mdi:chevron-right",
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "mb-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "text-2xl font-bold" },
});
/** @type {[typeof CurrencyDisplay, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
    amount: (__VLS_ctx.displayedTotalBalance),
    asInteger: (true),
}));
const __VLS_1 = __VLS_0({
    amount: (__VLS_ctx.displayedTotalBalance),
    asInteger: (true),
}, ...__VLS_functionalComponentArgsRest(__VLS_0));
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "text-sm opacity-60" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "space-y-2 ag-list flex-1 min-h-0 overflow-auto" },
});
for (const [group] of __VLS_getVForSourceType((__VLS_ctx.displayedGroups))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (group.id),
        tabindex: "0",
        ...{ class: "collapse collapse-arrow bg-base-200 border-base-300 border" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "collapse-title text-sm font-medium py-2 px-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex justify-between items-center" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (group.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "font-semibold" },
    });
    /** @type {[typeof CurrencyDisplay, ]} */ ;
    // @ts-ignore
    const __VLS_3 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
        amount: (group.balance),
        asInteger: (true),
    }));
    const __VLS_4 = __VLS_3({
        amount: (group.balance),
        asInteger: (true),
    }, ...__VLS_functionalComponentArgsRest(__VLS_3));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "collapse-content px-3 pb-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "space-y-1" },
    });
    for (const [account] of __VLS_getVForSourceType((group.accounts))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (account.id),
            ...{ class: "flex justify-between items-center py-1 px-2 rounded bg-base-100" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-xs" },
        });
        (account.name);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-xs font-medium" },
        });
        /** @type {[typeof CurrencyDisplay, ]} */ ;
        // @ts-ignore
        const __VLS_6 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
            amount: (account.balance),
            asInteger: (true),
        }));
        const __VLS_7 = __VLS_6({
            amount: (account.balance),
            asInteger: (true),
        }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    }
}
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['duration-150']} */ ;
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['h-[160px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['transform-gpu']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['iconify']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
/** @type {__VLS_StyleScopedClasses['ag-list']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['collapse']} */ ;
/** @type {__VLS_StyleScopedClasses['collapse-arrow']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['collapse-title']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['collapse-content']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            CurrencyDisplay: CurrencyDisplay,
            displayedTotalBalance: displayedTotalBalance,
            displayedGroups: displayedGroups,
            navigateToAccounts: navigateToAccounts,
        };
    },
    __typeProps: {},
    props: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeProps: {},
    props: {},
});
; /* PartiallyEnd: #4569/main.vue */
