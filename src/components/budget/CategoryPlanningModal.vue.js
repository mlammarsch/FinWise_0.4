import { ref, computed, watch, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { usePlanningStore } from '../../stores/planningStore';
import { useCategoryStore } from '../../stores/categoryStore';
import { useAccountStore } from '../../stores/accountStore';
import { useRecipientStore } from '../../stores/recipientStore';
import { PlanningService } from '../../services/PlanningService';
import CurrencyDisplay from '../ui/CurrencyDisplay.vue';
import { debugLog } from '../../utils/logger';
import { toDateOnlyString } from '../../utils/formatters';
const props = defineProps();
const emit = defineEmits();
// Stores
const planningStore = usePlanningStore();
const categoryStore = useCategoryStore();
const accountStore = useAccountStore();
const recipientStore = useRecipientStore();
// Lokaler State
const isLoading = ref(false);
// Computed Properties
const category = computed(() => categoryStore.categories.find(c => c.id === props.categoryId));
const categoryPlannings = computed(() => {
    if (!props.isOpen || !props.categoryId)
        return [];
    const startDate = toDateOnlyString(props.month.start.toISOString());
    const endDate = toDateOnlyString(props.month.end.toISOString());
    return planningStore.planningTransactions
        .filter(p => {
        // Nur aktive Planungen
        if (!p.isActive)
            return false;
        // Kategorie muss übereinstimmen
        if (p.categoryId !== props.categoryId)
            return false;
        // Berechne alle Ausführungstermine für diese Planung im Monat
        const occurrences = PlanningService.calculateNextOccurrences(p, startDate, endDate);
        return occurrences.length > 0;
    })
        .map(p => {
        // Erweitere jede Planung um die Ausführungstermine im Monat
        const occurrences = PlanningService.calculateNextOccurrences(p, startDate, endDate);
        return {
            ...p,
            nextOccurrences: occurrences
        };
    })
        .sort((a, b) => {
        // Sortiere nach dem nächsten Ausführungstermin
        const aNext = a.nextOccurrences[0] || a.startDate;
        const bNext = b.nextOccurrences[0] || b.startDate;
        return new Date(aNext).getTime() - new Date(bNext).getTime();
    });
});
const totalAmount = computed(() => categoryPlannings.value.reduce((sum, p) => {
    // Multipliziere mit der Anzahl der Ausführungen im Monat
    return sum + (p.amount * p.nextOccurrences.length);
}, 0));
const planningCount = computed(() => {
    // Zähle die Gesamtanzahl der geplanten Ausführungen
    return categoryPlannings.value.reduce((sum, p) => sum + p.nextOccurrences.length, 0);
});
// Helper Functions
function getAccountName(accountId) {
    const account = accountStore.accounts.find(a => a.id === accountId);
    return account?.name || 'Unbekanntes Konto';
}
function getRecipientName(recipientId) {
    if (!recipientId)
        return '';
    const recipient = recipientStore.recipients.find(r => r.id === recipientId);
    return recipient?.name || '';
}
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}
function getPlanningTypeIcon(planning) {
    if (planning.amount > 0) {
        return 'mdi:calendar-plus';
    }
    else {
        return 'mdi:calendar-minus';
    }
}
function getPlanningTypeColor(planning) {
    if (planning.amount > 0) {
        return 'text-success';
    }
    else {
        return 'text-error';
    }
}
function getRecurrenceText(planning) {
    switch (planning.recurrencePattern) {
        case 'ONCE': return 'Einmalig';
        case 'DAILY': return 'Täglich';
        case 'WEEKLY': return 'Wöchentlich';
        case 'BIWEEKLY': return 'Alle 2 Wochen';
        case 'MONTHLY': return 'Monatlich';
        case 'QUARTERLY': return 'Vierteljährlich';
        case 'YEARLY': return 'Jährlich';
        default: return 'Unbekannt';
    }
}
// Event Handlers
function handleClose() {
    emit('close');
}
function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
        handleClose();
    }
}
// Watchers
watch(() => props.isOpen, (newValue) => {
    if (newValue) {
        debugLog('CategoryPlanningModal', `Opening modal for category ${props.categoryId} in month ${props.month.label}`);
    }
});
onMounted(() => {
    // Planungen laden falls noch nicht geladen
    if (planningStore.planningTransactions.length === 0) {
        isLoading.value = true;
        planningStore.loadPlanningTransactions().finally(() => {
            isLoading.value = false;
        });
    }
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
// CSS variable injection 
// CSS variable injection end 
if (__VLS_ctx.isOpen) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (__VLS_ctx.handleBackdropClick) },
        ...{ class: "fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-base-content/20" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "bg-base-100 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center justify-between p-6 border-b border-base-300" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center space-x-3" },
    });
    if (__VLS_ctx.category?.icon) {
        const __VLS_0 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
            icon: (__VLS_ctx.category.icon),
            ...{ class: "w-6 h-6 text-primary" },
        }));
        const __VLS_2 = __VLS_1({
            icon: (__VLS_ctx.category.icon),
            ...{ class: "w-6 h-6 text-primary" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
        ...{ class: "text-xl font-semibold text-base-content" },
    });
    (__VLS_ctx.category?.name || 'Kategorie');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-sm text-base-content/60" },
    });
    (__VLS_ctx.month.label);
    (__VLS_ctx.planningCount);
    (__VLS_ctx.planningCount === 1 ? 'geplante Ausführung' : 'geplante Ausführungen');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center space-x-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-right" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-sm text-base-content/60" },
    });
    /** @type {[typeof CurrencyDisplay, ]} */ ;
    // @ts-ignore
    const __VLS_4 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
        amount: (__VLS_ctx.totalAmount),
        ...{ class: (__VLS_ctx.totalAmount >= 0 ? 'text-success' : 'text-error') },
        ...{ class: "text-lg font-semibold" },
    }));
    const __VLS_5 = __VLS_4({
        amount: (__VLS_ctx.totalAmount),
        ...{ class: (__VLS_ctx.totalAmount >= 0 ? 'text-success' : 'text-error') },
        ...{ class: "text-lg font-semibold" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_4));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.handleClose) },
        ...{ class: "btn btn-ghost btn-sm btn-circle" },
        'aria-label': "Modal schließen",
    });
    const __VLS_7 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({
        icon: "mdi:close",
        ...{ class: "w-5 h-5" },
    }));
    const __VLS_9 = __VLS_8({
        icon: "mdi:close",
        ...{ class: "w-5 h-5" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex-1 overflow-hidden" },
    });
    if (__VLS_ctx.isLoading) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex items-center justify-center h-64" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "loading loading-spinner loading-lg text-primary" },
        });
    }
    else if (__VLS_ctx.categoryPlannings.length === 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex flex-col items-center justify-center h-64 text-center" },
        });
        const __VLS_11 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_12 = __VLS_asFunctionalComponent(__VLS_11, new __VLS_11({
            icon: "mdi:calendar-outline",
            ...{ class: "w-16 h-16 text-base-content/30 mb-4" },
        }));
        const __VLS_13 = __VLS_12({
            icon: "mdi:calendar-outline",
            ...{ class: "w-16 h-16 text-base-content/30 mb-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_12));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
            ...{ class: "text-lg font-medium text-base-content mb-2" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "text-base-content/60" },
        });
        (__VLS_ctx.month.label);
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "overflow-y-auto max-h-[60vh]" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "divide-y divide-base-200" },
        });
        for (const [planning] of __VLS_getVForSourceType((__VLS_ctx.categoryPlannings))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (planning.id),
                ...{ class: "p-4 hover:bg-base-50 transition-colors duration-150" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "flex items-center justify-between mb-2" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "flex items-center space-x-3 flex-1" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "flex-shrink-0" },
            });
            const __VLS_15 = {}.Icon;
            /** @type {[typeof __VLS_components.Icon, ]} */ ;
            // @ts-ignore
            const __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15({
                icon: (__VLS_ctx.getPlanningTypeIcon(planning)),
                ...{ class: (__VLS_ctx.getPlanningTypeColor(planning)) },
                ...{ class: "w-5 h-5" },
            }));
            const __VLS_17 = __VLS_16({
                icon: (__VLS_ctx.getPlanningTypeIcon(planning)),
                ...{ class: (__VLS_ctx.getPlanningTypeColor(planning)) },
                ...{ class: "w-5 h-5" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_16));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "flex-1 min-w-0" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "flex items-center space-x-2" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                ...{ class: "text-sm font-medium text-base-content truncate" },
            });
            (planning.name);
            if (__VLS_ctx.getRecipientName(planning.recipientId)) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ class: "text-xs text-base-content/60 bg-base-200 px-2 py-1 rounded" },
                });
                (__VLS_ctx.getRecipientName(planning.recipientId));
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "flex items-center space-x-4 mt-1" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "text-xs text-base-content/60" },
            });
            (__VLS_ctx.getRecurrenceText(planning));
            if (planning.accountId) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ class: "text-xs text-base-content/60" },
                });
                (__VLS_ctx.getAccountName(planning.accountId));
            }
            if (planning.note) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ class: "text-xs text-base-content/60" },
                });
                (planning.note);
            }
            if (planning.nextOccurrences.length > 0) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ class: "text-xs text-base-content/60" },
                });
                for (const [date, index] of __VLS_getVForSourceType((planning.nextOccurrences))) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                        key: (date),
                        ...{ class: "text-xs bg-primary/10 text-primary px-1 py-0.5 rounded ml-1" },
                    });
                    (__VLS_ctx.formatDate(date));
                }
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "flex-shrink-0 text-right" },
            });
            /** @type {[typeof CurrencyDisplay, ]} */ ;
            // @ts-ignore
            const __VLS_19 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                amount: (planning.amount),
                ...{ class: (planning.amount >= 0 ? 'text-success' : 'text-error') },
                ...{ class: "text-sm font-semibold" },
            }));
            const __VLS_20 = __VLS_19({
                amount: (planning.amount),
                ...{ class: (planning.amount >= 0 ? 'text-success' : 'text-error') },
                ...{ class: "text-sm font-semibold" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_19));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                ...{ class: "text-xs text-base-content/60" },
            });
            (planning.nextOccurrences.length);
        }
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center justify-end p-6 border-t border-base-300 space-x-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.handleClose) },
        ...{ class: "btn btn-ghost" },
    });
}
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-50']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['backdrop-blur-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-content/20']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-4xl']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-[90vh]']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-3']} */ ;
/** @type {__VLS_StyleScopedClasses['w-6']} */ ;
/** @type {__VLS_StyleScopedClasses['h-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['h-64']} */ ;
/** @type {__VLS_StyleScopedClasses['loading']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['h-64']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-16']} */ ;
/** @type {__VLS_StyleScopedClasses['h-16']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/30']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-[60vh]']} */ ;
/** @type {__VLS_StyleScopedClasses['divide-y']} */ ;
/** @type {__VLS_StyleScopedClasses['divide-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-50']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['duration-150']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-primary/10']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-3']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Icon: Icon,
            CurrencyDisplay: CurrencyDisplay,
            isLoading: isLoading,
            category: category,
            categoryPlannings: categoryPlannings,
            totalAmount: totalAmount,
            planningCount: planningCount,
            getAccountName: getAccountName,
            getRecipientName: getRecipientName,
            formatDate: formatDate,
            getPlanningTypeIcon: getPlanningTypeIcon,
            getPlanningTypeColor: getPlanningTypeColor,
            getRecurrenceText: getRecurrenceText,
            handleClose: handleClose,
            handleBackdropClick: handleBackdropClick,
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
