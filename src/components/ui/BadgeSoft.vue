<script setup>
defineProps({
  /**
   * Labeltext für das Badge (z. B. „info“, „error“)
   */
  label: { type: String, required: true },

  /**
   * Farbwert aus DaisyUI-Farbskala (z. B. "primary", "success", "error", etc.)
   */
  colorIntensity: {
    type: String,
    default: "primary",
  },
});
</script>

<template>
  <!-- Farbbadge mit DaisyUI-Farbklasse -->
  <div
    class="badge badge-soft badge-sm rounded-full"
    :class="`badge-${colorIntensity}`"
  >
    {{ label }}
  </div>
</template>
