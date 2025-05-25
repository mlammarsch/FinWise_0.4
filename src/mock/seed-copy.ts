// Datei: src/mock/seed.ts
import { useAccountStore } from "../stores/accountStore";
import { useTransactionStore } from "../stores/transactionStore";
import { useTagStore } from "../stores/tagStore";
import { useCategoryStore } from "../stores/categoryStore";
import { useRecipientStore } from "../stores/recipientStore";
import { usePlanningStore } from "../stores/planningStore";
import { useStatisticsStore } from "../stores/statisticsStore";
import { useThemeStore } from "../stores/themeStore";
import { createPinia } from "pinia";

import dayjs from "dayjs";
import { TransactionType } from "../types";

const pinia = createPinia();

function randomNote(): string | undefined {
  if (Math.random() > 0.6) return undefined;
  const phrases = [
    "lorem ipsum", "dolor sit amet", "einkauf\nbei rewe", "tanken", "urlaub bezahlt",
    "mittagessen", "amazon bestellung", "neue\nversicherung", "handyrechnung", "reparatur auto",
    "fitness beitrag", "arztbesuch", "geschenk für freund", "bücher", "parkhaus"
  ];
  const note = phrases[Math.floor(Math.random() * phrases.length)];
  return note;
}

export function seedData() {
  const accountStore = useAccountStore(pinia);
  const transactionStore = useTransactionStore(pinia);
  const tagStore = useTagStore(pinia);
  const categoryStore = useCategoryStore(pinia);
  const recipientStore = useRecipientStore(pinia);

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
      balance: 1200,
      isActive: true,
      isOfflineBudget: false,
      accountGroupId: secondGroupId
    });

    accountStore.addAccount({
      name: "Tagesgeldkonto",
      description: "Sparkonto",
      iban: "DE89123456780987654321",
      balance: 3500,
      isActive: true,
      isOfflineBudget: false,
      accountGroupId: secondGroupId
    });
  }

  if (transactionStore.transactions.length === 0) {
    const accounts = accountStore.accounts;
    const categories = categoryStore.categories;
    const tags = tagStore.tags;
    const recipients = recipientStore.recipients;
    const today = dayjs();

    const incomeCategories = categories.filter(c => c.isIncomeCategory);
    const expenseCategories = categories.filter(c => !c.isIncomeCategory);

    accounts.forEach((account) => {
      const numIncome = Math.floor(Math.random() * 3) + 3;

      for (let i = 0; i < numIncome; i++) {
        const date = today.subtract(Math.floor(Math.random() * 90), "day").format("YYYY-MM-DD");
        const amountOptions = [1000, 2000, 3000, 4000, 5000];
        const amount = amountOptions[Math.floor(Math.random() * amountOptions.length)];
        const category = incomeCategories[i % incomeCategories.length];
        const recipient = recipients.find((r) => r.name.includes("Arbeitgeber")) || recipients[0];

        transactionStore.addTransaction({
          date,
          valueDate: date,
          accountId: account.id,
          categoryId: category.id,
          tagIds: [],
          amount,
          note: randomNote(),
          recipientId: recipient.id,
          type: TransactionType.INCOME,
          counterTransactionId: null,
          planningTransactionId: null,
          isReconciliation: false,
          runningBalance: 0,
          payee: recipient.name,
          transferToAccountId: null
        });
      }
    });

    for (let i = 0; i < 120; i++) {
      const date = today.subtract(Math.floor(Math.random() * 120), "day").format("YYYY-MM-DD");
      const account = accounts[Math.floor(Math.random() * accounts.length)];
      const category = expenseCategories[i % expenseCategories.length];
      const recipient = recipients[Math.floor(Math.random() * recipients.length)];

      const amountOptions = [1, 2, 5, 10, 20, 30, 50, 70, 80, 100, 120, 150, 200, 300];
      const rawAmount = amountOptions[Math.floor(Math.random() * amountOptions.length)];
      const amount = -rawAmount;

      const tagCount = Math.floor(Math.random() * 2) + 1;
      const tagIds: string[] = [];
      while (tagIds.length < tagCount) {
        const tag = tags[Math.floor(Math.random() * tags.length)];
        if (!tagIds.includes(tag.id)) tagIds.push(tag.id);
      }

      transactionStore.addTransaction({
        date,
        valueDate: date,
        accountId: account.id,
        categoryId: category.id,
        tagIds,
        amount,
        note: randomNote(),
        recipientId: recipient.id,
        type: TransactionType.EXPENSE,
        counterTransactionId: null,
        planningTransactionId: null,
        isReconciliation: false,
        runningBalance: 0,
        payee: recipient.name,
        transferToAccountId: null
      });
    }
  }
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
}
