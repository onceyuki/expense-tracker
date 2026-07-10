<script setup>
import { reactive, ref, computed } from 'vue';
import { useAuthStore } from '../stores/auth.js';
import { useUiStore } from '../stores/ui.js';
import { apiErrorMessage } from '../services/api.js';
import { formatDate } from '../utils/format.js';
import BaseCard from '../components/ui/BaseCard.vue';
import BaseInput from '../components/ui/BaseInput.vue';
import BaseButton from '../components/ui/BaseButton.vue';

const auth = useAuthStore();
const ui = useUiStore();

const profile = reactive({
  name: auth.user?.name ?? '',
  email: auth.user?.email ?? '',
  avatar: auth.user?.avatar ?? '',
});
const savingProfile = ref(false);

const passwords = reactive({ current: '', next: '', confirm: '' });
const savingPassword = ref(false);

const passwordError = computed(() =>
  passwords.next && passwords.next.length < 8 ? 'Use at least 8 characters' : '',
);
const confirmError = computed(() =>
  passwords.confirm && passwords.confirm !== passwords.next ? 'Passwords do not match' : '',
);

async function saveProfile() {
  if (!profile.name.trim() || !/^\S+@\S+\.\S+$/.test(profile.email)) {
    ui.toast('Enter a name and a valid email', 'error');
    return;
  }
  savingProfile.value = true;
  try {
    await auth.updateProfile({
      name: profile.name.trim(),
      email: profile.email,
      avatar: profile.avatar.trim() || null,
    });
    ui.toast('Profile updated');
  } catch (error) {
    ui.toast(apiErrorMessage(error, 'Could not update profile'), 'error');
  } finally {
    savingProfile.value = false;
  }
}

async function savePassword() {
  if (!passwords.current || passwordError.value || confirmError.value || !passwords.next) {
    ui.toast('Check the password fields', 'error');
    return;
  }
  savingPassword.value = true;
  try {
    await auth.updateProfile({ currentPassword: passwords.current, newPassword: passwords.next });
    ui.toast('Password changed');
    passwords.current = '';
    passwords.next = '';
    passwords.confirm = '';
  } catch (error) {
    ui.toast(apiErrorMessage(error, 'Could not change password'), 'error');
  } finally {
    savingPassword.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-4">
    <BaseCard title="Profile">
      <div class="mb-5 flex items-center gap-4">
        <img
          v-if="profile.avatar"
          :src="profile.avatar"
          alt="Avatar"
          class="h-16 w-16 rounded-full border border-slate-200 object-cover dark:border-slate-700"
        />
        <span
          v-else
          class="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-300"
        >
          {{ auth.initials || '?' }}
        </span>
        <div>
          <p class="font-bold">{{ auth.user?.name }}</p>
          <p class="text-sm text-slate-500">Member since {{ formatDate(auth.user?.createdAt) }}</p>
        </div>
      </div>

      <form class="space-y-4" @submit.prevent="saveProfile">
        <BaseInput v-model="profile.name" label="Name" required />
        <BaseInput v-model="profile.email" label="Email" type="email" required />
        <BaseInput v-model="profile.avatar" label="Avatar URL" placeholder="https://…" />
        <div class="flex justify-end">
          <BaseButton type="submit" :loading="savingProfile">Save changes</BaseButton>
        </div>
      </form>
    </BaseCard>

    <BaseCard title="Change password">
      <form class="space-y-4" @submit.prevent="savePassword">
        <BaseInput v-model="passwords.current" label="Current password" type="password" autocomplete="current-password" required />
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <BaseInput v-model="passwords.next" label="New password" type="password" autocomplete="new-password" :error="passwordError" required />
          <BaseInput v-model="passwords.confirm" label="Confirm new password" type="password" autocomplete="new-password" :error="confirmError" required />
        </div>
        <div class="flex justify-end">
          <BaseButton type="submit" :loading="savingPassword">Change password</BaseButton>
        </div>
      </form>
    </BaseCard>
  </div>
</template>
