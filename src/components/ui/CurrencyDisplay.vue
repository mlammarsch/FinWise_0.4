<script setup lang="ts">
import { computed, withDefaults } from "vue";
import { formatCurrency, getAmountClass } from "../../utils/formatters";

/**
 * Farbliche Anzeige der Währung mit verschiedenen Optionen.
 * Pfad: src/components/ui/CurrencyDisplay.vue
 *
 * Komponenten-Props:
 * - amount: number - Die anzuzeigende Zahl (Betrag)
 * - showSign?: boolean - Währungszeichen (€) anzeigen oder nicht (Default: true)
 * - showZero?: boolean - 0-Werte anzeigen oder nicht (Default: true)
 * - asInteger?: boolean - Betrag als Ganzzahl ausgeben (Default: false)
 *
 * Emits:
 * - Keine Emits vorhanden
 */

const props = withDefaults(
  defineProps<{
    amount: number;
    showSign?: boolean;
    showZero?: boolean;
    asInteger?: boolean;
  }>(),
  {
    showSign: true,
    showZero: true,
    asInteger: false,
  }
);

// Berechnet den formatierten Betrag mit optionaler Ganzzahldarstellung
const formattedAmount = computed(() => {
  let value = props.asInteger ? Math.round(props.amount) : props.amount;
  let formatted = formatCurrency(value);

  // Entfernt ",00" nur, wenn `asInteger` aktiv ist, behält aber das Währungssymbol
  if (props.asInteger) {
    formatted = formatted.replace(/,00(?=\s*€)/, "");
  }

  // Entfernt das Währungszeichen nur, wenn `showSign` false ist
  return props.showSign ? formatted : formatted.replace(/\s*€$/, "");
});

// Bestimmt die CSS-Klasse für die Anzeige des Betrags
const amountClass = computed(() => getAmountClass(props.amount));

// Legt fest, ob der Betrag angezeigt wird
const showAmount = computed(() => props.amount !== 0 || props.showZero);
</script>

<template>
  <span v-if="showAmount" :class="amountClass">
    {{ formattedAmount }}
  </span>
  <span v-else class="text-neutral">-</span>
</template>
