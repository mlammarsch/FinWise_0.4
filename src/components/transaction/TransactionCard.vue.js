import { defineProps, computed } from "vue";
import { TransactionType } from "../../types";
import { useCategoryStore } from "../../stores/categoryStore";
import { useTagStore } from "../../stores/tagStore";
import { useRecipientStore } from "../../stores/recipientStore";
import { useTransactionStore } from "../../stores/transactionStore";
import CurrencyDisplay from "../ui/CurrencyDisplay.vue";
import { formatDate } from "../../utils/formatters";
import BadgeSoft from "../ui/BadgeSoft.vue";
import { Icon } from "@iconify/vue";
import { useAccountStore } from "../../stores/accountStore";
import { TransactionService } from "@/services/TransactionService"; // Neuer Import
const props = defineProps();
const accountStore = useAccountStore();
const categoryStore = useCategoryStore();
const tagStore = useTagStore();
const recipientStore = useRecipientStore();
const transactionStore = useTransactionStore();
const categoryName = computed(() => props.transaction.categoryId
    ? categoryStore.getCategoryById(props.transaction.categoryId)?.name ||
        "Keine Kategorie"
    : "Keine Kategorie");
const recipientName = computed(() => {
    if (props.transaction.type === TransactionType.ACCOUNTTRANSFER) {
        const toAccountId = props.transaction.transferToAccountId;
        const account = toAccountId
            ? accountStore.getAccountById(toAccountId)
            : null;
        return account?.name || "-";
    }
    return props.transaction.recipientId
        ? recipientStore.getRecipientById(props.transaction.recipientId)?.name ||
            "-"
        : "-";
});
const getTagName = (tagId) => tagStore.getTagById(tagId)?.name || "";
const transactionIcon = computed(() => {
    if (props.transaction.type === TransactionType.ACCOUNTTRANSFER)
        return "mdi:bank-transfer";
    if (props.transaction.type === TransactionType.EXPENSE)
        return "mdi:cash-minus";
    if (props.transaction.type === TransactionType.INCOME)
        return "mdi:cash-plus";
    return "mdi:cash";
});
const toggleReconciled = () => {
    TransactionService.updateTransaction(props.transaction.id, {
        reconciled: !props.transaction.reconciled,
    });
};
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
if (__VLS_ctx.transaction.type !== __VLS_ctx.TransactionType.CATEGORYTRANSFER) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-stretch px-2 p-2 space-x-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-col justify-center p-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "checkbox",
        ...{ class: "checkbox checkbox-sm" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-col flex-grow space-y-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex justify-between items-start" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center" },
    });
    const __VLS_0 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        icon: "mdi:account",
        ...{ class: "pr-1 text-lg opacity-50" },
    }));
    const __VLS_2 = __VLS_1({
        icon: "mdi:account",
        ...{ class: "pr-1 text-lg opacity-50" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-base" },
    });
    (__VLS_ctx.recipientName);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center space-x-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        ...{ onChange: (__VLS_ctx.toggleReconciled) },
        type: "checkbox",
        ...{ class: "checkbox checkbox-xs rounded-full" },
        checked: (__VLS_ctx.transaction.reconciled),
    });
    const __VLS_4 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
        icon: (__VLS_ctx.transactionIcon),
        ...{ class: "text-xl mx-1 text-neutral/70 mx-2" },
    }));
    const __VLS_6 = __VLS_5({
        icon: (__VLS_ctx.transactionIcon),
        ...{ class: "text-xl mx-1 text-neutral/70 mx-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_5));
    /** @type {[typeof CurrencyDisplay, ]} */ ;
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
        amount: (__VLS_ctx.transaction.amount),
        ...{ class: "text-right text-base whitespace-nowrap" },
        showZero: (true),
        ...{ class: ({
                'text-warning': __VLS_ctx.transaction.type === __VLS_ctx.TransactionType.ACCOUNTTRANSFER,
            }) },
    }));
    const __VLS_9 = __VLS_8({
        amount: (__VLS_ctx.transaction.amount),
        ...{ class: "text-right text-base whitespace-nowrap" },
        showZero: (true),
        ...{ class: ({
                'text-warning': __VLS_ctx.transaction.type === __VLS_ctx.TransactionType.ACCOUNTTRANSFER,
            }) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    if (__VLS_ctx.transaction.note) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "whitespace-pre-wrap flex items-start w-5/6 rounded-md p-1" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex items-center" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        const __VLS_11 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_12 = __VLS_asFunctionalComponent(__VLS_11, new __VLS_11({
            icon: "mdi:speaker-notes",
            ...{ class: "text-sm ml-0 opacity-50" },
        }));
        const __VLS_13 = __VLS_12({
            icon: "mdi:speaker-notes",
            ...{ class: "text-sm ml-0 opacity-50" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_12));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-sm text-gray-500 ml-2" },
        });
        (__VLS_ctx.transaction.note);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-xs neutral-content flex items-center flex-wrap" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center" },
    });
    const __VLS_15 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15({
        icon: "mdi:calendar-import",
        ...{ class: "pr-1 text-lg opacity-50" },
    }));
    const __VLS_17 = __VLS_16({
        icon: "mdi:calendar-import",
        ...{ class: "pr-1 text-lg opacity-50" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_16));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-sm" },
    });
    (__VLS_ctx.formatDate(__VLS_ctx.transaction.date));
    const __VLS_19 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_20 = __VLS_asFunctionalComponent(__VLS_19, new __VLS_19({
        icon: "mdi:square-medium",
        ...{ class: "text-base opacity-40 mx-1" },
    }));
    const __VLS_21 = __VLS_20({
        icon: "mdi:square-medium",
        ...{ class: "text-base opacity-40 mx-1" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_20));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center" },
    });
    const __VLS_23 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_24 = __VLS_asFunctionalComponent(__VLS_23, new __VLS_23({
        icon: "mdi:calendar-check",
        ...{ class: "pr-1 text-lg opacity-50" },
    }));
    const __VLS_25 = __VLS_24({
        icon: "mdi:calendar-check",
        ...{ class: "pr-1 text-lg opacity-50" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_24));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-sm" },
    });
    (__VLS_ctx.formatDate(__VLS_ctx.transaction.valueDate));
    const __VLS_27 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_28 = __VLS_asFunctionalComponent(__VLS_27, new __VLS_27({
        icon: "mdi:square-medium",
        ...{ class: "text-base opacity-40 mx-1" },
    }));
    const __VLS_29 = __VLS_28({
        icon: "mdi:square-medium",
        ...{ class: "text-base opacity-40 mx-1" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_28));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center" },
    });
    const __VLS_31 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_32 = __VLS_asFunctionalComponent(__VLS_31, new __VLS_31({
        icon: "mdi:category",
        ...{ class: "pr-1 text-lg opacity-50" },
    }));
    const __VLS_33 = __VLS_32({
        icon: "mdi:category",
        ...{ class: "pr-1 text-lg opacity-50" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_32));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-sm" },
    });
    (__VLS_ctx.categoryName);
    if (__VLS_ctx.transaction.tagIds.length > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex flex-wrap gap-1 mt-1" },
        });
        for (const [tagId] of __VLS_getVForSourceType((__VLS_ctx.transaction.tagIds))) {
            /** @type {[typeof BadgeSoft, ]} */ ;
            // @ts-ignore
            const __VLS_35 = __VLS_asFunctionalComponent(BadgeSoft, new BadgeSoft({
                key: (tagId),
                label: (__VLS_ctx.getTagName(tagId)),
                colorIntensity: (__VLS_ctx.tagStore.getTagById(tagId)?.color || 'secondary'),
                size: "sm",
            }));
            const __VLS_36 = __VLS_35({
                key: (tagId),
                label: (__VLS_ctx.getTagName(tagId)),
                colorIntensity: (__VLS_ctx.tagStore.getTagById(tagId)?.color || 'secondary'),
                size: "sm",
            }, ...__VLS_functionalComponentArgsRest(__VLS_35));
        }
    }
}
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['transition']} */ ;
/** @type {__VLS_StyleScopedClasses['duration-150']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-stretch']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-grow']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['pr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-neutral/70']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
/** @type {__VLS_StyleScopedClasses['text-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-pre-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5/6']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-0']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['neutral-content']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['pr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-40']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['pr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-40']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['pr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            TransactionType: TransactionType,
            CurrencyDisplay: CurrencyDisplay,
            formatDate: formatDate,
            BadgeSoft: BadgeSoft,
            Icon: Icon,
            tagStore: tagStore,
            categoryName: categoryName,
            recipientName: recipientName,
            getTagName: getTagName,
            transactionIcon: transactionIcon,
            toggleReconciled: toggleReconciled,
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
