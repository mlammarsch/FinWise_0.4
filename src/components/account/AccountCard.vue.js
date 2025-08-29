import { defineProps, computed, ref, watch, onMounted, onUnmounted } from "vue";
import CurrencyDisplay from "../ui/CurrencyDisplay.vue";
import { useRouter } from "vue-router";
import AccountReconcileModal from "./AccountReconcileModal.vue";
import AccountForm from "./AccountForm.vue";
import { useAccountStore } from "../../stores/accountStore";
import { AccountService } from "../../services/AccountService"; // neu
import TransactionImportModal from "../transaction/TransactionImportModal.vue"; // neu für CSV-Import
import { Icon } from "@iconify/vue";
import { useTenantStore, } from "../../stores/tenantStore"; // Import useTenantStore und FinwiseTenantSpecificDB
import { ImageService } from "../../services/ImageService"; // Import ImageService
const emit = defineEmits(["select"]);
const props = defineProps();
const router = useRouter();
const accountStore = useAccountStore();
// Dropdown-Logik
const isDropdownOpen = ref(false);
const dropdownButtonRef = ref(null);
const menuRef = ref(null);
const menuStyle = ref({});
// State für Modals
const showReconcileModal = ref(false);
const showEditModal = ref(false);
const showImportModal = ref(false); // neu für CSV-Import
const displayLogoSrc = ref(null);
// Logo laden
const loadDisplayLogo = async () => {
    const logoPath = props.account.logo_path;
    if (!logoPath) {
        displayLogoSrc.value = null;
        return;
    }
    // Zuerst Cache abfragen über TenantDbService für Konsistenz
    const activeTenantDB = useTenantStore().activeTenantDB;
    if (activeTenantDB) {
        const cachedLogo = await activeTenantDB.logoCache.get(logoPath);
        if (cachedLogo?.data) {
            displayLogoSrc.value = cachedLogo.data;
            return; // Logo im Cache gefunden, keine Netzwerkanfrage nötig
        }
    }
    // Nur wenn nicht im Cache: Netzwerkanfrage an Backend
    const dataUrl = await ImageService.fetchAndCacheLogo(logoPath);
    if (dataUrl) {
        displayLogoSrc.value = dataUrl;
    }
    else {
        displayLogoSrc.value = null;
    }
};
watch(() => props.account.logo_path, async (newLogoPath, oldLogoPath) => {
    if (newLogoPath !== oldLogoPath) {
        await loadDisplayLogo();
    }
}, { immediate: false } // immediate false, da onMounted bereits aufruft
);
onMounted(async () => {
    await loadDisplayLogo();
});
// IBAN‑Formatierung
const formattedIban = computed(() => {
    if (!props.account.iban)
        return "";
    const iban = props.account.iban.replace(/\s/g, "");
    return iban.match(/.{1,4}/g)?.join(" ") || iban;
});
// Aktueller Saldo (Service)
const currentBalance = computed(() => AccountService.getCurrentBalance(props.account.id));
// Aktionen
const showTransactions = () => {
    router.push({ name: "transactions", query: { accountId: props.account.id } });
};
const deleteAccount = async () => {
    if (confirm(`Möchtest Du das Konto "${props.account.name}" wirklich löschen?`)) {
        await accountStore.deleteAccount(props.account.id);
    }
};
// Modal Handler
const onReconciled = async () => {
    showReconcileModal.value = false;
    await accountStore.loadAccounts();
};
const onAccountSaved = async (accountData) => {
    showEditModal.value = false;
    // Delegate update to AccountService
    await AccountService.updateAccount(props.account.id, accountData);
};
// Handler für CSV-Import (neu)
const onImportCompleted = (count) => {
    showImportModal.value = false;
};
// Konto auswählen
const selectAccount = () => {
    emit("select", props.account);
};
// Dropdown-Logik
const openDropdown = () => {
    if (!dropdownButtonRef.value)
        return;
    const rect = dropdownButtonRef.value.getBoundingClientRect();
    menuStyle.value = {
        position: "fixed",
        top: `${rect.bottom}px`,
        left: `${rect.right}px`,
        transform: "translateX(-100%)",
        zIndex: 5000,
    };
    isDropdownOpen.value = true;
};
const closeDropdown = () => {
    isDropdownOpen.value = false;
};
const toggleDropdown = () => {
    if (isDropdownOpen.value) {
        closeDropdown();
    }
    else {
        openDropdown();
    }
};
const handleClickOutside = (event) => {
    if (menuRef.value && menuRef.value.contains(event.target)) {
        return;
    }
    closeDropdown();
};
watch(isDropdownOpen, (isOpen) => {
    if (isOpen) {
        document.addEventListener("click", handleClickOutside);
    }
    else {
        document.removeEventListener("click", handleClickOutside);
    }
});
onUnmounted(() => {
    document.removeEventListener("click", handleClickOutside);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ onClick: (__VLS_ctx.selectAccount) },
    ...{ class: ([
            'card rounded-md border border-base-300 shadow-none relative cursor-pointer hover:bg-base-300',
            props.active ? 'bg-primary/20' : 'bg-base-200',
        ]) },
    ...{ style: {} },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "absolute top-1 right-1" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.toggleDropdown) },
    ref: "dropdownButtonRef",
    ...{ class: "btn btn-ghost border-none btn-sm btn-circle" },
});
/** @type {typeof __VLS_ctx.dropdownButtonRef} */ ;
const __VLS_0 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    icon: "mdi:dots-vertical",
}));
const __VLS_2 = __VLS_1({
    icon: "mdi:dots-vertical",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const __VLS_4 = {}.Teleport;
/** @type {[typeof __VLS_components.Teleport, typeof __VLS_components.Teleport, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    to: "body",
}));
const __VLS_6 = __VLS_5({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_7.slots.default;
if (__VLS_ctx.isDropdownOpen) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({
        ref: "menuRef",
        ...{ style: (__VLS_ctx.menuStyle) },
        ...{ class: "menu p-2 shadow bg-base-100 border border-base-300 rounded-box w-52" },
    });
    /** @type {typeof __VLS_ctx.menuRef} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isDropdownOpen))
                    return;
                __VLS_ctx.showReconcileModal = true;
                __VLS_ctx.closeDropdown();
                ;
            } },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isDropdownOpen))
                    return;
                __VLS_ctx.showImportModal = true;
                __VLS_ctx.closeDropdown();
                ;
            } },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isDropdownOpen))
                    return;
                __VLS_ctx.showEditModal = true;
                __VLS_ctx.closeDropdown();
                ;
            } },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isDropdownOpen))
                    return;
                __VLS_ctx.deleteAccount();
                __VLS_ctx.closeDropdown();
                ;
            } },
        ...{ class: "text-error" },
    });
}
var __VLS_7;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card-body min-h-22 flex flex-row items-center p-0" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "drag-handle flex-shrink-0 ml-2 mr-1 cursor-grab active:cursor-grabbing flex items-center justify-center w-6 h-16 text-base-content/40 hover:text-base-content/60 transition-colors" },
});
const __VLS_8 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    icon: "mdi:drag-vertical",
    ...{ class: "text-lg" },
}));
const __VLS_10 = __VLS_9({
    icon: "mdi:drag-vertical",
    ...{ class: "text-lg" },
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "w-16 h-16 flex-shrink-0 mr-1 flex items-center justify-center rounded-full overflow-hidden bg-gray-200" },
});
if (__VLS_ctx.displayLogoSrc) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
        src: (__VLS_ctx.displayLogoSrc),
        alt: (props.account.name + ' Logo'),
        ...{ class: "w-full h-full object-cover" },
    });
}
else {
    const __VLS_12 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
        icon: "mdi:bank",
        ...{ class: "text-3xl text-gray-400" },
    }));
    const __VLS_14 = __VLS_13({
        icon: "mdi:bank",
        ...{ class: "text-3xl text-gray-400" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex-grow" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "grid grid-rows-[auto_auto_auto] m-1 pl-2 py-1" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
    ...{ class: "card-title m-0 p-0 text-lg" },
    ...{ class: ({ 'text-primary': props.active }) },
});
(__VLS_ctx.account.name);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "text-sm m-0 p-0" },
    ...{ class: ({ 'text-primary': props.active }) },
});
(__VLS_ctx.account.description);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "text-sm opacity-50 m-0 pt-1" },
    ...{ class: ({ 'text-primary': props.active }) },
});
(__VLS_ctx.formattedIban);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "justify-self-end flex items-center flex-shrink-0 ml-2 mr-3" },
});
/** @type {[typeof CurrencyDisplay, ]} */ ;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
    ...{ class: "text-right text-base whitespace-nowrap" },
    amount: (__VLS_ctx.currentBalance),
    showZero: (true),
    asInteger: (true),
}));
const __VLS_17 = __VLS_16({
    ...{ class: "text-right text-base whitespace-nowrap" },
    amount: (__VLS_ctx.currentBalance),
    showZero: (true),
    asInteger: (true),
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
const __VLS_19 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_20 = __VLS_asFunctionalComponent(__VLS_19, new __VLS_19({
    icon: "mdi:scale-balance",
    ...{ class: "text-secondary text-base opacity-50 ml-2" },
}));
const __VLS_21 = __VLS_20({
    icon: "mdi:scale-balance",
    ...{ class: "text-secondary text-base opacity-50 ml-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_20));
const __VLS_23 = {}.Teleport;
/** @type {[typeof __VLS_components.Teleport, typeof __VLS_components.Teleport, ]} */ ;
// @ts-ignore
const __VLS_24 = __VLS_asFunctionalComponent(__VLS_23, new __VLS_23({
    to: "body",
}));
const __VLS_25 = __VLS_24({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_24));
__VLS_26.slots.default;
if (__VLS_ctx.showReconcileModal) {
    /** @type {[typeof AccountReconcileModal, ]} */ ;
    // @ts-ignore
    const __VLS_27 = __VLS_asFunctionalComponent(AccountReconcileModal, new AccountReconcileModal({
        ...{ 'onClose': {} },
        ...{ 'onReconciled': {} },
        account: (__VLS_ctx.account),
        isOpen: (__VLS_ctx.showReconcileModal),
    }));
    const __VLS_28 = __VLS_27({
        ...{ 'onClose': {} },
        ...{ 'onReconciled': {} },
        account: (__VLS_ctx.account),
        isOpen: (__VLS_ctx.showReconcileModal),
    }, ...__VLS_functionalComponentArgsRest(__VLS_27));
    let __VLS_30;
    let __VLS_31;
    let __VLS_32;
    const __VLS_33 = {
        onClose: (...[$event]) => {
            if (!(__VLS_ctx.showReconcileModal))
                return;
            __VLS_ctx.showReconcileModal = false;
        }
    };
    const __VLS_34 = {
        onReconciled: (__VLS_ctx.onReconciled)
    };
    var __VLS_29;
}
if (__VLS_ctx.showEditModal) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal modal-open" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-box max-w-2xl" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "font-bold text-lg mb-4" },
    });
    /** @type {[typeof AccountForm, ]} */ ;
    // @ts-ignore
    const __VLS_35 = __VLS_asFunctionalComponent(AccountForm, new AccountForm({
        ...{ 'onSave': {} },
        ...{ 'onCancel': {} },
        account: (__VLS_ctx.account),
        isEdit: (true),
    }));
    const __VLS_36 = __VLS_35({
        ...{ 'onSave': {} },
        ...{ 'onCancel': {} },
        account: (__VLS_ctx.account),
        isEdit: (true),
    }, ...__VLS_functionalComponentArgsRest(__VLS_35));
    let __VLS_38;
    let __VLS_39;
    let __VLS_40;
    const __VLS_41 = {
        onSave: (__VLS_ctx.onAccountSaved)
    };
    const __VLS_42 = {
        onCancel: (...[$event]) => {
            if (!(__VLS_ctx.showEditModal))
                return;
            __VLS_ctx.showEditModal = false;
        }
    };
    var __VLS_37;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showEditModal))
                    return;
                __VLS_ctx.showEditModal = false;
            } },
        ...{ class: "modal-backdrop" },
    });
}
if (__VLS_ctx.showImportModal) {
    /** @type {[typeof TransactionImportModal, ]} */ ;
    // @ts-ignore
    const __VLS_43 = __VLS_asFunctionalComponent(TransactionImportModal, new TransactionImportModal({
        ...{ 'onClose': {} },
        ...{ 'onImported': {} },
        isOpen: (__VLS_ctx.showImportModal),
        accountId: (__VLS_ctx.account.id),
    }));
    const __VLS_44 = __VLS_43({
        ...{ 'onClose': {} },
        ...{ 'onImported': {} },
        isOpen: (__VLS_ctx.showImportModal),
        accountId: (__VLS_ctx.account.id),
    }, ...__VLS_functionalComponentArgsRest(__VLS_43));
    let __VLS_46;
    let __VLS_47;
    let __VLS_48;
    const __VLS_49 = {
        onClose: (...[$event]) => {
            if (!(__VLS_ctx.showImportModal))
                return;
            __VLS_ctx.showImportModal = false;
        }
    };
    const __VLS_50 = {
        onImported: (__VLS_ctx.onImportCompleted)
    };
    var __VLS_45;
}
var __VLS_26;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-none']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['top-1']} */ ;
/** @type {__VLS_StyleScopedClasses['right-1']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['border-none']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['menu']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
/** @type {__VLS_StyleScopedClasses['w-52']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-22']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-0']} */ ;
/** @type {__VLS_StyleScopedClasses['drag-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-grab']} */ ;
/** @type {__VLS_StyleScopedClasses['active:cursor-grabbing']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-6']} */ ;
/** @type {__VLS_StyleScopedClasses['h-16']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/40']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['w-16']} */ ;
/** @type {__VLS_StyleScopedClasses['h-16']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['object-cover']} */ ;
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-grow']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-rows-[auto_auto_auto]']} */ ;
/** @type {__VLS_StyleScopedClasses['m-1']} */ ;
/** @type {__VLS_StyleScopedClasses['pl-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
/** @type {__VLS_StyleScopedClasses['m-0']} */ ;
/** @type {__VLS_StyleScopedClasses['p-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['m-0']} */ ;
/** @type {__VLS_StyleScopedClasses['p-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['m-0']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-self-end']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
/** @type {__VLS_StyleScopedClasses['text-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
/** @type {__VLS_StyleScopedClasses['modal']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-open']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-backdrop']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            CurrencyDisplay: CurrencyDisplay,
            AccountReconcileModal: AccountReconcileModal,
            AccountForm: AccountForm,
            TransactionImportModal: TransactionImportModal,
            Icon: Icon,
            isDropdownOpen: isDropdownOpen,
            dropdownButtonRef: dropdownButtonRef,
            menuRef: menuRef,
            menuStyle: menuStyle,
            showReconcileModal: showReconcileModal,
            showEditModal: showEditModal,
            showImportModal: showImportModal,
            displayLogoSrc: displayLogoSrc,
            formattedIban: formattedIban,
            currentBalance: currentBalance,
            deleteAccount: deleteAccount,
            onReconciled: onReconciled,
            onAccountSaved: onAccountSaved,
            onImportCompleted: onImportCompleted,
            selectAccount: selectAccount,
            closeDropdown: closeDropdown,
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
