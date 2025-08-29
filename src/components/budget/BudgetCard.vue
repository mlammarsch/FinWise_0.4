<!-- src/components/budget/BudgetCard.vue -->
<script setup lang="ts">
import { computed } from "vue";
import { Category } from "../../types";
import { formatCurrency } from "../../utils/formatters";
import CurrencyDisplay from "../ui/CurrencyDisplay.vue";
import { Icon } from "@iconify/vue";

const props = defineProps<{
  category: Category;
  targetAmount?: number;
  currentAmount?: number;
}>();

const emit = defineEmits(["edit", "transfer"]);

const target = computed<number>(() => {
  const t = props.targetAmount ?? (props.category as any)?.targetAmount;
  return typeof t === "number" && !isNaN(t) ? t : 0;
});

const current = computed<number>(() => {
  const c = props.currentAmount ?? (props.category as any)?.balance;
  return typeof c === "number" && !isNaN(c) ? c : 0;
});

const progress = computed<number>(() => {
  if (!target.value || target.value <= 0) return 0;
  return Math.min(100, (current.value / target.value) * 100);
});

const formattedProgress = computed(() => {
  return `${Math.round(progress.value)}%`;
});

const progressColor = computed(() => {
  if (progress.value >= 100) return "progress-success";
  if (progress.value >= 70) return "progress-primary";
  if (progress.value >= 30) return "progress-info";
  if (progress.value > 0) return "progress-warning";
  return "progress-error";
});

const remaining = computed<number>(() => {
  return Math.max(0, (target.value || 0) - (current.value || 0));
});
</script>

<template>
  <div class="card bg-base-100 shadow-md hover:shadow-lg transition-shadow">
    <div class="card-body p-4">
      <div class="flex justify-between items-center">
        <h3 class="card-title text-lg">
          {{ category.name }}
          <div
            v-if="!category.isActive"
            class="badge badge-sm badge-neutral ml-2"
          >
            Inaktiv
          </div>
          <div
            v-if="category.isSavingsGoal"
            class="badge badge-sm badge-accent ml-2"
          >
            Sparziel
          </div>
        </h3>

        <div class="dropdown dropdown-end">
          <label
            tabindex="0"
            class="btn btn-ghost btn-sm btn-circle"
          >
            <Icon icon="mdi:dots-vertical" />
          </label>
          <ul
            tabindex="0"
            class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52"
          >
            <li><a @click="emit('transfer')">Übertragen</a></li>
            <li><a @click="emit('edit')">Bearbeiten</a></li>
          </ul>
        </div>
      </div>

      <div class="mt-2">
        <p
          v-if="(category as any)?.description"
          class="text-sm text-base-content/70 mb-2"
        >
          {{ (category as any)?.description }}
        </p>

        <div class="flex justify-between items-center mt-4">
          <span class="text-sm font-medium">Aktuell:</span>
          <span>
            <CurrencyDisplay
              :amount="current"
              :show-zero="true"
              :asInteger="true"
            />
          </span>
        </div>

        <div
          v-if="target > 0"
          class="flex justify-between items-center mt-1"
        >
          <span class="text-sm font-medium">Ziel:</span>
          <span>
            <CurrencyDisplay
              :amount="target"
              :show-zero="true"
              :asInteger="true"
            />
          </span>
        </div>

        <div
          v-if="target > 0"
          class="flex justify-between items-center mt-1"
        >
          <span class="text-sm font-medium">Verbleibend:</span>
          <span>
            <CurrencyDisplay
              :amount="remaining"
              :show-zero="true"
              :asInteger="true"
            />
          </span>
        </div>

        <div
          v-if="target > 0"
          class="mt-3"
        >
          <div class="flex justify-between items-center mb-1">
            <span class="text-xs">Fortschritt</span>
            <span class="text-xs">{{ formattedProgress }}</span>
          </div>
          <progress
            class="progress w-full"
            :class="progressColor"
            :value="progress"
            max="100"
          ></progress>
        </div>
      </div>
    </div>
  </div>
</template>
