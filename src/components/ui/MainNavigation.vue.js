import { ref } from "vue";
import { useRouter } from "vue-router";
import { Icon } from "@iconify/vue";
import { useAccountStore } from "../../stores/accountStore";
import { useCategoryStore } from "../../stores/categoryStore";
import { useRecipientStore } from "../../stores/recipientStore";
import { useTagStore } from "../../stores/tagStore";
import { useTransactionStore } from "../../stores/transactionStore";
import { usePlanningStore } from "../../stores/planningStore";
import { useRuleStore } from "../../stores/ruleStore";
import { useStatisticsStore } from "../../stores/statisticsStore";
import { useThemeStore } from "../../stores/themeStore";
import { useSessionStore } from "../../stores/sessionStore";
const emit = defineEmits(["closeMenu"]);
const router = useRouter();
const routes = [
    { path: "/", name: "Dashboard", icon: "mdi:view-dashboard" },
    { path: "/accounts", name: "Konten", icon: "mdi:bank" },
    { path: "/transactions", name: "Transaktionen", icon: "mdi:swap-horizontal" },
    { path: "/planning", name: "Planung", icon: "mdi:calendar" },
    { path: "/budgets", name: "Budgets", icon: "mdi:wallet-outline" },
    { path: "/statistics", name: "Statistiken", icon: "mdi:chart-bar" },
];
/* --------------------------- Admin-Routen --------------------------- */
const adminRoutes = [
    { path: "/admin/accounts", name: "Konten", icon: "mdi:cash-edit" },
    {
        path: "/admin/categories",
        name: "Kategorien",
        icon: "mdi:category",
    },
    { path: "/admin/tags", name: "Tags", icon: "mdi:tag-edit" },
    {
        path: "/admin/recipients",
        name: "Empfänger",
        icon: "mdi:person-edit",
    },
    {
        path: "/admin/rules",
        name: "Regeln",
        icon: "mdi:lightning-bolt",
    },
    {
        path: "/admin/tenants",
        name: "Mandanten",
        icon: "mdi:office-building-cog",
    }, // <-- neu
    { path: "/admin/muuri-test", name: "Muuri Test", icon: "mdi:grid" },
    { path: "/settings", name: "Einstellungen", icon: "mdi:cog" },
];
const isActive = (path) => {
    return router.currentRoute.value.path === path;
};
const dropdownOpen = ref(false);
let openTimer = null;
let closeTimer = null;
function handleMouseEnter() {
    if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
    }
    if (!dropdownOpen.value && !openTimer) {
        openTimer = setTimeout(() => {
            dropdownOpen.value = true;
            openTimer = null;
        }, 300);
    }
}
function handleMouseLeave() {
    if (openTimer) {
        clearTimeout(openTimer);
        openTimer = null;
    }
    if (dropdownOpen.value && !closeTimer) {
        closeTimer = setTimeout(() => {
            dropdownOpen.value = false;
            closeTimer = null;
        }, 300);
    }
}
function handleItemClick() {
    dropdownOpen.value = false;
    emit("closeMenu");
}
async function clearAndReseedData() {
    if (!confirm("Möchtest Du wirklich alle Daten löschen und neu laden?"))
        return;
    const sessionStore = useSessionStore();
    const stores = [
        useAccountStore(),
        useCategoryStore(),
        useRecipientStore(),
        useTagStore(),
        useTransactionStore(),
        usePlanningStore(),
        useRuleStore(),
        useStatisticsStore(),
        useThemeStore(),
    ];
    stores.forEach((store) => {
        if (typeof store.reset === "function")
            store.reset();
    });
    // Dev-only dynamic import to avoid tsconfig include issues
    try {
        const isDev = import.meta?.env?.DEV === true;
        if (isDev) {
            // Use variable + vite-ignore to avoid static inclusion in TS project graph
            const mockPath = "../../mock/seed_kaputt";
            // @ts-ignore - path is dev-only and excluded from tsconfig
            const mod = await import(/* @vite-ignore */ mockPath);
            if (typeof mod.clearData === "function")
                mod.clearData();
            const userId = sessionStore.currentUser?.id || "demo-user";
            const tenantId = sessionStore.currentTenantId || "demo-tenant";
            if (typeof mod.seedData === "function") {
                await mod.seedData(userId, tenantId);
            }
        }
    }
    catch {
        // ignore in production build if mock not present
    }
    router.push("/");
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
for (const [route] of __VLS_getVForSourceType((__VLS_ctx.routes))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.$emit('closeMenu');
            } },
    });
    const __VLS_0 = {}.RouterLink;
    /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        to: (route.path),
        ...{ class: ({
                active: __VLS_ctx.isActive(route.path),
                'text-primary bg-primary/20': __VLS_ctx.isActive(route.path),
            }) },
        ...{ class: "rounded-box" },
    }));
    const __VLS_2 = __VLS_1({
        to: (route.path),
        ...{ class: ({
                active: __VLS_ctx.isActive(route.path),
                'text-primary bg-primary/20': __VLS_ctx.isActive(route.path),
            }) },
        ...{ class: "rounded-box" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_3.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "flex items-center" },
    });
    const __VLS_4 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
        ...{ class: "mr-2 text-lg" },
        icon: (route.icon),
    }));
    const __VLS_6 = __VLS_5({
        ...{ class: "mr-2 text-lg" },
        icon: (route.icon),
    }, ...__VLS_functionalComponentArgsRest(__VLS_5));
    (route.name);
    var __VLS_3;
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
    ...{ onMouseenter: (__VLS_ctx.handleMouseEnter) },
    ...{ onMouseleave: (__VLS_ctx.handleMouseLeave) },
    ...{ class: "dropdown dropdown-bottom dropdown-end" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
    tabindex: "0",
    ...{ class: "rounded-box cursor-default" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "flex items-center" },
});
const __VLS_8 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    ...{ class: "mr-2 text-lg" },
    icon: "mdi:tools",
}));
const __VLS_10 = __VLS_9({
    ...{ class: "mr-2 text-lg" },
    icon: "mdi:tools",
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
const __VLS_12 = {}.transition;
/** @type {[typeof __VLS_components.Transition, typeof __VLS_components.transition, typeof __VLS_components.Transition, typeof __VLS_components.transition, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    name: "fade",
}));
const __VLS_14 = __VLS_13({
    name: "fade",
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
__VLS_15.slots.default;
if (__VLS_ctx.dropdownOpen) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({
        ...{ class: "dropdown-content menu p-2 bg-base-100 border border-base-300 rounded-box" },
    });
    for (const [route] of __VLS_getVForSourceType((__VLS_ctx.adminRoutes))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
            ...{ onClick: (__VLS_ctx.handleItemClick) },
        });
        const __VLS_16 = {}.RouterLink;
        /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
        // @ts-ignore
        const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
            to: (route.path),
            ...{ class: ({
                    active: __VLS_ctx.isActive(route.path),
                    'text-primary bg-primary/20': __VLS_ctx.isActive(route.path),
                }) },
            ...{ class: "rounded-box" },
        }));
        const __VLS_18 = __VLS_17({
            to: (route.path),
            ...{ class: ({
                    active: __VLS_ctx.isActive(route.path),
                    'text-primary bg-primary/20': __VLS_ctx.isActive(route.path),
                }) },
            ...{ class: "rounded-box" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_17));
        __VLS_19.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "flex items-center w-50" },
        });
        const __VLS_20 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
            ...{ class: "mr-2 text-lg" },
            icon: (route.icon),
        }));
        const __VLS_22 = __VLS_21({
            ...{ class: "mr-2 text-lg" },
            icon: (route.icon),
        }, ...__VLS_functionalComponentArgsRest(__VLS_21));
        (route.name);
        var __VLS_19;
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.clearAndReseedData) },
        ...{ class: "rounded-box" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "flex items-center" },
    });
    const __VLS_24 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
        ...{ class: "mr-2 text-lg" },
        icon: "mdi:database-refresh",
    }));
    const __VLS_26 = __VLS_25({
        ...{ class: "mr-2 text-lg" },
        icon: "mdi:database-refresh",
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
}
var __VLS_15;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-primary/20']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['dropdown']} */ ;
/** @type {__VLS_StyleScopedClasses['dropdown-bottom']} */ ;
/** @type {__VLS_StyleScopedClasses['dropdown-end']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-default']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['dropdown-content']} */ ;
/** @type {__VLS_StyleScopedClasses['menu']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-primary/20']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-50']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Icon: Icon,
            routes: routes,
            adminRoutes: adminRoutes,
            isActive: isActive,
            dropdownOpen: dropdownOpen,
            handleMouseEnter: handleMouseEnter,
            handleMouseLeave: handleMouseLeave,
            handleItemClick: handleItemClick,
            clearAndReseedData: clearAndReseedData,
        };
    },
    emits: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    emits: {},
});
; /* PartiallyEnd: #4569/main.vue */
