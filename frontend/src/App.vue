<script setup>
import ToastHost from './components/ui/ToastHost.vue';
import ConfirmDialog from './components/ui/ConfirmDialog.vue';
</script>

<template>
  <RouterView v-slot="{ Component }">
    <Transition name="page" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>
  <ToastHost />
  <ConfirmDialog />
</template>
