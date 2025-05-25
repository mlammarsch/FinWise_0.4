// Datei: src/mock/seed.ts
import { useAccountStore } from "../stores/accountStore";
import { useTransactionStore } from "../stores/transactionStore";
import { useTagStore } from "../stores/tagStore";
import { useCategoryStore } from "../stores/categoryStore";
import { useRecipientStore } from "../stores/recipientStore";
import { usePlanningStore } from "../stores/planningStore";
import { useStatisticsStore } from "../stores/statisticsStore";
import { useThemeStore } from "../stores/themeStore";
import { infoLog, warnLog, LogConfig, LogLevel } from "../utils/logger";
import { createPinia } from "pinia";

const pinia = createPinia();

export function seedData() {
  const accountStore = useAccountStore(pinia);
  const transactionStore = useTransactionStore(pinia);
  const tagStore = useTagStore(pinia);
  const categoryStore = useCategoryStore(pinia);
  const recipientStore = useRecipientStore(pinia);

  // Logger-Konfiguration initialisieren
  if (localStorage.getItem('finwise_log_level') === null) {
    localStorage.setItem('finwise_log_level', LogLevel.INFO.toString());
  }

  if (localStorage.getItem('finwise_log_categories') === null) {
    localStorage.setItem('finwise_log_categories', JSON.stringify(['store', 'ui', 'service']));
  }

  try {
    LogConfig.level = parseInt(localStorage.getItem('finwise_log_level') || LogLevel.INFO.toString());
    const enabledCategories = JSON.parse(localStorage.getItem('finwise_log_categories') || '["store", "ui", "service"]');
    LogConfig.enabledCategories = new Set<string>(enabledCategories);
  } catch (error) {
    console.error("Fehler beim Laden der Log-Konfiguration:", error);
  }

  if (recipientStore.recipients.length === 0) {
    [
      "Rewe", "Aldi", "Lidl", "Bäcker", "Arbeitgeber GmbH", "Finanzamt",
      "Autowerkstatt Halmich", "Amazon", "Tankstelle", "Klaus Wilhelm"
    ].forEach((name) => recipientStore.addRecipient({ name }));
  }

  if (tagStore.tags.length === 0) {
    [
      "Lebensmittel", "Freizeit", "Auto", "Wohnen", "Haushalt",
      "Versicherung", "Gesundheit", "Urlaub", "Internet", "Telefon"
    ].forEach((name) => tagStore.addTag({ name, parentTagId: null }));
  }

  if (categoryStore.categoryGroups.length === 0) {
    const einnahmenGroupId = crypto.randomUUID();
    const lebenGroupId = crypto.randomUUID();
    const fixkostenGroupId = crypto.randomUUID();

    categoryStore.addCategoryGroup({
      id: einnahmenGroupId,
      name: "Einnahmen",
      sortOrder: 0,
      isIncomeGroup: true
    });

    categoryStore.addCategoryGroup({
      id: lebenGroupId,
      name: "Lebenshaltung",
      sortOrder: 1,
      isIncomeGroup: false
    });

    categoryStore.addCategoryGroup({
      id: fixkostenGroupId,
      name: "Fixkosten",
      sortOrder: 2,
      isIncomeGroup: false
    });

    const kategorien = [
      { name: "Gehalt", isIncomeCategory: true, groupId: einnahmenGroupId },
      { name: "Nebenjob", isIncomeCategory: true, groupId: einnahmenGroupId },
      { name: "Lebensmittel", isIncomeCategory: false, groupId: lebenGroupId },
      { name: "Freizeit", isIncomeCategory: false, groupId: lebenGroupId },
      { name: "Reparaturen", isIncomeCategory: false, groupId: lebenGroupId },
      { name: "Miete", isIncomeCategory: false, groupId: fixkostenGroupId },
      { name: "Versicherung", isIncomeCategory: false, groupId: fixkostenGroupId },
      { name: "Gesundheit", isIncomeCategory: false, groupId: fixkostenGroupId },
      { name: "Sparen", isIncomeCategory: false, groupId: fixkostenGroupId },
      { name: "Bargeld", isIncomeCategory: false, groupId: fixkostenGroupId }
    ];

    kategorien.forEach((k, index) => {
      categoryStore.addCategory({
        name: k.name,
        parentCategoryId: null,
        isIncomeCategory: k.isIncomeCategory,
        isHidden: false,
        isActive: true,
        budgeted: 0,
        activity: 0,
        available: 0,
        sortOrder: index,
        categoryGroupId: k.groupId
      });
    });
  }

  if (accountStore.accounts.length === 0) {
    const defaultGroupId = accountStore.accountGroups[0]?.id || "";
    const secondGroupId = accountStore.accountGroups[1]?.id || defaultGroupId;

    accountStore.addAccount({
      name: "Geldbeutel",
      description: "Bargeld",
      balance: 0,
      isActive: true,
      isOfflineBudget: false,
      accountGroupId: defaultGroupId
    });

    accountStore.addAccount({
      name: "Gehaltskonto",
      description: "Girokonto ING",
      iban: "DE89123456780123456789",
      balance: 0,
      isActive: true,
      isOfflineBudget: false,
      accountGroupId: secondGroupId
    });

    accountStore.addAccount({
      name: "Tagesgeldkonto",
      description: "Sparkonto",
      iban: "DE89123456780987654321",
      balance: 0,
      isActive: true,
      isOfflineBudget: false,
      accountGroupId: secondGroupId
    });
  }

  infoLog('system', 'Seed-Daten erfolgreich geladen');
}

export function clearData() {
  localStorage.removeItem("finwise_accounts");
  localStorage.removeItem("finwise_account_groups");
  localStorage.removeItem("finwise_transactions");
  localStorage.removeItem("finwise_categories");
  localStorage.removeItem("finwise_categoryGroups");
  localStorage.removeItem("finwise_recipients");
  localStorage.removeItem("finwise_tags");
  localStorage.removeItem("finwise_planning");
  localStorage.removeItem("finwise_statistics");
  localStorage.removeItem("finwise_theme");
  // History nicht löschen, um die Löschaktion nachvollziehen zu können
  // localStorage.removeItem("finwise_history");

  const stores = [
    useAccountStore(pinia),
    useTransactionStore(pinia),
    useTagStore(pinia),
    useCategoryStore(pinia),
    useRecipientStore(pinia),
    usePlanningStore(pinia),
    useStatisticsStore(pinia),
    useThemeStore(pinia)
  ];

  stores.forEach((store) => {
    if (typeof store.reset === "function") store.reset();
  });

  warnLog('system', 'Alle Daten wurden zurückgesetzt');
}
