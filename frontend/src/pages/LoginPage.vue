<script setup>
import { ref, reactive, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { useUiStore } from '../stores/ui.js';
import { api, apiErrorMessage } from '../services/api.js';
import AuthLayout from '../layouts/AuthLayout.vue';
import BaseInput from '../components/ui/BaseInput.vue';
import BaseButton from '../components/ui/BaseButton.vue';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const ui = useUiStore();

const form = reactive({ email: '', password: '', remember: true });
const touched = reactive({ email: false, password: false });
const loading = ref(false);
const forgotOpen = ref(false);
const forgotEmail = ref('');
const forgotLoading = ref(false);

const emailError = computed(() =>
  touched.email && !/^\S+@\S+\.\S+$/.test(form.email) ? 'Enter a valid email address' : '',
);
const passwordError = computed(() =>
  touched.password && form.password.length === 0 ? 'Enter your password' : '',
);

async function submit() {
  touched.email = true;
  touched.password = true;
  if (emailError.value || passwordError.value) return;

  loading.value = true;
  try {
    await auth.login(form);
    ui.toast(`Welcome back, ${auth.user.name.split(' ')[0]}`);
    router.push(route.query.redirect ?? '/');
  } catch (error) {
    ui.toast(apiErrorMessage(error, 'Sign in failed'), 'error');
  } finally {
    loading.value = false;
  }
}

async function sendReset() {
  forgotLoading.value = true;
  try {
    const { data } = await api.post('/auth/forgot-password', { email: forgotEmail.value });
    ui.toast(data.message, 'info', 6000);
    forgotOpen.value = false;
  } catch (error) {
    ui.toast(apiErrorMessage(error), 'error');
  } finally {
    forgotLoading.value = false;
  }
}
</script>

<template>
  <AuthLayout title="Welcome back" subtitle="Sign in to your Why Am I Like This (Financially) account">
    <form class="space-y-4" novalidate @submit.prevent="submit">
      <BaseInput
        v-model="form.email"
        label="Email"
        type="email"
        placeholder="you@example.com"
        autocomplete="email"
        :error="emailError"
        required
        @blur="touched.email = true"
      />
      <BaseInput
        v-model="form.password"
        label="Password"
        type="password"
        placeholder="••••••••"
        autocomplete="current-password"
        :error="passwordError"
        required
        @blur="touched.password = true"
      />

      <div class="flex items-center justify-between text-sm">
        <label class="flex cursor-pointer items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
          <input
            v-model="form.remember"
            type="checkbox"
            class="h-4 w-4 rounded border-slate-300 accent-brand-600"
          />
          Remember me
        </label>
        <button
          type="button"
          class="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
          @click="forgotOpen = !forgotOpen; forgotEmail = form.email"
        >
          Forgot password?
        </button>
      </div>

      <div v-if="forgotOpen" class="space-y-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
        <BaseInput v-model="forgotEmail" label="Account email" type="email" placeholder="you@example.com" />
        <BaseButton variant="secondary" size="sm" :loading="forgotLoading" @click="sendReset">
          Send reset link
        </BaseButton>
      </div>

      <BaseButton type="submit" :loading="loading" class="w-full" size="lg">Sign in</BaseButton>
    </form>

    <template #footer>
      New to Why Am I Like This (Financially)?
      <RouterLink to="/register" class="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">
        Create an account
      </RouterLink>
    </template>
  </AuthLayout>
</template>
