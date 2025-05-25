import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import { SessionService } from '@/services/SessionService';

/* ----------------------------- Main Views ----------------------------- */
import DashboardView      from '@/views/DashboardView.vue';
import AccountsView       from '@/views/AccountsView.vue';
import TransactionsView   from '@/views/TransactionsView.vue';
import BudgetsView        from '@/views/BudgetsView.vue';
import BudgetsView2       from '@/views/BudgetsView2.vue';
import StatisticsView     from '@/views/StatisticsView.vue';
import PlanningView       from '@/views/PlanningView.vue';
import SettingsView       from '@/views/SettingsView.vue';

/* ----------------------------- Auth Views ----------------------------- */
import LoginView          from '@/views/auth/LoginView.vue';
import RegisterView       from '@/views/auth/RegisterView.vue';
import TenantSelectView   from '@/views/auth/TenantSelectView.vue';

/* ----------------------------- Admin Views ---------------------------- */
import AdminAccountsView     from '@/views/admin/AdminAccountsView.vue';
import AdminCategoriesView   from '@/views/admin/AdminCategoriesView.vue';
import AdminTagsView         from '@/views/admin/AdminTagsView.vue';
import AdminPlanningView     from '@/views/admin/AdminPlanningView.vue';
import AdminRecipientsView   from '@/views/admin/AdminRecipientsView.vue';
import AdminRulesView        from '@/views/admin/AdminRulesView.vue';
import AdminTenantsView      from '@/views/admin/AdminTenantsView.vue'; // neu

const routes: RouteRecordRaw[] = [
  /* ---------- Auth ---------- */
  { path: '/login',         name: 'login',         component: LoginView,       meta: { title: 'Login',            hideNav: true } },
  { path: '/register',      name: 'register',      component: RegisterView,    meta: { title: 'Registrieren',     hideNav: true } },
  { path: '/tenant-select', name: 'tenant-select', component: TenantSelectView,meta: { title: 'Tenant wählen',     hideNav: true } },

  /* ---------- Default ---------- */
  { path: '/',             name: 'dashboard',    component: DashboardView,   meta: { title: 'Dashboard',    breadcrumb: 'Dashboard' } },
  { path: '/accounts',     name: 'accounts',     component: AccountsView,    meta: { title: 'Konten',       breadcrumb: 'Konten' } },
  { path: '/transactions', name: 'transactions', component: TransactionsView,meta: { title: 'Transaktionen',breadcrumb: 'Transaktionen' } },
  { path: '/budgets',      name: 'budgets',      component: BudgetsView,     meta: { title: 'Budgets',      breadcrumb: 'Budgets' } },
  { path: '/statistics',   name: 'statistics',   component: BudgetsView2,    meta: { title: 'Statistiken',  breadcrumb: 'Statistiken' } },
  { path: '/planning',     name: 'planning',     component: PlanningView,    meta: { title: 'Planung',      breadcrumb: 'Planung' } },
  { path: '/settings',     name: 'settings',     component: SettingsView,    meta: { title: 'Einstellungen',breadcrumb: 'Einstellungen' } },

  /* ---------- Admin ---------- */
  { path: '/admin/accounts',    name: 'admin-accounts',   component: AdminAccountsView,   meta: { title: 'Konten verwalten' } },
  { path: '/admin/categories',  name: 'admin-categories', component: AdminCategoriesView, meta: { title: 'Kategorien verwalten' } },
  { path: '/admin/tags',        name: 'admin-tags',       component: AdminTagsView,       meta: { title: 'Tags verwalten' } },
  { path: '/admin/planning',    name: 'admin-planning',   component: AdminPlanningView,   meta: { title: 'Planungen verwalten' } },
  { path: '/admin/recipients',  name: 'admin-recipients', component: AdminRecipientsView, meta: { title: 'Empfänger verwalten' } },
  { path: '/admin/rules',       name: 'admin-rules',      component: AdminRulesView,      meta: { title: 'Regeln verwalten' } },
  { path: '/admin/tenants',     name: 'admin-tenants',    component: AdminTenantsView,    meta: { title: 'Mandanten verwalten' } },

  /* ---------- Fallback ---------- */
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
