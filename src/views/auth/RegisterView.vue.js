import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "../../stores/userStore";
import { debugLog, errorLog } from "../../utils/logger";
const router = useRouter();
const userStore = useUserStore();
const username = ref("");
const email = ref("");
const password = ref("");
const passwordRepeat = ref("");
const errorMsg = ref("");
const successMsg = ref("");
const usernameField = ref(null);
const emailField = ref(null);
const passwordField = ref(null);
const passwordRepeatField = ref(null);
const registerButton = ref(null);
onMounted(() => {
    usernameField.value?.focus();
});
async function onSubmit() {
    errorMsg.value = "";
    successMsg.value = "";
    if (!username.value.trim() ||
        !email.value.trim() ||
        !password.value.trim() ||
        !passwordRepeat.value.trim()) {
        errorMsg.value = "Bitte alle Felder ausfüllen.";
        return;
    }
    if (!email.value.includes("@")) {
        errorMsg.value = "Bitte geben Sie eine gültige E-Mail-Adresse ein.";
        return;
    }
    if (password.value !== passwordRepeat.value) {
        errorMsg.value = "Passwörter stimmen nicht überein.";
        return;
    }
    try {
        const newUser = await userStore.registerUser(username.value, email.value, password.value);
        if (newUser) {
            debugLog("[RegisterView] user created", JSON.stringify({ id: newUser.id }));
            successMsg.value = `Benutzer ${username.value} wurde erfolgreich angelegt. Du kannst dich jetzt einloggen.`;
            setTimeout(() => {
                router.push("/login");
            }, 3000);
        }
        else {
            // This case might not be reachable if registerUser throws an error for existing user
            errorMsg.value =
                "Benutzername bereits vergeben oder ein anderer Fehler ist aufgetreten.";
            errorLog("[RegisterView] registration failed, no newUser object returned", JSON.stringify({ user: username.value }));
        }
    }
    catch (err) {
        errorMsg.value =
            err.message || "Ein Fehler ist bei der Registrierung aufgetreten.";
        errorLog("[RegisterView] registration error caught", JSON.stringify({
            user: username.value,
            error: err,
        }));
    }
}
function focusNext(field) {
    switch (field) {
        case "email":
            emailField.value?.focus();
            break;
        case "password":
            passwordField.value?.focus();
            break;
        case "passwordRepeat":
            passwordRepeatField.value?.focus();
            break;
        case "registerButton":
            registerButton.value?.focus();
            break;
    }
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center justify-center min-h-screen" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card w-full max-w-md bg-base-100 border border-base-300 shadow" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card-body space-y-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
    ...{ class: "text-xl font-bold text-center" },
});
if (__VLS_ctx.errorMsg) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        role: "alert",
        ...{ class: "alert alert-error alert-soft" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.errorMsg);
}
if (__VLS_ctx.successMsg) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        role: "alert",
        ...{ class: "alert alert-info alert-soft" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.successMsg);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onKeydown: (...[$event]) => {
            __VLS_ctx.focusNext('email');
        } },
    ...{ onKeydown: (...[$event]) => {
            __VLS_ctx.focusNext('email');
        } },
    ref: "usernameField",
    id: "username",
    value: (__VLS_ctx.username),
    type: "text",
    placeholder: "Benutzername",
    ...{ class: "input input-bordered w-full" },
    autocomplete: "username",
});
/** @type {typeof __VLS_ctx.usernameField} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onKeydown: (...[$event]) => {
            __VLS_ctx.focusNext('password');
        } },
    ...{ onKeydown: (...[$event]) => {
            __VLS_ctx.focusNext('password');
        } },
    ref: "emailField",
    id: "email",
    type: "email",
    placeholder: "E-Mail (z.B. max.mustermann@example.com)",
    ...{ class: "input input-bordered w-full" },
    autocomplete: "email",
});
(__VLS_ctx.email);
/** @type {typeof __VLS_ctx.emailField} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onKeydown: (...[$event]) => {
            __VLS_ctx.focusNext('passwordRepeat');
        } },
    ...{ onKeydown: (...[$event]) => {
            __VLS_ctx.focusNext('passwordRepeat');
        } },
    ref: "passwordField",
    id: "password",
    type: "password",
    placeholder: "Passwort",
    ...{ class: "input input-bordered w-full" },
    autocomplete: "new-password",
});
(__VLS_ctx.password);
/** @type {typeof __VLS_ctx.passwordField} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onKeydown: (__VLS_ctx.onSubmit) },
    ...{ onKeydown: (...[$event]) => {
            __VLS_ctx.focusNext('registerButton');
        } },
    ref: "passwordRepeatField",
    id: "passwordRepeat",
    type: "password",
    placeholder: "Passwort wiederholen",
    ...{ class: "input input-bordered w-full" },
    autocomplete: "new-password",
});
(__VLS_ctx.passwordRepeat);
/** @type {typeof __VLS_ctx.passwordRepeatField} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.onSubmit) },
    ref: "registerButton",
    id: "registerButton",
    ...{ class: "btn btn-primary w-full" },
});
/** @type {typeof __VLS_ctx.registerButton} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "text-center text-sm opacity-70" },
});
const __VLS_0 = {}.RouterLink;
/** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    to: "/login",
    ...{ class: "link link-primary" },
}));
const __VLS_2 = __VLS_1({
    to: "/login",
    ...{ class: "link link-primary" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-screen']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['alert']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-error']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['alert']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-info']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
/** @type {__VLS_StyleScopedClasses['link']} */ ;
/** @type {__VLS_StyleScopedClasses['link-primary']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            username: username,
            email: email,
            password: password,
            passwordRepeat: passwordRepeat,
            errorMsg: errorMsg,
            successMsg: successMsg,
            usernameField: usernameField,
            emailField: emailField,
            passwordField: passwordField,
            passwordRepeatField: passwordRepeatField,
            registerButton: registerButton,
            onSubmit: onSubmit,
            focusNext: focusNext,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
