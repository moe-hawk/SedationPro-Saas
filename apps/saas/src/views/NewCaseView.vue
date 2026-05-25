<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
onMounted(() => {
  void router.replace('/sedation');
});
</script>

<template>
  <section class="card">
    <h1>Opening Sedation Pro…</h1>
    <p class="muted">New cases are created only inside the cloud-backed Sedation Pro interface.</p>
  </section>
</template>
