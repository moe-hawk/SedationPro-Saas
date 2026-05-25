<script setup lang="ts">
import { computed } from 'vue';

import { useTheme, type ThemeChoice } from '@/composables/useTheme';

const { choice, resolved } = useTheme();

const meta: Record<ThemeChoice, { label: string; icon: string; next: ThemeChoice }> = {
  auto: { label: 'Theme · Auto', icon: '◐', next: 'light' },
  light: { label: 'Theme · Light', icon: '☀', next: 'dark' },
  dark: { label: 'Theme · Dark', icon: '☾', next: 'auto' },
};

const label = computed(() => meta[choice.value].label);
const icon = computed(() => meta[choice.value].icon);
const title = computed(() => `${label.value}; resolved ${resolved()}. Click to cycle.`);

function cycleTheme(): void {
  choice.value = meta[choice.value].next;
}
</script>

<template>
  <button class="theme-mode-button" type="button" :title="title" :aria-label="title" @click="cycleTheme">
    <span class="theme-mode-button__icon" aria-hidden="true">{{ icon }}</span>
    <span>{{ label }}</span>
  </button>
</template>
