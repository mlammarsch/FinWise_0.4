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
    :class="{
      'badge-primary': colorIntensity === 'primary',
      'badge-secondary': colorIntensity === 'secondary',
      'badge-accent': colorIntensity === 'accent',
      'badge-info': colorIntensity === 'info',
      'badge-success': colorIntensity === 'success',
      'badge-warning': colorIntensity === 'warning',
      'badge-error': colorIntensity === 'error',
      'badge-neutral': colorIntensity === 'neutral',
    }"
  >
    {{ label }}
  </div>
</template>
