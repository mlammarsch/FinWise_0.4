import { useThemeStore } from "../../stores/themeStore";
import { Icon } from "@iconify/vue";
import { onMounted } from "vue";
const themeStore = useThemeStore();
// Initialize the Theme when the Componenet is mounted
onMounted(() => {
    themeStore.initTheme();
});
const toggleTheme = () => {
    themeStore.toggleTheme();
};
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.toggleTheme) },
    ...{ class: "btn btn-ghost btn-circle" },
});
if (__VLS_ctx.themeStore.isDarkMode) {
    const __VLS_0 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        icon: "mdi:weather-sunny",
        ...{ class: "text-xl" },
    }));
    const __VLS_2 = __VLS_1({
        icon: "mdi:weather-sunny",
        ...{ class: "text-xl" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
}
else {
    const __VLS_4 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
        icon: "mdi:weather-night",
        ...{ class: "text-xl" },
    }));
    const __VLS_6 = __VLS_5({
        icon: "mdi:weather-night",
        ...{ class: "text-xl" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_5));
}
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Icon: Icon,
            themeStore: themeStore,
            toggleTheme: toggleTheme,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
