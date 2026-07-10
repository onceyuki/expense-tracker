import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../pages/LoginPage.vue'),
    meta: { guest: true, title: 'Sign in' },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('../pages/RegisterPage.vue'),
    meta: { guest: true, title: 'Create account' },
  },
  {
    path: '/',
    component: () => import('../layouts/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'dashboard', component: () => import('../pages/DashboardPage.vue'), meta: { title: 'Dashboard' } },
      { path: 'expenses', name: 'expenses', component: () => import('../pages/ExpensesPage.vue'), meta: { title: 'Expenses' } },
      { path: 'income', name: 'income', component: () => import('../pages/IncomePage.vue'), meta: { title: 'Income' } },
      { path: 'budgets', name: 'budgets', component: () => import('../pages/BudgetsPage.vue'), meta: { title: 'Budgets' } },
      { path: 'categories', name: 'categories', component: () => import('../pages/CategoriesPage.vue'), meta: { title: 'Categories' } },
      { path: 'analytics', name: 'analytics', component: () => import('../pages/AnalyticsPage.vue'), meta: { title: 'Analytics' } },
      { path: 'profile', name: 'profile', component: () => import('../pages/ProfilePage.vue'), meta: { title: 'Profile' } },
    ],
  },
  { path: '/500', name: 'server-error', component: () => import('../pages/ServerErrorPage.vue'), meta: { title: 'Server error' } },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../pages/NotFoundPage.vue'), meta: { title: 'Not found' } },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (auth.hasToken && !auth.user) {
    await auth.fetchMe();
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.meta.guest && auth.isAuthenticated) {
    return { name: 'dashboard' };
  }
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Ledgerly` : 'Ledgerly';
});
