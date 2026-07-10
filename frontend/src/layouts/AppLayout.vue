<script setup>
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { useUiStore } from '../stores/ui.js';
import Icon from '../components/ui/Icon.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const ui = useUiStore();

const menuOpen = ref(false);

const nav = [
  { name: 'dashboard', label: 'Dashboard', icon: 'dashboard', to: '/' },
  { name: 'expenses', label: 'Expenses', icon: 'wallet', to: '/expenses' },
  { name: 'income', label: 'Income', icon: 'trending-up', to: '/income' },
  { name: 'budgets', label: 'Budgets', icon: 'target', to: '/budgets' },
  { name: 'categories', label: 'Categories', icon: 'tag', to: '/categories' },
  { name: 'analytics', label: 'Analytics', icon: 'chart', to: '/analytics' },
];

const pageTitle = computed(() => route.meta.title ?? '');

async function logout() {
  await auth.logout();
  ui.toast('Signed out');
  router.push('/login');
}
</script>

<template>
  <div class="min-h-screen">
    <!-- Mobile sidebar backdrop -->
    <Transition name="modal">
      <div
        v-if="ui.sidebarOpen"
        class="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
        @click="ui.sidebarOpen = false"
      />
    </Transition>

    <!-- Sidebar -->
    <aside
      class="fixed inset-y-0 left-0 z-40 w-60 transform border-r border-slate-200 bg-white transition-transform duration-200 dark:border-slate-800 dark:bg-slate-900 lg:translate-x-0"
      :class="ui.sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="flex h-16 items-center gap-2.5 border-b border-slate-200 px-5 dark:border-slate-800">
        <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 font-mono text-sm font-semibold text-white">
          L
        </div>
        <span class="text-lg font-bold tracking-tight">Ledgerly</span>
        <button
          class="ml-auto rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
          aria-label="Close menu"
          @click="ui.sidebarOpen = false"
        >
          <Icon name="x" :size="18" />
        </button>
      </div>

      <nav class="space-y-1 p-3">
        <RouterLink
          v-for="item in nav"
          :key="item.name"
          :to="item.to"
          class="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors"
          :class="
            route.name === item.name
              ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
          "
          @click="ui.sidebarOpen = false"
        >
          <Icon :name="item.icon" :size="18" />
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="absolute inset-x-0 bottom-0 border-t border-slate-200 p-3 dark:border-slate-800">
        <RouterLink
          to="/profile"
          class="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          @click="ui.sidebarOpen = false"
        >
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-300"
          >
            {{ auth.initials || '?' }}
          </span>
          <span class="min-w-0">
            <span class="block truncate text-sm font-semibold">{{ auth.user?.name }}</span>
            <span class="block truncate text-xs text-slate-500">{{ auth.user?.email }}</span>
          </span>
        </RouterLink>
      </div>
    </aside>

    <!-- Main column -->
    <div class="lg:pl-60">
      <!-- Topbar -->
      <header
        class="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 sm:px-6"
      >
        <button
          class="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
          aria-label="Open menu"
          @click="ui.sidebarOpen = true"
        >
          <Icon name="menu" :size="20" />
        </button>

        <h1 class="text-lg font-bold tracking-tight">{{ pageTitle }}</h1>

        <div class="ml-auto flex items-center gap-1.5">
          <button
            class="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            :aria-label="ui.dark ? 'Switch to light mode' : 'Switch to dark mode'"
            @click="ui.toggleDark()"
          >
            <Icon :name="ui.dark ? 'sun' : 'moon'" :size="19" />
          </button>
          <button
            class="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Sign out"
            title="Sign out"
            @click="logout"
          >
            <Icon name="log-out" :size="19" />
          </button>
        </div>
      </header>

      <main class="mx-auto max-w-7xl p-4 sm:p-6">
        <RouterView v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </main>
    </div>
  </div>
</template>
