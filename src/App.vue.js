import { onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import AppLayout from "./layouts/AppLayout.vue";
import { useThemeStore } from "./stores/themeStore";
import { useSessionStore } from "./stores/sessionStore";
const themeStore = useThemeStore();
const router = useRouter();
const route = useRoute();
const session = useSessionStore();
// Initialize the application and load saved data
onMounted(() => {
    // Load the stored theme settings
    themeStore.initTheme();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {[typeof AppLayout, typeof AppLayout, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(AppLayout, new AppLayout({}));
const __VLS_1 = __VLS_0({}, ...__VLS_functionalComponentArgsRest(__VLS_0));
var __VLS_3 = {};
__VLS_2.slots.default;
const __VLS_4 = {}.Suspense;
/** @type {[typeof __VLS_components.Suspense, typeof __VLS_components.Suspense, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({}));
const __VLS_6 = __VLS_5({}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_7.slots.default;
{
    const { default: __VLS_thisSlot } = __VLS_7.slots;
    const __VLS_8 = {}.RouterView;
    /** @type {[typeof __VLS_components.RouterView, typeof __VLS_components.routerView, typeof __VLS_components.RouterView, typeof __VLS_components.routerView, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({}));
    const __VLS_10 = __VLS_9({}, ...__VLS_functionalComponentArgsRest(__VLS_9));
    {
        const { default: __VLS_thisSlot } = __VLS_11.slots;
        const [{ Component }] = __VLS_getSlotParams(__VLS_thisSlot);
        if (Component) {
            const __VLS_12 = ((Component));
            // @ts-ignore
            const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
                key: (`${String(__VLS_ctx.route.name ?? '')}-${__VLS_ctx.session.currentTenantId}`),
            }));
            const __VLS_14 = __VLS_13({
                key: (`${String(__VLS_ctx.route.name ?? '')}-${__VLS_ctx.session.currentTenantId}`),
            }, ...__VLS_functionalComponentArgsRest(__VLS_13));
        }
        __VLS_11.slots['' /* empty slot name completion */];
    }
    var __VLS_11;
}
{
    const { fallback: __VLS_thisSlot } = __VLS_7.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "p-4 text-center" },
    });
}
var __VLS_7;
var __VLS_2;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            AppLayout: AppLayout,
            route: route,
            session: session,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
