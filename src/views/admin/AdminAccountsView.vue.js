import { ref, computed } from "vue";
import { useAccountStore } from "../../stores/accountStore";
import AccountForm from "../../components/account/AccountForm.vue";
import CurrencyDisplay from "../../components/ui/CurrencyDisplay.vue";
import { AccountType } from "../../types";
import AccountGroupForm from "../../components/account/AccountGroupForm.vue";
import { useRouter } from "vue-router";
import { Icon } from "@iconify/vue";
import { BalanceService } from "../../services/BalanceService";
import { AccountService } from "../../services/AccountService";
import { debugLog, infoLog, errorLog } from "../../utils/logger";
// Stores
const accountStore = useAccountStore();
const router = useRouter();
const showAccountModal = ref(false);
const showGroupModal = ref(false);
const selectedAccount = ref(null);
const selectedGroup = ref(null);
const isEditMode = ref(false);
const isGroupEditMode = ref(false);
const accounts = computed(() => {
    return [...accountStore.accounts].sort((a, b) => {
        // Finde die entsprechenden Gruppen
        const groupA = accountStore.accountGroups.find((g) => g.id === a.accountGroupId);
        const groupB = accountStore.accountGroups.find((g) => g.id === b.accountGroupId);
        // Zuerst nach Gruppen-SortOrder sortieren
        const groupSortA = groupA?.sortOrder || 0;
        const groupSortB = groupB?.sortOrder || 0;
        if (groupSortA !== groupSortB) {
            return groupSortA - groupSortB;
        }
        // Bei gleicher Gruppen-SortOrder nach Account-SortOrder sortieren
        return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
});
const accountGroups = computed(() => {
    return [...accountStore.accountGroups].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
});
const getGroupName = (groupId) => {
    const group = accountGroups.value.find((g) => g.id === groupId);
    return group ? group.name : "Unbekannt";
};
const getGroupBalance = (groupId) => {
    const balances = AccountService.getGroupBalances();
    return balances[groupId] ?? 0;
};
// Liefert ein Tuple-Array [label, value] aus dem AccountType-Enum
const accountTypeOptions = computed(() => {
    return Object.entries(AccountType).map(([label, value]) => ({
        label,
        value,
    }));
});
// Format für Anzeige, falls benötigt
const formatAccountType = (type) => {
    const entry = Object.entries(AccountType).find(([, value]) => value === type);
    return entry ? entry[0] : "Unbekannt";
};
// Aktualisiert den Account-Typ bei Auswahlwechsel
const updateAccountType = async (account, newType) => {
    if (account.accountType === newType)
        return;
    try {
        await AccountService.updateAccount(account.id, { accountType: newType });
        infoLog("AdminAccountsView", `Account ${account.name} Typ geändert`, { accountId: account.id, oldType: account.accountType, newType });
    }
    catch (error) {
        errorLog("AdminAccountsView", `Fehler beim Ändern des Typs von Account ${account.name}`, { accountId: account.id, error });
    }
};
const editAccount = (account) => {
    selectedAccount.value = account;
    isEditMode.value = true;
    showAccountModal.value = true;
};
const createAccount = () => {
    selectedAccount.value = null;
    isEditMode.value = false;
    showAccountModal.value = true;
};
const saveAccount = async (accountData) => {
    if (isEditMode.value && selectedAccount.value) {
        await AccountService.updateAccount(selectedAccount.value.id, accountData);
    }
    else {
        await AccountService.addAccount(accountData);
    }
    showAccountModal.value = false;
};
const deleteAccount = (account) => {
    if (confirm(`Möchten Sie das Konto "${account.name}" wirklich löschen?`)) {
        AccountService.deleteAccount(account.id);
    }
};
const updateAccountGroup = async (account, newGroupId) => {
    // Prüfe, ob sich die Gruppe tatsächlich geändert hat
    if (account.accountGroupId === newGroupId) {
        debugLog("AdminAccountsView", `Account ${account.name} bleibt in derselben Gruppe ${newGroupId}`, { accountId: account.id, groupId: newGroupId });
        return;
    }
    try {
        // Verwende die gleiche Service-Methode wie beim Drag & Drop
        // Diese Methode berechnet automatisch die sortOrder für beide Gruppen neu
        await AccountService.moveAccountToGroup(account.id, newGroupId, 0); // An Position 0 (Anfang der Zielgruppe)
        infoLog("AdminAccountsView", `Account ${account.name} erfolgreich zu Gruppe ${newGroupId} verschoben`, { accountId: account.id, oldGroupId: account.accountGroupId, newGroupId });
    }
    catch (error) {
        errorLog("AdminAccountsView", `Fehler beim Verschieben von Account ${account.name} zu Gruppe ${newGroupId}`, {
            accountId: account.id,
            oldGroupId: account.accountGroupId,
            newGroupId,
            error,
        });
    }
};
const editAccountGroup = (group) => {
    selectedGroup.value = group;
    isGroupEditMode.value = true;
    showGroupModal.value = true;
};
const createAccountGroup = () => {
    selectedGroup.value = null;
    isGroupEditMode.value = false;
    showGroupModal.value = true;
};
const saveAccountGroup = async (groupData) => {
    if (isGroupEditMode.value && selectedGroup.value) {
        await AccountService.updateAccountGroup(selectedGroup.value.id, groupData);
    }
    else {
        await AccountService.addAccountGroup(groupData);
    }
    showGroupModal.value = false;
};
const deleteAccountGroup = async (groupId) => {
    if (confirm("Möchten Sie die Kontogruppe wirklich löschen?")) {
        debugLog("[AdminAccountsView]", "deleteAccountGroup", "Versuche Kontogruppe zu löschen", { groupId });
        const success = await AccountService.deleteAccountGroup(groupId);
        debugLog("[AdminAccountsView]", "deleteAccountGroup", "Löschvorgang abgeschlossen", { groupId, success });
        if (!success) {
            alert("Kontogruppe konnte nicht gelöscht werden. Stellen Sie sicher, dass keine Konten mehr in dieser Gruppe vorhanden sind.");
        }
    }
};
/**
 * Aktualisiert die Monatssalden aller Konten. Zentral für die Finanzübersicht.
 */
const updateMonthlyBalances = () => {
    BalanceService.calculateAllMonthlyBalances();
};
/**
 * Schaltet den aktiven Status eines Kontos um
 */
const toggleAccountStatus = async (account) => {
    try {
        const newStatus = !account.isActive;
        const success = await AccountService.updateAccount(account.id, {
            isActive: newStatus,
        });
        if (success) {
            infoLog("AdminAccountsView", `Konto "${account.name}" Status geändert zu: ${newStatus ? "Aktiv" : "Inaktiv"}`, { accountId: account.id, newStatus });
        }
        else {
            errorLog("AdminAccountsView", `Fehler beim Ändern des Status von Konto "${account.name}"`, { accountId: account.id, targetStatus: newStatus });
        }
    }
    catch (error) {
        errorLog("AdminAccountsView", `Fehler beim Umschalten des Konto-Status für "${account.name}"`, { accountId: account.id, error });
    }
};
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex w-full justify-between items-center mb-6 flex-wrap md:flex-nowrap" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
    ...{ class: "text-xl font-bold flex-shrink-0" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex justify-end w-full md:w-auto mt-2 md:mt-0" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "join" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.createAccountGroup) },
    ...{ class: "btn join-item rounded-l-full btn-sm btn-soft border border-base-300" },
});
const __VLS_0 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    icon: "mdi:folder-plus",
    ...{ class: "mr-2 text-base" },
}));
const __VLS_2 = __VLS_1({
    icon: "mdi:folder-plus",
    ...{ class: "mr-2 text-base" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.createAccount) },
    ...{ class: "btn join-item rounded-r-full btn-sm btn-soft border border-base-300" },
});
const __VLS_4 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    icon: "mdi:plus",
    ...{ class: "mr-2 text-base" },
}));
const __VLS_6 = __VLS_5({
    icon: "mdi:plus",
    ...{ class: "mr-2 text-base" },
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.updateMonthlyBalances) },
    ...{ class: "btn btn-soft btn-sm ml-4 border border-base-300" },
});
const __VLS_8 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    icon: "mdi:refresh",
    ...{ class: "mr-2 text-base" },
}));
const __VLS_10 = __VLS_9({
    icon: "mdi:refresh",
    ...{ class: "mr-2 text-base" },
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card bg-base-100 shadow-md border border-base-300 mb-6" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card-body" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
    ...{ class: "card-title text-lg mb-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "overflow-x-auto" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({
    ...{ class: "table table-zebra w-full" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "text-center" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "text-center" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "text-right" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "text-center" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "text-right" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
for (const [account] of __VLS_getVForSourceType((__VLS_ctx.accounts))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
        key: (account.id),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (account.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        ...{ onChange: (...[$event]) => {
                __VLS_ctx.updateAccountGroup(account, $event.target.value);
            } },
        ...{ class: "select select-sm w-full rounded-full border border-base-300" },
        value: (account.accountGroupId),
    });
    for (const [group] of __VLS_getVForSourceType((__VLS_ctx.accountGroups))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (group.id),
            value: (group.id),
        });
        (group.name);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        ...{ onChange: (...[$event]) => {
                __VLS_ctx.updateAccountType(account, $event.target.value);
            } },
        ...{ class: "select select-sm w-full rounded-full border border-base-300" },
        value: (account.accountType),
    });
    for (const [opt] of __VLS_getVForSourceType((__VLS_ctx.accountTypeOptions))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (opt.value),
            value: (opt.value),
        });
        (opt.label);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "text-right" },
    });
    /** @type {[typeof CurrencyDisplay, ]} */ ;
    // @ts-ignore
    const __VLS_12 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
        ...{ class: "text-right whitespace-nowrap" },
        amount: (__VLS_ctx.AccountService.getCurrentBalance(account.id)),
        showZero: (true),
        asInteger: (false),
    }));
    const __VLS_13 = __VLS_12({
        ...{ class: "text-right whitespace-nowrap" },
        amount: (__VLS_ctx.AccountService.getCurrentBalance(account.id)),
        showZero: (true),
        asInteger: (false),
    }, ...__VLS_functionalComponentArgsRest(__VLS_12));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "text-center" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.toggleAccountStatus(account);
            } },
        ...{ class: "badge rounded-full badge-soft cursor-pointer hover:opacity-80 transition-opacity" },
        ...{ class: (account.isActive ? 'badge-success' : 'badge-error') },
        title: (`Klicken um Status zu ${account.isActive ? 'Inaktiv' : 'Aktiv'} zu ändern`),
    });
    (account.isActive ? "Aktiv" : "Inaktiv");
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "text-right" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.editAccount(account);
            } },
        ...{ class: "btn btn-ghost btn-xs" },
    });
    const __VLS_15 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15({
        icon: "mdi:pencil",
        ...{ class: "text-base" },
    }));
    const __VLS_17 = __VLS_16({
        icon: "mdi:pencil",
        ...{ class: "text-base" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_16));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.deleteAccount(account);
            } },
        ...{ class: "btn btn-ghost btn-xs text-error" },
    });
    const __VLS_19 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_20 = __VLS_asFunctionalComponent(__VLS_19, new __VLS_19({
        icon: "mdi:trash-can",
        ...{ class: "text-base" },
    }));
    const __VLS_21 = __VLS_20({
        icon: "mdi:trash-can",
        ...{ class: "text-base" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_20));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card bg-base-100 shadow-md border border-base-300 mb-6" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card-body" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
    ...{ class: "card-title text-lg mb-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "overflow-x-auto" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({
    ...{ class: "table table-zebra w-full" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "text-center" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "text-right" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "text-right" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
for (const [group] of __VLS_getVForSourceType((__VLS_ctx.accountGroups))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
        key: (group.id),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (group.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "text-center" },
    });
    (__VLS_ctx.accounts.filter((a) => a.accountGroupId === group.id).length);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "text-right" },
    });
    /** @type {[typeof CurrencyDisplay, ]} */ ;
    // @ts-ignore
    const __VLS_23 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
        ...{ class: "text-right whitespace-nowrap" },
        amount: (__VLS_ctx.getGroupBalance(group.id)),
        showZero: (true),
        asInteger: (false),
    }));
    const __VLS_24 = __VLS_23({
        ...{ class: "text-right whitespace-nowrap" },
        amount: (__VLS_ctx.getGroupBalance(group.id)),
        showZero: (true),
        asInteger: (false),
    }, ...__VLS_functionalComponentArgsRest(__VLS_23));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "text-right" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.editAccountGroup(group);
            } },
        ...{ class: "btn btn-ghost btn-xs" },
    });
    const __VLS_26 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_27 = __VLS_asFunctionalComponent(__VLS_26, new __VLS_26({
        icon: "mdi:pencil",
        ...{ class: "text-base" },
    }));
    const __VLS_28 = __VLS_27({
        icon: "mdi:pencil",
        ...{ class: "text-base" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_27));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.deleteAccountGroup(group.id);
            } },
        ...{ class: "btn btn-ghost btn-xs text-error" },
    });
    const __VLS_30 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_31 = __VLS_asFunctionalComponent(__VLS_30, new __VLS_30({
        icon: "mdi:trash-can",
        ...{ class: "text-base" },
    }));
    const __VLS_32 = __VLS_31({
        icon: "mdi:trash-can",
        ...{ class: "text-base" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_31));
}
if (__VLS_ctx.showAccountModal) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal modal-open" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-box max-w-2xl" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "font-bold text-lg mb-4" },
    });
    (__VLS_ctx.isEditMode ? "Konto bearbeiten" : "Neues Konto");
    /** @type {[typeof AccountForm, ]} */ ;
    // @ts-ignore
    const __VLS_34 = __VLS_asFunctionalComponent(AccountForm, new AccountForm({
        ...{ 'onSave': {} },
        ...{ 'onCancel': {} },
        account: (__VLS_ctx.selectedAccount || undefined),
        isEdit: (__VLS_ctx.isEditMode),
    }));
    const __VLS_35 = __VLS_34({
        ...{ 'onSave': {} },
        ...{ 'onCancel': {} },
        account: (__VLS_ctx.selectedAccount || undefined),
        isEdit: (__VLS_ctx.isEditMode),
    }, ...__VLS_functionalComponentArgsRest(__VLS_34));
    let __VLS_37;
    let __VLS_38;
    let __VLS_39;
    const __VLS_40 = {
        onSave: (__VLS_ctx.saveAccount)
    };
    const __VLS_41 = {
        onCancel: (...[$event]) => {
            if (!(__VLS_ctx.showAccountModal))
                return;
            __VLS_ctx.showAccountModal = false;
        }
    };
    var __VLS_36;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showAccountModal))
                    return;
                __VLS_ctx.showAccountModal = false;
            } },
        ...{ class: "modal-backdrop" },
    });
}
if (__VLS_ctx.showGroupModal) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal modal-open" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-box max-w-2xl" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "font-bold text-lg mb-4" },
    });
    (__VLS_ctx.isGroupEditMode ? "Kontogruppe bearbeiten" : "Neue Kontogruppe");
    /** @type {[typeof AccountGroupForm, ]} */ ;
    // @ts-ignore
    const __VLS_42 = __VLS_asFunctionalComponent(AccountGroupForm, new AccountGroupForm({
        ...{ 'onSave': {} },
        ...{ 'onCancel': {} },
        group: (__VLS_ctx.selectedGroup || undefined),
        isEdit: (__VLS_ctx.isGroupEditMode),
    }));
    const __VLS_43 = __VLS_42({
        ...{ 'onSave': {} },
        ...{ 'onCancel': {} },
        group: (__VLS_ctx.selectedGroup || undefined),
        isEdit: (__VLS_ctx.isGroupEditMode),
    }, ...__VLS_functionalComponentArgsRest(__VLS_42));
    let __VLS_45;
    let __VLS_46;
    let __VLS_47;
    const __VLS_48 = {
        onSave: (__VLS_ctx.saveAccountGroup)
    };
    const __VLS_49 = {
        onCancel: (...[$event]) => {
            if (!(__VLS_ctx.showGroupModal))
                return;
            __VLS_ctx.showGroupModal = false;
        }
    };
    var __VLS_44;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showGroupModal))
                    return;
                __VLS_ctx.showGroupModal = false;
            } },
        ...{ class: "modal-backdrop" },
    });
}
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['md:flex-nowrap']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['md:w-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['md:mt-0']} */ ;
/** @type {__VLS_StyleScopedClasses['join']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['join-item']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-l-full']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['join-item']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-r-full']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['table']} */ ;
/** @type {__VLS_StyleScopedClasses['table-zebra']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:opacity-80']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-opacity']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['table']} */ ;
/** @type {__VLS_StyleScopedClasses['table-zebra']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['modal']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-open']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-backdrop']} */ ;
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
            AccountForm: AccountForm,
            CurrencyDisplay: CurrencyDisplay,
            AccountGroupForm: AccountGroupForm,
            Icon: Icon,
            AccountService: AccountService,
            showAccountModal: showAccountModal,
            showGroupModal: showGroupModal,
            selectedAccount: selectedAccount,
            selectedGroup: selectedGroup,
            isEditMode: isEditMode,
            isGroupEditMode: isGroupEditMode,
            accounts: accounts,
            accountGroups: accountGroups,
            getGroupBalance: getGroupBalance,
            accountTypeOptions: accountTypeOptions,
            updateAccountType: updateAccountType,
            editAccount: editAccount,
            createAccount: createAccount,
            saveAccount: saveAccount,
            deleteAccount: deleteAccount,
            updateAccountGroup: updateAccountGroup,
            editAccountGroup: editAccountGroup,
            createAccountGroup: createAccountGroup,
            saveAccountGroup: saveAccountGroup,
            deleteAccountGroup: deleteAccountGroup,
            updateMonthlyBalances: updateMonthlyBalances,
            toggleAccountStatus: toggleAccountStatus,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
