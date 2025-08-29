import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { Icon } from "@iconify/vue";
import { TenantService } from "@/services/TenantService";
import { useSessionStore } from "@/stores/sessionStore";
import { debugLog } from "@/utils/logger";
const dropdown = ref(false);
const session = useSessionStore();
const router = useRouter();
const tenants = computed(() => TenantService.getOwnTenants());
function toggle() {
    dropdown.value = !dropdown.value;
}
function switchTenant(id) {
    TenantService.switchTenant(id);
    dropdown.value = false;
}
function logoutFromTenant() {
    session.logoutTenant();
    dropdown.value = false;
    debugLog("[TenantSwitch] logoutTenant");
    router.push("/tenant-select");
}
function fullLogout() {
    session.logout();
    dropdown.value = false;
    debugLog("[TenantSwitch] fullLogout");
    router.push("/login");
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "relative" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.toggle) },
    ...{ class: "btn btn-ghost" },
});
const __VLS_0 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    icon: "mdi:office-building",
    ...{ class: "mr-2" },
}));
const __VLS_2 = __VLS_1({
    icon: "mdi:office-building",
    ...{ class: "mr-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.session.currentTenant?.tenantName || "Mandant wählen");
const __VLS_4 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    icon: "mdi:chevron-down",
}));
const __VLS_6 = __VLS_5({
    icon: "mdi:chevron-down",
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
if (__VLS_ctx.dropdown) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({
        ...{ class: "absolute z-40 mt-1 p-2 menu bg-base-100 border border-base-300 rounded-box w-56 shadow-lg" },
    });
    for (const [t] of __VLS_getVForSourceType((__VLS_ctx.tenants))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.dropdown))
                        return;
                    __VLS_ctx.switchTenant(t.uuid);
                } },
            key: (t.uuid),
            ...{ class: "rounded-box" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
            ...{ class: ({ active: t.uuid === __VLS_ctx.session.currentTenantId }) },
        });
        (t.tenantName);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
        ...{ class: "divider my-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
        ...{ onClick: (__VLS_ctx.logoutFromTenant) },
        ...{ class: "rounded-box hover:bg-base-200" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
        ...{ class: "text-base-content" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
        ...{ onClick: (__VLS_ctx.fullLogout) },
        ...{ class: "rounded-box hover:bg-base-200" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
        ...{ class: "text-base-content" },
    });
}
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['z-40']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['menu']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
/** @type {__VLS_StyleScopedClasses['w-56']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['my-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Icon: Icon,
            dropdown: dropdown,
            session: session,
            tenants: tenants,
            toggle: toggle,
            switchTenant: switchTenant,
            logoutFromTenant: logoutFromTenant,
            fullLogout: fullLogout,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
