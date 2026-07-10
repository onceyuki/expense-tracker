<script setup>
import { ref, reactive, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { useUiStore } from '../stores/ui.js';
import { apiErrorMessage } from '../services/api.js';
import AuthLayout from '../layouts/AuthLayout.vue';
import BaseInput from '../components/ui/BaseInput.vue';
import BaseButton from '../components/ui/BaseButton.vue';

const router = useRouter();
const auth = useAuthStore();
const ui = useUiStore();

const form = reactive({ name: '', email: '', password: '', confirm: '' });
const touched = reactive({ name: false, email: false, password: false, confirm: false });
const loading = ref(false);

const nameError = computed(() =>
  touched.name && form.name.trim().length === 0 ? 'Enter your name' : '',
);
const emailError = computed(() =>
  touched.email && !/^\S+@\S+\.\S+$/.test(form.email) ? 'Enter a valid email address' : '',
);
const passwordError = computed(() =>
  touched.password && form.password.length < 8 ? 'Use at least 8 characters' : '',
);
const confirmError = computed(() =>
  touched.confirm && form.confirm !== form.password ? 'Passwords do not match' : '',
);

async function submit() {
  Object.keys(touched).forEach((k) => (touched[k] = true));
  if (nameError.value || emailError.value || passwordError.value || confirmError.value) return;

  loading.value = true;
  try {
    await auth.register({ name: form.name.trim(), email: form.email, password: form.password });
    ui.toast('Account created — welcome to Ledgerly');
    router.push('/');
  } catch (error) {
    ui.toast(apiErrorMessage(error, 'Registration failed'), 'error');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthLayout title="Create your account" subtitle="Track spending, budgets and savings in one place">
    <form class="space-y-4" novalidate @submit.prevent="submit">
      <BaseInput
        v-model="form.name"
        label="Name"
        placeholder="Ada Lovelace"
        autocomplete="name"
        :error="nameError"
        required
        @blur="touched.name = true"
      />
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
        placeholder="At least 8 characters"
        autocomplete="new-password"
        :error="passwordError"
        required
        @blur="touched.password = true"
      />
      <BaseInput
        v-model="form.confirm"
        label="Confirm password"
        type="password"
        placeholder="Repeat your password"
        autocomplete="new-password"
        :error="confirmError"
        required
        @blur="touched.confirm = true"
      />

      <BaseButton type="submit" :loading="loading" class="w-full" size="lg">
        Create account
      </BaseButton>
    </form>

    <template #footer>
      Already have an account?
      <RouterLink to="/login" class="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">
        Sign in
      </RouterLink>
    </template>
  </AuthLayout>
</template>
