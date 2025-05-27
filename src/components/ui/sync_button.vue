<script setup lang="ts">
import { Icon } from "@iconify/vue";

function handleSyncButtonClick() {
  console.log("Sync button clicked");
  // Später: Hier die eigentliche Sync-Logik aufrufen
  // z.B. syncService.manualSync();
  // Später: Hier Logik für Zustandsänderungen (Icon, Farbe, Animation) einfügen
}
</script>

<template>
  <button
    class="btn btn-ghost btn-circle"
    @click="handleSyncButtonClick"
    title="Manuelle Synchronisation"
  >
    <!--
      Platzhalter für Zustandslogik:
      Icon und Farbe ändern sich basierend auf Sync-Status.
      - Standard (Backend online, Queue leer): Icon 'mdi:autorenew', Farbe 'text-success', keine Animation.
      - Sync Queue hat Informationen: Icon 'mdi:autorenew-off', Farbe z.B. 'text-warning'.
      - Sync aktiv: Icon 'mdi:autorenew', Farbe z.B. 'text-info', Dreh-Animation.
      - Backend offline: Icon z.B. 'mdi:cloud-off-outline', Farbe 'text-error'.
    -->
    <Icon
      icon="mdi:autorenew"
      class="text-success"
      style="font-size: 21px; width: 21px; height: 21px"
    />
  </button>
</template>

<style scoped>
/* Falls spezifische Styles für den Button benötigt werden, können sie hier hinzugefügt werden. */
</style>
