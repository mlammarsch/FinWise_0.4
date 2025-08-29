import { ref, computed, watch, nextTick } from "vue";
import { useReconciliationStore } from "@/stores/reconciliationStore";
import { useTransactionStore } from "@/stores/transactionStore";
import { ReconciliationService } from "@/services/ReconciliationService";
import { AccountService } from "@/services/AccountService"; // neu
import DatePicker from "@/components/ui/DatePicker.vue";
import CurrencyInput from "@/components/ui/CurrencyInput.vue";
import CurrencyDisplay from "@/components/ui/CurrencyDisplay.vue";
import { Icon } from "@iconify/vue";
import { debugLog } from "@/utils/logger";
const props = defineProps();
const emit = defineEmits(["close", "reconciled"]);
// Debug-Log beim Erstellen der Komponente
debugLog("AccountReconcileModal", "Component created", {
    account: props.account,
    isOpen: props.isOpen,
});
const reconciliationStore = useReconciliationStore();
const transactionStore = useTransactionStore();
const reconciliationService = ReconciliationService;
const isProcessing = ref(false);
const dateInputRef = ref(null);
// --- Two‑way bindings (Store <‑> Inputs) -------------------------------
const reconcileDate = computed({
    get: () => reconciliationStore.reconcileDate,
    set: (v) => (reconciliationStore.reconcileDate = v),
});
const actualBalance = computed({
    get: () => reconciliationStore.actualBalance,
    set: (v) => (reconciliationStore.actualBalance = v),
});
const note = computed({
    get: () => reconciliationStore.note,
    set: (v) => (reconciliationStore.note = v),
});
// --- Saldo‑ & Differenz‑Berechnung -------------------------------------
const currentBalance = computed(() => props.account
    ? AccountService.getCurrentBalance(props.account.id, new Date(reconcileDate.value))
    : 0);
const difference = computed(() => actualBalance.value - currentBalance.value);
// Pending transactions
const hasPendingTransactions = computed(() => {
    if (!props.account)
        return false;
    const pending = transactionStore
        .getTransactionsByAccount(props.account.id)
        .filter((tx) => !tx.reconciled); // Typ für tx hinzugefügt
    return pending.length > 0;
});
// --- Watchers ----------------------------------------------------------
watch(() => props.isOpen, (open) => {
    debugLog("AccountReconcileModal", "Watcher triggered", {
        open,
        account: props.account,
    });
    if (open) {
        isProcessing.value = false;
        // Reconciliation im Store starten
        debugLog("AccountReconcileModal", "Starting reconciliation for account", props.account);
        reconciliationService.startReconciliation(props.account);
        nextTick(() => {
            const comp = dateInputRef.value;
            if (comp?.focus)
                comp.focus();
            else if (comp?.focusInput)
                comp.focusInput();
        });
    }
});
// --- Actions -----------------------------------------------------------
async function performReconciliation() {
    debugLog("AccountReconcileModal", "performReconciliation called", {
        isProcessing: isProcessing.value,
        difference: difference.value,
        propsAccount: props.account, // Logge das Prop-Konto
    });
    if (isProcessing.value)
        return;
    // Die Prüfung auf difference === 0 wird im Button :disabled behandelt,
    // aber hier zur Sicherheit beibehalten, falls direkt aufgerufen.
    if (difference.value === 0 && !note.value) {
        // Erlaube Buchung bei Diff 0 wenn Notiz da
        debugLog("AccountReconcileModal", "Difference is 0 and no note, nothing to do.");
        // Optional: closeModal() hier aufrufen, wenn keine Aktion gewünscht ist
        return;
    }
    isProcessing.value = true;
    try {
        // Übergebe props.account direkt an den Service
        const ok = await reconciliationService.reconcileAccount(props.account);
        if (ok) {
            emit("reconciled");
            reconciliationStore.reset(); // Store zurücksetzen nach erfolgreichem Abgleich
            closeModal(); // Schließt das Modal und ruft ggf. cancelReconciliation auf
        }
    }
    finally {
        isProcessing.value = false;
    }
}
function closeModal() {
    // Abbrechen nur, wenn keine Verarbeitung läuft
    if (!isProcessing.value) {
        reconciliationService.cancelReconciliation(); // ruft intern store.reset() auf
    }
    emit("close");
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
if (__VLS_ctx.isOpen) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onKeydown: (__VLS_ctx.closeModal) },
        ...{ class: "modal modal-open" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-box max-w-lg relative" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.closeModal) },
        type: "button",
        ...{ class: "btn btn-sm btn-circle btn-ghost absolute right-2 top-2" },
    });
    const __VLS_0 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        icon: "mdi:close",
        ...{ class: "text-lg" },
    }));
    const __VLS_2 = __VLS_1({
        icon: "mdi:close",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "font-bold text-lg mb-4" },
    });
    (__VLS_ctx.account.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
        ...{ onSubmit: (__VLS_ctx.performReconciliation) },
        ...{ class: "space-y-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
        ...{ class: "text-sm font-semibold mb-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-error" },
    });
    /** @type {[typeof DatePicker, ]} */ ;
    // @ts-ignore
    const __VLS_4 = __VLS_asFunctionalComponent(DatePicker, new DatePicker({
        ref: "dateInputRef",
        modelValue: (__VLS_ctx.reconcileDate),
        ...{ class: "input input-bordered w-full" },
    }));
    const __VLS_5 = __VLS_4({
        ref: "dateInputRef",
        modelValue: (__VLS_ctx.reconcileDate),
        ...{ class: "input input-bordered w-full" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_4));
    /** @type {typeof __VLS_ctx.dateInputRef} */ ;
    var __VLS_7 = {};
    var __VLS_6;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
        ...{ class: "text-sm font-semibold mb-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-error" },
    });
    /** @type {[typeof CurrencyInput, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(CurrencyInput, new CurrencyInput({
        modelValue: (__VLS_ctx.actualBalance),
        required: true,
    }));
    const __VLS_10 = __VLS_9({
        modelValue: (__VLS_ctx.actualBalance),
        required: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "bg-base-200 p-3 rounded-md text-sm space-y-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex justify-between" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "font-medium" },
    });
    /** @type {[typeof CurrencyDisplay, ]} */ ;
    // @ts-ignore
    const __VLS_12 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
        amount: (__VLS_ctx.currentBalance),
        showZero: (true),
    }));
    const __VLS_13 = __VLS_12({
        amount: (__VLS_ctx.currentBalance),
        showZero: (true),
    }, ...__VLS_functionalComponentArgsRest(__VLS_12));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex justify-between border-t border-base-300 pt-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "font-bold" },
        ...{ class: ({
                'text-success': __VLS_ctx.difference === 0,
                'text-error': __VLS_ctx.difference !== 0,
            }) },
    });
    /** @type {[typeof CurrencyDisplay, ]} */ ;
    // @ts-ignore
    const __VLS_15 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
        amount: (__VLS_ctx.difference),
        showZero: (true),
        showSign: (true),
    }));
    const __VLS_16 = __VLS_15({
        amount: (__VLS_ctx.difference),
        showZero: (true),
        showSign: (true),
    }, ...__VLS_functionalComponentArgsRest(__VLS_15));
    if (__VLS_ctx.difference !== 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
            ...{ class: "text-sm font-semibold mb-1" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            type: "text",
            value: (__VLS_ctx.note),
            ...{ class: "input input-bordered w-full" },
            placeholder: "z.B. Korrektur Rundungsdifferenz",
        });
    }
    if (__VLS_ctx.hasPendingTransactions) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "alert alert-warning alert-soft text-xs p-2 mt-4" },
        });
        const __VLS_18 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_19 = __VLS_asFunctionalComponent(__VLS_18, new __VLS_18({
            icon: "mdi:alert-outline",
            ...{ class: "text-lg" },
        }));
        const __VLS_20 = __VLS_19({
            icon: "mdi:alert-outline",
            ...{ class: "text-lg" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_19));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-action mt-6" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.closeModal) },
        type: "button",
        ...{ class: "btn btn-ghost" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        type: "submit",
        ...{ class: "btn btn-primary" },
        disabled: (__VLS_ctx.difference === 0 || __VLS_ctx.isProcessing),
    });
    if (__VLS_ctx.isProcessing) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span)({
            ...{ class: "loading loading-spinner loading-xs" },
        });
    }
    (__VLS_ctx.difference === 0 ? "Abgeglichen" : "Ausgleich buchen");
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div)({
        ...{ onClick: (__VLS_ctx.closeModal) },
        ...{ class: "modal-backdrop bg-black/30" },
    });
}
/** @type {__VLS_StyleScopedClasses['modal']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-open']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['right-2']} */ ;
/** @type {__VLS_StyleScopedClasses['top-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-success']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['alert']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-action']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['loading']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-backdrop']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/30']} */ ;
// @ts-ignore
var __VLS_8 = __VLS_7;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            DatePicker: DatePicker,
            CurrencyInput: CurrencyInput,
            CurrencyDisplay: CurrencyDisplay,
            Icon: Icon,
            isProcessing: isProcessing,
            dateInputRef: dateInputRef,
            reconcileDate: reconcileDate,
            actualBalance: actualBalance,
            note: note,
            currentBalance: currentBalance,
            difference: difference,
            hasPendingTransactions: hasPendingTransactions,
            performReconciliation: performReconciliation,
            closeModal: closeModal,
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
