<script setup lang="ts">
import { computed } from "vue";
import { Transaction } from "../../types";
import { useRecipientStore } from "../../stores/recipientStore";
import { formatDate } from "../../utils/formatters";
import CurrencyDisplay from "../ui/CurrencyDisplay.vue";

/**
 * Pfad zur Komponente: components/transaction/TransactionDetailModal.vue
 *
 * Diese Komponente zeigt die Details einer Transaktion in einem Modal an.
 *
 * Komponenten-Props:
 * - transaction: Transaction | null - Die anzuzeigende Transaktion.
 * - isOpen: boolean - Steuert die Sichtbarkeit des Modals.
 *
 * Emits:
 * - close - Wird ausgelöst, wenn das Modal geschlossen wird.
 */
const props = defineProps<{
  transaction: Transaction | null;
  isOpen: boolean;
}>();
const emit = defineEmits(["close"]);

const recipientStore = useRecipientStore();

const recipientName = computed(() =>
  props.transaction?.recipientId
    ? recipientStore.getRecipientById(props.transaction.recipientId)?.name ||
      "Unbekannter Empfänger"
    : "Unbekannter Empfänger"
);
</script>

<template>
  <div v-if="isOpen && transaction" class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">Transaktionsdetails</h3>

      <div>
        <span class="text-sm text-gray-500">Empfänger:</span>
        <div>{{ recipientName }}</div>
      </div>

      <div>
        <span class="text-sm text-gray-500">Buchungsdatum:</span>
        <div>{{ formatDate(transaction.date) }}</div>
      </div>

      <div>
        <span class="text-sm text-gray-500">Betrag:</span>
        <div>
          <CurrencyDisplay :amount="transaction.amount" :show-zero="true" />
        </div>
      </div>

      <button class="btn btn-sm" @click="$emit('close')">Schließen</button>
    </div>
  </div>
</template>
