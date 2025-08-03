<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue';
import { debugLog, errorLog } from '../../utils/logger';

interface Props {
  modelValue: number;
  isActive: boolean;
  fieldKey?: string;
}

const props = withDefaults(defineProps<Props>(), {
  fieldKey: ''
});

const emit = defineEmits<{
  'update:modelValue': [value: number];
  'finish': [];
  'activate': [];
}>();

const inputRef = ref<HTMLInputElement>();
const editValue = ref<string>('');

// Deutsche Dezimalnotation: Komma zu Punkt für Berechnung
function normalizeDecimal(value: string): string {
  return value.replace(/,/g, '.');
}

// Punkt zu Komma für Anzeige
function formatDecimal(value: string): string {
  return value.replace(/\./g, ',');
}

// Mathematische Ausdrücke berechnen
function evaluateExpression(expression: string): number {
  try {
    // Normalisiere deutsche Dezimalnotation
    const normalizedExpression = normalizeDecimal(expression.trim());

    // Sicherheitsprüfung: nur erlaubte Zeichen
    const allowedChars = /^[0-9+\-*/().,\s]+$/;
    if (!allowedChars.test(normalizedExpression)) {
      throw new Error('Ungültige Zeichen in der Formel');
    }

    // Verwende Function Constructor für sichere Auswertung
    // (sicherer als eval, da kein Zugriff auf globale Variablen)
    const result = new Function('return ' + normalizedExpression)();

    if (typeof result !== 'number' || !isFinite(result)) {
      throw new Error('Ungültiges Berechnungsergebnis');
    }

    return result;
  } catch (error) {
    debugLog('CalculatorInput', `Fehler bei Berechnung von "${expression}":`, error);
    // Bei Fehlern versuche als einfache Zahl zu parsen
    const normalizedValue = normalizeDecimal(expression.trim());
    const simpleNumber = parseFloat(normalizedValue);

    if (!isNaN(simpleNumber)) {
      return simpleNumber;
    }

    // Fallback: ursprünglicher Wert
    return props.modelValue;
  }
}

// Initialisierung beim Mount der Komponente
function initializeEdit() {
  editValue.value = Math.abs(props.modelValue).toString().replace('.', ',');

  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.focus();
      inputRef.value.select();
    }
  });
}

function finishEdit() {
  if (editValue.value.trim()) {
    const calculatedValue = evaluateExpression(editValue.value);
    emit('update:modelValue', calculatedValue);
  }

  editValue.value = '';
  emit('finish');
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault();
    finishEdit();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    editValue.value = '';
    emit('finish');
  }
}

// Outside click handler
function handleOutsideClick(event: Event) {
  if (inputRef.value) {
    const target = event.target as HTMLElement;
    if (!inputRef.value.contains(target)) {
      finishEdit();
    }
  }
}

onMounted(() => {
  document.addEventListener('click', handleOutsideClick);
  // Initialisiere das Edit-Feld beim Mount
  initializeEdit();
});

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick);
});
</script>

<template>
  <!-- Nur Edit-Modus - die CalculatorInput-Komponente zeigt nur das Input-Feld -->
  <input
    ref="inputRef"
    v-model="editValue"
    type="text"
    class="w-full px-1 py-0.5 text-right border border-primary rounded focus:outline-none focus:ring-1 focus:ring-primary text-xs bg-transparent"
    :data-field-key="fieldKey"
    @keydown="handleKeydown"
    @blur="finishEdit"
  />
</template>

<style lang="postcss" scoped>
.calculator-input-wrapper {
  @apply w-full;
}
</style>
