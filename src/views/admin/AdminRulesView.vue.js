import { ref, computed } from "vue";
import { useRuleStore } from "@/stores/ruleStore";
import { useTransactionStore } from "@/stores/transactionStore";
import { useRecipientStore } from "@/stores/recipientStore";
import RuleForm from "@/components/rules/RuleForm.vue";
import SearchGroup from "@/components/ui/SearchGroup.vue";
import PagingComponent from "@/components/ui/PagingComponent.vue";
import ConfirmationModal from "@/components/ui/ConfirmationModal.vue";
import { debugLog } from "@/utils/logger";
import { Icon } from "@iconify/vue";
const ruleStore = useRuleStore();
const transactionStore = useTransactionStore();
const recipientStore = useRecipientStore();
// UI-Zustand
const showNewRuleModal = ref(false);
const showEditRuleModal = ref(false);
const selectedRule = ref(null);
const searchQuery = ref("");
// Bestätigungsmodal für "Alle Regeln anwenden"
const showApplyAllRulesModal = ref(false);
const applyAllRulesData = ref({
    activeRulesCount: 0,
    totalTransactionsCount: 0,
});
// Pagination
const currentPage = ref(1);
const itemsPerPage = ref(25);
// Filtern der Regeln nach Suchbegriff
const filteredRules = computed(() => {
    if (!searchQuery.value.trim()) {
        return ruleStore.rules;
    }
    const term = searchQuery.value.toLowerCase();
    return ruleStore.rules.filter((rule) => {
        return (rule.name.toLowerCase().includes(term) ||
            (rule.description && rule.description.toLowerCase().includes(term)));
    });
});
// Pagination-Berechnung
const totalPages = computed(() => {
    if (itemsPerPage.value === "all")
        return 1;
    return Math.ceil(filteredRules.value.length / Number(itemsPerPage.value));
});
const paginatedRules = computed(() => {
    if (itemsPerPage.value === "all")
        return filteredRules.value;
    const start = (currentPage.value - 1) * Number(itemsPerPage.value);
    const end = start + Number(itemsPerPage.value);
    return filteredRules.value.slice(start, end);
});
// Neue Regel erstellen
const createRule = () => {
    selectedRule.value = null;
    showNewRuleModal.value = true;
};
// Regel bearbeiten
const editRule = (rule) => {
    selectedRule.value = rule;
    showEditRuleModal.value = true;
    debugLog("[AdminRulesView] Edit rule", rule);
};
// Regel speichern (hinzufügen oder aktualisieren)
const saveRule = (data) => {
    if (selectedRule.value) {
        ruleStore.updateRule(selectedRule.value.id, data);
        debugLog("[AdminRulesView] Updated rule", {
            id: selectedRule.value.id,
            ...data,
        });
    }
    else {
        ruleStore.addRule(data);
        debugLog("[AdminRulesView] Added rule", data);
    }
    showNewRuleModal.value = false;
    showEditRuleModal.value = false;
};
// Regel duplizieren
const duplicateRule = async (rule) => {
    try {
        // Erstelle eine Kopie der Regel mit neuem Namen und ohne ID
        const duplicatedRuleData = {
            name: `Kopie von ${rule.name}`,
            description: rule.description,
            stage: rule.stage,
            conditions: [...rule.conditions], // Deep copy der Bedingungen
            actions: [...rule.actions], // Deep copy der Aktionen
            priority: rule.priority,
            isActive: rule.isActive,
            conditionLogic: rule.conditionLogic,
        };
        // Regel über den Store hinzufügen (generiert automatisch neue ID und updatedAt)
        await ruleStore.addRule(duplicatedRuleData);
        debugLog("[AdminRulesView] Duplicated rule", {
            originalId: rule.id,
            originalName: rule.name,
            newName: duplicatedRuleData.name,
        });
        // Toast-Notification anzeigen
        showToastNotification(`Die Regel "${rule.name}" wurde erfolgreich als "${duplicatedRuleData.name}" dupliziert.`, "success");
    }
    catch (error) {
        console.error(`Fehler beim Duplizieren der Regel "${rule.name}":`, error);
        showToastNotification(`Fehler beim Duplizieren der Regel "${rule.name}". Bitte versuchen Sie es erneut.`, "error");
    }
};
// Regel löschen
const deleteRule = (rule) => {
    if (confirm(`Möchten Sie die Regel "${rule.name}" wirklich löschen?`)) {
        ruleStore.deleteRule(rule.id);
        debugLog("[AdminRulesView] Deleted rule", rule.id);
    }
};
// Regel aktivieren/deaktivieren
const toggleRuleActive = async (rule) => {
    try {
        const newStatus = !rule.isActive;
        // Vollständige Regel-Daten mit neuem Status übergeben
        const updatedRule = {
            ...rule,
            isActive: newStatus,
            updated_at: new Date().toISOString(),
        };
        // ID aus dem Update-Objekt entfernen, da updateRule sie als separaten Parameter erwartet
        const { id, ...ruleWithoutId } = updatedRule;
        await ruleStore.updateRule(rule.id, ruleWithoutId);
        debugLog("[AdminRulesView] Toggled rule active state", {
            id: rule.id,
            isActive: newStatus,
        });
    }
    catch (error) {
        console.error(`Fehler beim Umschalten des Regel-Status für "${rule.name}":`, error);
    }
};
// Regel auf bestehende Transaktionen anwenden - Vereinfachte Version
const showApplyRuleModal = ref(false);
const applyRuleData = ref({
    rule: null,
    matchedCount: 0,
});
// Toast-Notification System
const showToast = ref(false);
const toastMessage = ref("");
const toastType = ref("success");
let toastTimeout = null;
const showToastNotification = (message, type = "success") => {
    toastMessage.value = message;
    toastType.value = type;
    showToast.value = true;
    // Auto-hide nach 3 Sekunden
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }
    toastTimeout = setTimeout(() => {
        showToast.value = false;
    }, 3000);
};
const hideToast = () => {
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }
    showToast.value = false;
};
const applyRuleToTransactions = async (rule) => {
    // Nur EXPENSE und INCOME Transaktionen holen (Rules greifen nicht bei Transfers)
    const allTransactions = [...transactionStore.transactions].filter((tx) => tx.type === "EXPENSE" || tx.type === "INCOME");
    debugLog("[AdminRulesView] Analyzing rule application", {
        ruleId: rule.id,
        ruleName: rule.name,
        totalTransactions: allTransactions.length,
        filteredTransactions: allTransactions.length,
        ruleConditions: rule.conditions,
    });
    let matchedCount = 0;
    const matchedTransactions = [];
    // Alle Transaktionen durchgehen und prüfen, ob die Regel zutrifft
    for (const tx of allTransactions) {
        try {
            if (ruleStore.checkConditions(rule.conditions, tx)) {
                matchedCount++;
                matchedTransactions.push(tx);
                // Debug-Log für die ersten 5 Treffer
                if (matchedCount <= 5) {
                    debugLog("[AdminRulesView] Rule match found", {
                        transactionId: tx.id,
                        payee: tx.payee,
                        recipientId: tx.recipientId,
                        date: tx.date,
                        amount: tx.amount,
                    });
                }
            }
        }
        catch (error) {
            console.error(`Fehler beim Prüfen der Regel auf Transaktion ${tx.id}:`, error);
        }
    }
    // Daten für Modal setzen und Modal öffnen
    applyRuleData.value = {
        rule,
        matchedCount,
    };
    showApplyRuleModal.value = true;
    debugLog("[AdminRulesView] Rule analysis completed", {
        ruleId: rule.id,
        matchedCount: matchedCount,
        totalTransactions: allTransactions.length,
        sampleMatches: matchedTransactions.slice(0, 3).map((tx) => ({
            id: tx.id,
            payee: tx.payee,
            recipientId: tx.recipientId,
        })),
    });
};
// Regel tatsächlich anwenden (nach Bestätigung)
const confirmApplyRule = async () => {
    if (!applyRuleData.value.rule || applyRuleData.value.matchedCount === 0) {
        return;
    }
    try {
        const rule = applyRuleData.value.rule;
        // Nur EXPENSE und INCOME Transaktionen berücksichtigen (Rules greifen nicht bei Transfers)
        const allTransactions = [...transactionStore.transactions].filter((tx) => tx.type === "EXPENSE" || tx.type === "INCOME");
        let appliedCount = 0;
        // Alle Transaktionen durchgehen und Regel anwenden
        for (const tx of allTransactions) {
            if (ruleStore.checkConditions(rule.conditions, tx)) {
                // Regel-Aktionen auf die Transaktion anwenden
                const updates = {};
                for (const action of rule.actions) {
                    switch (action.type) {
                        case "SET_CATEGORY":
                            if (tx.categoryId !== action.value) {
                                updates.categoryId = String(action.value);
                            }
                            break;
                        case "SET_RECIPIENT":
                            if (tx.recipientId !== action.value) {
                                updates.recipientId = String(action.value);
                            }
                            break;
                        case "SET_NOTE":
                            if (tx.note !== action.value) {
                                updates.note = String(action.value);
                            }
                            break;
                        case "ADD_TAG":
                            const currentTags = tx.tagIds || [];
                            const newTag = String(action.value);
                            if (!currentTags.includes(newTag)) {
                                updates.tagIds = [...currentTags, newTag];
                            }
                            break;
                        case "SET_ACCOUNT":
                            if (tx.accountId !== action.value) {
                                updates.accountId = String(action.value);
                            }
                            break;
                    }
                }
                // Update über TransactionStore, falls Änderungen vorhanden
                if (Object.keys(updates).length > 0) {
                    await transactionStore.updateTransaction(tx.id, updates);
                    appliedCount++;
                }
            }
        }
        // Toast-Notification anzeigen
        showToastNotification(`Die Regel "${rule.name}" wurde erfolgreich auf ${appliedCount} Transaktionen angewendet.`, "success");
        debugLog("[AdminRulesView] Rule applied successfully", {
            ruleId: rule.id,
            transactionCount: appliedCount,
        });
    }
    catch (error) {
        console.error("Fehler beim Anwenden der Regel:", error);
        showToastNotification("Fehler beim Anwenden der Regel. Bitte versuchen Sie es erneut.", "error");
    }
    finally {
        // Modal schließen und Daten zurücksetzen
        showApplyRuleModal.value = false;
        applyRuleData.value = {
            rule: null,
            matchedCount: 0,
        };
    }
};
// Modal schließen ohne Änderungen
const cancelApplyRule = () => {
    showApplyRuleModal.value = false;
    applyRuleData.value = {
        rule: null,
        matchedCount: 0,
    };
};
// Alle aktiven Regeln auf alle Transaktionen anwenden
const applyAllRules = async () => {
    try {
        // Alle aktiven Regeln holen, sortiert nach Priorität
        const activeRules = ruleStore.rules
            .filter((rule) => rule.isActive)
            .sort((a, b) => (a.priority || 0) - (b.priority || 0));
        if (activeRules.length === 0) {
            showToastNotification("Keine aktiven Regeln vorhanden. Aktivieren Sie mindestens eine Regel.", "error");
            return;
        }
        // Daten für Bestätigungsmodal setzen und Modal öffnen
        applyAllRulesData.value = {
            activeRulesCount: activeRules.length,
            totalTransactionsCount: transactionStore.transactions.length,
        };
        showApplyAllRulesModal.value = true;
    }
    catch (error) {
        console.error("Fehler beim Vorbereiten der Regel-Anwendung:", error);
        showToastNotification("Fehler beim Vorbereiten der Regel-Anwendung. Bitte versuchen Sie es erneut.", "error");
    }
};
// Bestätigung für "Alle Regeln anwenden" - tatsächliche Ausführung
const confirmApplyAllRules = async () => {
    try {
        showApplyAllRulesModal.value = false;
        // Alle aktiven Regeln holen, sortiert nach Priorität
        const activeRules = ruleStore.rules
            .filter((rule) => rule.isActive)
            .sort((a, b) => (a.priority || 0) - (b.priority || 0));
        const allTransactions = [...transactionStore.transactions];
        let totalAppliedCount = 0;
        const ruleResults = [];
        debugLog("[AdminRulesView] Starting bulk rule application", {
            activeRulesCount: activeRules.length,
            totalTransactions: allTransactions.length,
        });
        // Jede aktive Regel auf alle Transaktionen anwenden
        for (const rule of activeRules) {
            let ruleAppliedCount = 0;
            for (const tx of allTransactions) {
                try {
                    if (ruleStore.checkConditions(rule.conditions, tx)) {
                        // Regel-Aktionen auf die Transaktion anwenden
                        const updates = {};
                        for (const action of rule.actions) {
                            switch (action.type) {
                                case "SET_CATEGORY":
                                    if (tx.categoryId !== action.value) {
                                        updates.categoryId = String(action.value);
                                    }
                                    break;
                                case "SET_RECIPIENT":
                                    if (tx.recipientId !== action.value) {
                                        updates.recipientId = String(action.value);
                                    }
                                    break;
                                case "SET_NOTE":
                                    if (tx.note !== action.value) {
                                        updates.note = String(action.value);
                                    }
                                    break;
                                case "ADD_TAG":
                                    const currentTags = tx.tagIds || [];
                                    const newTag = String(action.value);
                                    if (!currentTags.includes(newTag)) {
                                        updates.tagIds = [...currentTags, newTag];
                                    }
                                    break;
                                case "SET_ACCOUNT":
                                    if (tx.accountId !== action.value) {
                                        updates.accountId = String(action.value);
                                    }
                                    break;
                            }
                        }
                        // Update über TransactionStore, falls Änderungen vorhanden
                        if (Object.keys(updates).length > 0) {
                            await transactionStore.updateTransaction(tx.id, updates);
                            ruleAppliedCount++;
                            totalAppliedCount++;
                        }
                    }
                }
                catch (error) {
                    console.error(`Fehler beim Anwenden der Regel "${rule.name}" auf Transaktion ${tx.id}:`, error);
                }
            }
            ruleResults.push({
                ruleName: rule.name,
                appliedCount: ruleAppliedCount,
            });
            debugLog("[AdminRulesView] Rule applied", {
                ruleId: rule.id,
                ruleName: rule.name,
                appliedCount: ruleAppliedCount,
            });
        }
        // Erfolgs-Toast mit Details anzeigen
        const successMessage = `Alle Regeln wurden erfolgreich angewendet!\n\nInsgesamt: ${totalAppliedCount} Änderungen\n${ruleResults
            .filter((r) => r.appliedCount > 0)
            .map((r) => `• ${r.ruleName}: ${r.appliedCount}`)
            .join("\n")}`;
        showToastNotification(`Alle ${activeRules.length} Regeln wurden erfolgreich angewendet. Insgesamt ${totalAppliedCount} Transaktionen wurden aktualisiert.`, "success");
        debugLog("[AdminRulesView] Bulk rule application completed", {
            totalRules: activeRules.length,
            totalAppliedCount,
            ruleResults,
        });
    }
    catch (error) {
        console.error("Fehler beim Anwenden aller Regeln:", error);
        showToastNotification("Fehler beim Anwenden der Regeln. Bitte versuchen Sie es erneut.", "error");
    }
};
// Abbrechen der "Alle Regeln anwenden" Aktion
const cancelApplyAllRules = () => {
    showApplyAllRulesModal.value = false;
    applyAllRulesData.value = {
        activeRulesCount: 0,
        totalTransactionsCount: 0,
    };
};
// Formatierung der Ausführungsphase
function formatStage(stage) {
    switch (stage) {
        case "PRE":
            return "Vorab";
        case "DEFAULT":
            return "Normal";
        case "POST":
            return "Nachgelagert";
        default:
            return stage;
    }
}
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
/** @type {[typeof SearchGroup, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(SearchGroup, new SearchGroup({
    ...{ 'onSearch': {} },
    ...{ 'onBtnMiddleClick': {} },
    ...{ 'onBtnRightClick': {} },
    btnMiddle: "Alle Regeln anwenden",
    btnMiddleIcon: "mdi:play-circle",
    btnRight: "Neue Regel",
    btnRightIcon: "mdi:plus",
}));
const __VLS_1 = __VLS_0({
    ...{ 'onSearch': {} },
    ...{ 'onBtnMiddleClick': {} },
    ...{ 'onBtnRightClick': {} },
    btnMiddle: "Alle Regeln anwenden",
    btnMiddleIcon: "mdi:play-circle",
    btnRight: "Neue Regel",
    btnRightIcon: "mdi:plus",
}, ...__VLS_functionalComponentArgsRest(__VLS_0));
let __VLS_3;
let __VLS_4;
let __VLS_5;
const __VLS_6 = {
    onSearch: ((query) => (__VLS_ctx.searchQuery = query))
};
const __VLS_7 = {
    onBtnMiddleClick: (__VLS_ctx.applyAllRules)
};
const __VLS_8 = {
    onBtnRightClick: (__VLS_ctx.createRule)
};
var __VLS_2;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card bg-base-100 shadow-md border border-base-300 w-full mt-6" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card-body" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "overflow-x-auto" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({
    ...{ class: "table w-full" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "text-right" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
for (const [rule] of __VLS_getVForSourceType((__VLS_ctx.paginatedRules))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
        key: (rule.id),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (rule?.name || "-");
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (rule?.description || "-");
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (rule?.stage ? __VLS_ctx.formatStage(rule.stage) : "-");
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (rule?.priority || 0);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (rule?.conditions?.length || 0);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (rule?.actions?.length || 0);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.toggleRuleActive(rule);
            } },
        ...{ class: "badge rounded-full badge-soft cursor-pointer hover:opacity-80 transition-opacity" },
        ...{ class: (rule.isActive ? 'badge-success' : 'badge-error') },
        title: (`Klicken um Status zu ${rule.isActive ? 'Inaktiv' : 'Aktiv'} zu ändern`),
    });
    (rule.isActive ? "Aktiv" : "Inaktiv");
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "text-right" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex justify-end space-x-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.editRule(rule);
            } },
        ...{ class: "btn btn-ghost btn-xs border-none" },
    });
    const __VLS_9 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_10 = __VLS_asFunctionalComponent(__VLS_9, new __VLS_9({
        icon: "mdi:pencil",
        ...{ class: "text-base" },
    }));
    const __VLS_11 = __VLS_10({
        icon: "mdi:pencil",
        ...{ class: "text-base" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_10));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "tooltip tooltip-left" },
        'data-tip': "Regel auf alle existierenden Transaktionen anwenden. Zeigt Vorschau und fragt nach Bestätigung.",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.applyRuleToTransactions(rule);
            } },
        ...{ class: "btn btn-ghost btn-xs border-none text-warning" },
    });
    const __VLS_13 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_14 = __VLS_asFunctionalComponent(__VLS_13, new __VLS_13({
        icon: "mdi:play",
        ...{ class: "text-base" },
    }));
    const __VLS_15 = __VLS_14({
        icon: "mdi:play",
        ...{ class: "text-base" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_14));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "tooltip tooltip-left" },
        'data-tip': "Regel duplizieren. Erstellt eine Kopie der Regel mit dem Präfix 'Kopie von'.",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.duplicateRule(rule);
            } },
        ...{ class: "btn btn-ghost btn-xs border-none text-info" },
    });
    const __VLS_17 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_18 = __VLS_asFunctionalComponent(__VLS_17, new __VLS_17({
        icon: "mdi:content-copy",
        ...{ class: "text-base" },
    }));
    const __VLS_19 = __VLS_18({
        icon: "mdi:content-copy",
        ...{ class: "text-base" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_18));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.deleteRule(rule);
            } },
        ...{ class: "btn btn-ghost btn-xs border-none text-error/75" },
    });
    const __VLS_21 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_22 = __VLS_asFunctionalComponent(__VLS_21, new __VLS_21({
        icon: "mdi:trash-can",
        ...{ class: "text-base" },
    }));
    const __VLS_23 = __VLS_22({
        icon: "mdi:trash-can",
        ...{ class: "text-base" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_22));
}
if (__VLS_ctx.paginatedRules.length === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        colspan: "8",
        ...{ class: "text-center py-4" },
    });
}
/** @type {[typeof PagingComponent, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(PagingComponent, new PagingComponent({
    ...{ 'onUpdate:currentPage': {} },
    ...{ 'onUpdate:itemsPerPage': {} },
    currentPage: (__VLS_ctx.currentPage),
    totalPages: (__VLS_ctx.totalPages),
    itemsPerPage: (__VLS_ctx.itemsPerPage),
}));
const __VLS_26 = __VLS_25({
    ...{ 'onUpdate:currentPage': {} },
    ...{ 'onUpdate:itemsPerPage': {} },
    currentPage: (__VLS_ctx.currentPage),
    totalPages: (__VLS_ctx.totalPages),
    itemsPerPage: (__VLS_ctx.itemsPerPage),
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
let __VLS_28;
let __VLS_29;
let __VLS_30;
const __VLS_31 = {
    'onUpdate:currentPage': ((val) => (__VLS_ctx.currentPage = val))
};
const __VLS_32 = {
    'onUpdate:itemsPerPage': ((val) => (__VLS_ctx.itemsPerPage = val))
};
var __VLS_27;
if (__VLS_ctx.showNewRuleModal) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal modal-open" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-box max-w-4xl" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "font-bold text-lg mb-4" },
    });
    /** @type {[typeof RuleForm, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(RuleForm, new RuleForm({
        ...{ 'onSave': {} },
        ...{ 'onCancel': {} },
        ...{ 'onApply': {} },
    }));
    const __VLS_34 = __VLS_33({
        ...{ 'onSave': {} },
        ...{ 'onCancel': {} },
        ...{ 'onApply': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    let __VLS_36;
    let __VLS_37;
    let __VLS_38;
    const __VLS_39 = {
        onSave: (__VLS_ctx.saveRule)
    };
    const __VLS_40 = {
        onCancel: (...[$event]) => {
            if (!(__VLS_ctx.showNewRuleModal))
                return;
            __VLS_ctx.showNewRuleModal = false;
        }
    };
    const __VLS_41 = {
        onApply: (__VLS_ctx.applyRuleToTransactions)
    };
    var __VLS_35;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showNewRuleModal))
                    return;
                __VLS_ctx.showNewRuleModal = false;
            } },
        ...{ class: "modal-backdrop bg-black/30" },
    });
}
if (__VLS_ctx.showEditRuleModal && __VLS_ctx.selectedRule) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal modal-open" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-box max-w-4xl" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "font-bold text-lg mb-4" },
    });
    /** @type {[typeof RuleForm, ]} */ ;
    // @ts-ignore
    const __VLS_42 = __VLS_asFunctionalComponent(RuleForm, new RuleForm({
        ...{ 'onSave': {} },
        ...{ 'onCancel': {} },
        ...{ 'onApply': {} },
        rule: (__VLS_ctx.selectedRule),
        isEdit: (true),
    }));
    const __VLS_43 = __VLS_42({
        ...{ 'onSave': {} },
        ...{ 'onCancel': {} },
        ...{ 'onApply': {} },
        rule: (__VLS_ctx.selectedRule),
        isEdit: (true),
    }, ...__VLS_functionalComponentArgsRest(__VLS_42));
    let __VLS_45;
    let __VLS_46;
    let __VLS_47;
    const __VLS_48 = {
        onSave: (__VLS_ctx.saveRule)
    };
    const __VLS_49 = {
        onCancel: (...[$event]) => {
            if (!(__VLS_ctx.showEditRuleModal && __VLS_ctx.selectedRule))
                return;
            __VLS_ctx.showEditRuleModal = false;
        }
    };
    const __VLS_50 = {
        onApply: (__VLS_ctx.applyRuleToTransactions)
    };
    var __VLS_44;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showEditRuleModal && __VLS_ctx.selectedRule))
                    return;
                __VLS_ctx.showEditRuleModal = false;
            } },
        ...{ class: "modal-backdrop bg-black/30" },
    });
}
if (__VLS_ctx.showApplyRuleModal) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal modal-open" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-box" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "font-bold text-lg mb-4" },
    });
    (__VLS_ctx.applyRuleData.rule?.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "bg-base-200 p-4 rounded-lg mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-sm" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.applyRuleData.matchedCount);
    (__VLS_ctx.transactionStore.transactions.length);
    if (__VLS_ctx.applyRuleData.matchedCount > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "text-xs text-base-content/70 mt-2" },
        });
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "text-xs text-base-content/70 mt-2" },
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-action" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.cancelApplyRule) },
        ...{ class: "btn" },
    });
    (__VLS_ctx.applyRuleData.matchedCount > 0 ? "Abbrechen" : "OK");
    if (__VLS_ctx.applyRuleData.matchedCount > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.confirmApplyRule) },
            ...{ class: "btn btn-primary" },
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (__VLS_ctx.cancelApplyRule) },
        ...{ class: "modal-backdrop bg-black/30" },
    });
}
if (__VLS_ctx.showApplyAllRulesModal) {
    /** @type {[typeof ConfirmationModal, ]} */ ;
    // @ts-ignore
    const __VLS_51 = __VLS_asFunctionalComponent(ConfirmationModal, new ConfirmationModal({
        ...{ 'onConfirm': {} },
        ...{ 'onCancel': {} },
        title: "Alle Regeln anwenden",
        message: (`Möchten Sie alle ${__VLS_ctx.applyAllRulesData.activeRulesCount} aktiven Regeln auf alle ${__VLS_ctx.applyAllRulesData.totalTransactionsCount} Transaktionen anwenden?\n\nDies kann nicht rückgängig gemacht werden.`),
        confirmText: "Regeln anwenden",
        cancelText: "Abbrechen",
    }));
    const __VLS_52 = __VLS_51({
        ...{ 'onConfirm': {} },
        ...{ 'onCancel': {} },
        title: "Alle Regeln anwenden",
        message: (`Möchten Sie alle ${__VLS_ctx.applyAllRulesData.activeRulesCount} aktiven Regeln auf alle ${__VLS_ctx.applyAllRulesData.totalTransactionsCount} Transaktionen anwenden?\n\nDies kann nicht rückgängig gemacht werden.`),
        confirmText: "Regeln anwenden",
        cancelText: "Abbrechen",
    }, ...__VLS_functionalComponentArgsRest(__VLS_51));
    let __VLS_54;
    let __VLS_55;
    let __VLS_56;
    const __VLS_57 = {
        onConfirm: (__VLS_ctx.confirmApplyAllRules)
    };
    const __VLS_58 = {
        onCancel: (__VLS_ctx.cancelApplyAllRules)
    };
    var __VLS_53;
}
if (__VLS_ctx.showToast) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (__VLS_ctx.hideToast) },
        ...{ class: "toast toast-bottom toast-start z-50" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "alert cursor-pointer transition-all duration-300" },
        ...{ class: ({
                'alert-success': __VLS_ctx.toastType === 'success',
                'alert-error': __VLS_ctx.toastType === 'error',
            }) },
    });
    const __VLS_59 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_60 = __VLS_asFunctionalComponent(__VLS_59, new __VLS_59({
        icon: (__VLS_ctx.toastType === 'success' ? 'mdi:check-circle' : 'mdi:alert-circle'),
        ...{ class: "text-lg" },
    }));
    const __VLS_61 = __VLS_60({
        icon: (__VLS_ctx.toastType === 'success' ? 'mdi:check-circle' : 'mdi:alert-circle'),
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_60));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.toastMessage);
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
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['table']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:opacity-80']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-opacity']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-1']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['border-none']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip-left']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['border-none']} */ ;
/** @type {__VLS_StyleScopedClasses['text-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip-left']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['border-none']} */ ;
/** @type {__VLS_StyleScopedClasses['text-info']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['border-none']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error/75']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['modal']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-open']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-4xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-backdrop']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/30']} */ ;
/** @type {__VLS_StyleScopedClasses['modal']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-open']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-4xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-backdrop']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/30']} */ ;
/** @type {__VLS_StyleScopedClasses['modal']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-open']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-action']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-backdrop']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/30']} */ ;
/** @type {__VLS_StyleScopedClasses['toast']} */ ;
/** @type {__VLS_StyleScopedClasses['toast-bottom']} */ ;
/** @type {__VLS_StyleScopedClasses['toast-start']} */ ;
/** @type {__VLS_StyleScopedClasses['z-50']} */ ;
/** @type {__VLS_StyleScopedClasses['alert']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['duration-300']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-success']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-error']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            RuleForm: RuleForm,
            SearchGroup: SearchGroup,
            PagingComponent: PagingComponent,
            ConfirmationModal: ConfirmationModal,
            Icon: Icon,
            transactionStore: transactionStore,
            showNewRuleModal: showNewRuleModal,
            showEditRuleModal: showEditRuleModal,
            selectedRule: selectedRule,
            searchQuery: searchQuery,
            showApplyAllRulesModal: showApplyAllRulesModal,
            applyAllRulesData: applyAllRulesData,
            currentPage: currentPage,
            itemsPerPage: itemsPerPage,
            totalPages: totalPages,
            paginatedRules: paginatedRules,
            createRule: createRule,
            editRule: editRule,
            saveRule: saveRule,
            duplicateRule: duplicateRule,
            deleteRule: deleteRule,
            toggleRuleActive: toggleRuleActive,
            showApplyRuleModal: showApplyRuleModal,
            applyRuleData: applyRuleData,
            showToast: showToast,
            toastMessage: toastMessage,
            toastType: toastType,
            hideToast: hideToast,
            applyRuleToTransactions: applyRuleToTransactions,
            confirmApplyRule: confirmApplyRule,
            cancelApplyRule: cancelApplyRule,
            applyAllRules: applyAllRules,
            confirmApplyAllRules: confirmApplyAllRules,
            cancelApplyAllRules: cancelApplyAllRules,
            formatStage: formatStage,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
