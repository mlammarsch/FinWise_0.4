<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue';
import { debugLog } from '../../utils/logger';

interface Props {
  modelValue: string;
  isActive: boolean;
  fieldKey?: string;
  placeholder?: string;
}

const props = withDefaults(defineProps<Props>(), {
  fieldKey: '',
  placeholder: ''
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'finish': [];
  'activate': [];
}>();

const inputRef = ref<HTMLInputElement>();
const editValue = ref<string>('');

// Initialisierung beim Mount der Komponente
function initializeEdit() {
  editValue.value = props.modelValue || '';

  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.focus();
      inputRef.value.select();
    }
  });
}

function finishEdit() {
  // Trimme Whitespace und emittiere den neuen Wert
  const trimmedValue = editValue.value.trim();
  emit('update:modelValue', trimmedValue);

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
  <!-- Text-Input-Feld - optimiert für Texteingaben -->
  <input
    ref="inputRef"
    v-model="editValue"
    type="text"
    class="w-full px-2 py-1 text-left border border-primary rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm bg-transparent"
    :placeholder="placeholder"
    :data-field-key="fieldKey"
    @keydown="handleKeydown"
    @blur="finishEdit"
  />
</template>

<style lang="postcss" scoped>
.text-input-wrapper {
  @apply w-full;
}
</style>
