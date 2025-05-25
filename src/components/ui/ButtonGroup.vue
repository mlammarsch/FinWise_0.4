<script setup>
/**
 * Pfad zur Komponente: ../ui/ButtonGroup
 * Eine flexible Button-Gruppe mit bis zu vier Buttons.
 * Komponenten-Props:
 * - leftLabel: string - Beschriftung des linken Buttons
 * - rightLabel: string - Beschriftung des rechten Buttons
 * - leftColor?: string - Farbklasse für linken Button (z. B. "btn-soft", "btn-secondary")
 * - rightColor?: string - Farbklasse für rechten Button (z. B. "btn-primary", "btn-accent")
 * - middleLeftLabel?: string - Optional: Beschriftung des mittleren linken Buttons
 * - middleLeftColor?: string - Optional: Farbklasse für mittleren linken Button
 * - middleRightLabel?: string - Optional: Beschriftung des mittleren rechten Buttons
 * - middleRightColor?: string - Optional: Farbklasse für mittleren rechten Button
 * - border?: boolean - Optional: Zeigt einen Rahmen um die Buttons (Standard: true)
 *
 * Emits:
 * - "left-click" - Wird ausgelöst, wenn der linke Button geklickt wird
 * - "middle-left-click" - Wird ausgelöst, wenn der mittlere linke Button geklickt wird
 * - "middle-right-click" - Wird ausgelöst, wenn der mittlere rechte Button geklickt wird
 * - "right-click" - Wird ausgelöst, wenn der rechte Button geklickt wird
 */
defineProps({
  leftLabel: { type: String, required: true },
  rightLabel: { type: String, required: true },
  leftColor: { type: String, default: "btn-soft" },
  rightColor: { type: String, default: "btn-primary" },
  middleLeftLabel: { type: String, default: "" },
  middleLeftColor: { type: String, default: "btn-secondary" },
  middleRightLabel: { type: String, default: "" },
  middleRightColor: { type: String, default: "btn-secondary" },
  border: { type: Boolean, default: true },
});

const emit = defineEmits([
  "left-click",
  "middle-left-click",
  "middle-right-click",
  "right-click",
]);
</script>

<template>
  <div class="join flex">
    <button
      type="button"
      class="btn join-item shadow-none rounded-l-full"
      :class="[leftColor, { 'border border-base-300': border }]"
      @click="emit('left-click')"
    >
      {{ leftLabel }}
    </button>

    <button
      v-if="middleLeftLabel"
      type="button"
      class="btn join-item shadow-none"
      :class="[middleLeftColor, { 'border border-base-300': border }]"
      @click="emit('middle-left-click')"
    >
      {{ middleLeftLabel }}
    </button>

    <button
      v-if="middleRightLabel"
      type="button"
      class="btn join-item shadow-none"
      :class="[middleRightColor, { 'border border-base-300': border }]"
      @click="emit('middle-right-click')"
    >
      {{ middleRightLabel }}
    </button>

    <button
      type="button"
      class="btn join-item shadow-none rounded-r-full"
      :class="[rightColor, { 'border border-base-300': border }]"
      @click="emit('right-click')"
    >
      {{ rightLabel }}
    </button>
  </div>
</template>
