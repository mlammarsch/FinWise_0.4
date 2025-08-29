import { ref, computed } from "vue";
import { useTagStore } from "../../stores/tagStore";
import { useTransactionStore } from "../../stores/transactionStore";
import SearchGroup from "../../components/ui/SearchGroup.vue";
import PagingComponent from "../../components/ui/PagingComponent.vue";
import SearchableSelect from "../../components/ui/SearchableSelect.vue";
import BadgeSoft from "../../components/ui/BadgeSoft.vue";
import ColorPicker from "../../components/ui/ColorPicker.vue";
import TextInput from "../../components/ui/TextInput.vue";
import { getRandomTagColor } from "../../utils/tagColorUtils";
const tagStore = useTagStore();
const transactionStore = useTransactionStore();
const showTagModal = ref(false);
const isEditMode = ref(false);
const selectedTag = ref(null);
const showColorPicker = ref(false);
const tagBeingEditedForColor = ref(null); // für Liste
const editingTagId = ref(null); // für Inline-Bearbeitung
const clickTimeout = ref(null); // für Click/Doppelclick-Unterscheidung
const searchQuery = ref("");
const currentPage = ref(1);
const itemsPerPage = ref(25);
// Sortierungsstate
const sortField = ref("name");
const sortDirection = ref("asc");
const filteredTags = computed(() => {
    let filtered = tagStore.tags;
    // Filtern nach Suchbegriff
    if (searchQuery.value.trim() !== "") {
        filtered = filtered.filter((tag) => tag.name.toLowerCase().includes(searchQuery.value.toLowerCase()));
    }
    // Sortieren
    return [...filtered].sort((a, b) => {
        let aValue;
        let bValue;
        if (sortField.value === "name") {
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
        }
        else {
            // usage
            aValue = tagUsage.value(a.id);
            bValue = tagUsage.value(b.id);
        }
        let comparison = 0;
        if (aValue < bValue) {
            comparison = -1;
        }
        else if (aValue > bValue) {
            comparison = 1;
        }
        return sortDirection.value === "asc" ? comparison : -comparison;
    });
});
const totalPages = computed(() => {
    if (itemsPerPage.value === "all")
        return 1;
    return Math.ceil(filteredTags.value.length / Number(itemsPerPage.value));
});
const paginatedTags = computed(() => {
    if (itemsPerPage.value === "all")
        return filteredTags.value;
    const start = (currentPage.value - 1) * Number(itemsPerPage.value);
    const end = start + Number(itemsPerPage.value);
    return filteredTags.value.slice(start, end);
});
const tagUsage = computed(() => {
    return (tagId) => transactionStore.transactions.filter((tx) => tx.tagIds.includes(tagId))
        .length;
});
const getParentTagName = (parentId) => {
    if (!parentId)
        return "-";
    const parent = tagStore.tags.find((t) => t.id === parentId);
    return parent ? parent.name : "Unbekannt";
};
const createTag = () => {
    selectedTag.value = {
        id: "", // Leere ID - wird vom TagStore erkannt und durch UUID ersetzt
        name: "",
        parentTagId: null,
        color: getRandomTagColor(),
    };
    isEditMode.value = false;
    showTagModal.value = true;
};
const editTag = (tag) => {
    selectedTag.value = { ...tag };
    isEditMode.value = true;
    showTagModal.value = true;
};
const saveTag = () => {
    if (!selectedTag.value)
        return;
    if (isEditMode.value) {
        tagStore.updateTag(selectedTag.value);
    }
    else {
        tagStore.addTag({ ...selectedTag.value });
    }
    showTagModal.value = false;
};
const closeModal = () => {
    showTagModal.value = false;
};
const showReplaceTagModal = ref(false);
const selectedTagToDelete = ref(null);
const replacementTagId = ref("");
const replacementOptions = computed(() => {
    const options = tagStore.tags
        .filter((tag) => selectedTagToDelete.value && tag.id !== selectedTagToDelete.value.id)
        .map((tag) => ({ id: tag.id, name: tag.name }));
    return [{ id: "", name: "Kein Tag" }, ...options];
});
const replaceTagInTransactions = (oldTag, newTagId) => {
    transactionStore.transactions.forEach((tx) => {
        if (tx.tagIds.includes(oldTag.id)) {
            const newTags = tx.tagIds.filter((id) => id !== oldTag.id);
            if (newTagId && !newTags.includes(newTagId))
                newTags.push(newTagId);
            transactionStore.updateTransaction(tx.id, { tagIds: newTags });
        }
    });
};
const deleteTag = (tag) => {
    if (tagUsage.value(tag.id) > 0) {
        selectedTagToDelete.value = tag;
        replacementTagId.value = "";
        showReplaceTagModal.value = true;
    }
    else {
        if (confirm(`Möchten Sie das Tag "${tag.name}" wirklich löschen?`)) {
            tagStore.deleteTag(tag.id);
        }
    }
};
const openColorPicker = (tag) => {
    tagBeingEditedForColor.value = tag;
    showColorPicker.value = true;
};
const onColorSelected = (farbe) => {
    if (tagBeingEditedForColor.value) {
        const tag = tagBeingEditedForColor.value;
        tagStore.updateTag({ ...tag, color: farbe });
    }
    else if (selectedTag.value) {
        selectedTag.value.color = farbe;
    }
    showColorPicker.value = false;
    tagBeingEditedForColor.value = null;
};
const cancelColorPicker = () => {
    showColorPicker.value = false;
    tagBeingEditedForColor.value = null;
};
// Sortierungsfunktionen
const toggleSort = (field) => {
    if (sortField.value === field) {
        // Gleiche Spalte: Richtung umkehren
        sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
    }
    else {
        // Neue Spalte: auf aufsteigend setzen
        sortField.value = field;
        sortDirection.value = "asc";
    }
};
const getSortIcon = (field) => {
    if (sortField.value !== field) {
        return "mdi:sort";
    }
    return sortDirection.value === "asc"
        ? "mdi:sort-ascending"
        : "mdi:sort-descending";
};
// Inline-Bearbeitung
const startInlineEdit = (tagId) => {
    editingTagId.value = tagId;
};
const finishInlineEdit = () => {
    editingTagId.value = null;
};
const saveInlineEdit = (tagId, newName) => {
    if (newName.trim() === '') {
        finishInlineEdit();
        return;
    }
    const tag = tagStore.tags.find(t => t.id === tagId);
    if (tag && tag.name !== newName.trim()) {
        tagStore.updateTag({ ...tag, name: newName.trim() });
    }
    finishInlineEdit();
};
// Click/Doppelclick-Behandlung
const handleTagClick = (tag) => {
    // Einzelklick: Verzögerung für Farbwahl
    clickTimeout.value = setTimeout(() => {
        if (clickTimeout.value) {
            openColorPicker(tag);
            clickTimeout.value = null;
        }
    }, 250); // 250ms Verzögerung
};
const handleTagDoubleClick = (tag) => {
    // Doppelklick: Timeout abbrechen und Namensbearbeitung starten
    if (clickTimeout.value) {
        clearTimeout(clickTimeout.value);
        clickTimeout.value = null;
    }
    startInlineEdit(tag.id);
};
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "max-w-4xl mx-auto flex flex-col min-h-screen py-8" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex w-full justify-between items-center mb-6 flex-wrap md:flex-nowrap" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
    ...{ class: "text-xl font-bold flex-shrink-0" },
});
/** @type {[typeof SearchGroup, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(SearchGroup, new SearchGroup({
    ...{ 'onSearch': {} },
    ...{ 'onBtnRightClick': {} },
    btnRight: "Neu",
    btnRightIcon: "mdi:plus",
}));
const __VLS_1 = __VLS_0({
    ...{ 'onSearch': {} },
    ...{ 'onBtnRightClick': {} },
    btnRight: "Neu",
    btnRightIcon: "mdi:plus",
}, ...__VLS_functionalComponentArgsRest(__VLS_0));
let __VLS_3;
let __VLS_4;
let __VLS_5;
const __VLS_6 = {
    onSearch: ((query) => (__VLS_ctx.searchQuery = query))
};
const __VLS_7 = {
    onBtnRightClick: (__VLS_ctx.createTag)
};
var __VLS_2;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "text-xs text-base-content/60 mb-2 flex items-center space-x-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card bg-base-100 shadow-md border border-base-300 w-full mt-6" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card-body" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "overflow-x-auto" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({
    ...{ class: "table table-zebra w-full max-w-full" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.toggleSort('name');
        } },
    ...{ class: "cursor-pointer hover:bg-base-200 select-none" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center justify-between" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
const __VLS_8 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    icon: (__VLS_ctx.getSortIcon('name')),
    ...{ class: "w-4 h-4 ml-1" },
    ...{ class: ({ 'text-primary': __VLS_ctx.sortField === 'name' }) },
}));
const __VLS_10 = __VLS_9({
    icon: (__VLS_ctx.getSortIcon('name')),
    ...{ class: "w-4 h-4 ml-1" },
    ...{ class: ({ 'text-primary': __VLS_ctx.sortField === 'name' }) },
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "text-center hidden md:table-cell" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "text-center hidden md:table-cell break-words whitespace-normal" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.toggleSort('usage');
        } },
    ...{ class: "text-center hidden md:table-cell break-words whitespace-normal cursor-pointer hover:bg-base-200 select-none" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center justify-center" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
const __VLS_12 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    icon: (__VLS_ctx.getSortIcon('usage')),
    ...{ class: "w-4 h-4 ml-1" },
    ...{ class: ({ 'text-primary': __VLS_ctx.sortField === 'usage' }) },
}));
const __VLS_14 = __VLS_13({
    icon: (__VLS_ctx.getSortIcon('usage')),
    ...{ class: "w-4 h-4 ml-1" },
    ...{ class: ({ 'text-primary': __VLS_ctx.sortField === 'usage' }) },
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "text-right" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
for (const [tag] of __VLS_getVForSourceType((__VLS_ctx.paginatedTags))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
        key: (tag.id),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    if (__VLS_ctx.editingTagId === tag.id) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "w-full" },
        });
        /** @type {[typeof TextInput, ]} */ ;
        // @ts-ignore
        const __VLS_16 = __VLS_asFunctionalComponent(TextInput, new TextInput({
            ...{ 'onUpdate:modelValue': {} },
            ...{ 'onFinish': {} },
            modelValue: (tag.name),
            isActive: (true),
            placeholder: (tag.name),
        }));
        const __VLS_17 = __VLS_16({
            ...{ 'onUpdate:modelValue': {} },
            ...{ 'onFinish': {} },
            modelValue: (tag.name),
            isActive: (true),
            placeholder: (tag.name),
        }, ...__VLS_functionalComponentArgsRest(__VLS_16));
        let __VLS_19;
        let __VLS_20;
        let __VLS_21;
        const __VLS_22 = {
            'onUpdate:modelValue': ((newName) => __VLS_ctx.saveInlineEdit(tag.id, newName))
        };
        const __VLS_23 = {
            onFinish: (__VLS_ctx.finishInlineEdit)
        };
        var __VLS_18;
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex items-center space-x-2" },
        });
        /** @type {[typeof BadgeSoft, ]} */ ;
        // @ts-ignore
        const __VLS_24 = __VLS_asFunctionalComponent(BadgeSoft, new BadgeSoft({
            ...{ 'onClick': {} },
            ...{ 'onDblclick': {} },
            label: (tag.name),
            colorIntensity: (tag.color),
            ...{ class: "cursor-pointer select-none" },
        }));
        const __VLS_25 = __VLS_24({
            ...{ 'onClick': {} },
            ...{ 'onDblclick': {} },
            label: (tag.name),
            colorIntensity: (tag.color),
            ...{ class: "cursor-pointer select-none" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_24));
        let __VLS_27;
        let __VLS_28;
        let __VLS_29;
        const __VLS_30 = {
            onClick: (...[$event]) => {
                if (!!(__VLS_ctx.editingTagId === tag.id))
                    return;
                __VLS_ctx.handleTagClick(tag);
            }
        };
        const __VLS_31 = {
            onDblclick: (...[$event]) => {
                if (!!(__VLS_ctx.editingTagId === tag.id))
                    return;
                __VLS_ctx.handleTagDoubleClick(tag);
            }
        };
        var __VLS_26;
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "text-center hidden md:table-cell" },
    });
    (__VLS_ctx.getParentTagName(tag.parentTagId));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "text-center hidden md:table-cell break-words whitespace-normal" },
    });
    (__VLS_ctx.tagStore.getChildTags(tag.id).length);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "text-center hidden md:table-cell break-words whitespace-normal" },
    });
    (__VLS_ctx.tagUsage(tag.id));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "text-right" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex justify-end space-x-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.editTag(tag);
            } },
        ...{ class: "btn btn-ghost btn-sm text-secondary" },
    });
    const __VLS_32 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
        icon: "mdi:pencil",
        ...{ class: "text-base" },
    }));
    const __VLS_34 = __VLS_33({
        icon: "mdi:pencil",
        ...{ class: "text-base" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.deleteTag(tag);
            } },
        ...{ class: "btn btn-ghost btn-sm text-error" },
    });
    const __VLS_36 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
        icon: "mdi:trash-can",
        ...{ class: "text-base" },
    }));
    const __VLS_38 = __VLS_37({
        icon: "mdi:trash-can",
        ...{ class: "text-base" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_37));
}
/** @type {[typeof PagingComponent, ]} */ ;
// @ts-ignore
const __VLS_40 = __VLS_asFunctionalComponent(PagingComponent, new PagingComponent({
    ...{ 'onUpdate:currentPage': {} },
    ...{ 'onUpdate:itemsPerPage': {} },
    currentPage: (__VLS_ctx.currentPage),
    totalPages: (__VLS_ctx.totalPages),
    itemsPerPage: (__VLS_ctx.itemsPerPage),
}));
const __VLS_41 = __VLS_40({
    ...{ 'onUpdate:currentPage': {} },
    ...{ 'onUpdate:itemsPerPage': {} },
    currentPage: (__VLS_ctx.currentPage),
    totalPages: (__VLS_ctx.totalPages),
    itemsPerPage: (__VLS_ctx.itemsPerPage),
}, ...__VLS_functionalComponentArgsRest(__VLS_40));
let __VLS_43;
let __VLS_44;
let __VLS_45;
const __VLS_46 = {
    'onUpdate:currentPage': ((val) => (__VLS_ctx.currentPage = val))
};
const __VLS_47 = {
    'onUpdate:itemsPerPage': ((val) => (__VLS_ctx.itemsPerPage = val))
};
var __VLS_42;
if (__VLS_ctx.showTagModal) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "fixed modal modal-open flex items-center justify-center z-50" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "bg-base-100 p-6 rounded-md w-full max-w-md shadow-lg border border-base-300" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "text-lg font-bold mb-4" },
    });
    (__VLS_ctx.isEditMode ? "Tag bearbeiten" : "Neues Tag erstellen");
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-control mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label-text" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        value: (__VLS_ctx.selectedTag.name),
        type: "text",
        ...{ class: "input input-bordered w-full" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-col form-control mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label-text" },
    });
    /** @type {[typeof BadgeSoft, ]} */ ;
    // @ts-ignore
    const __VLS_48 = __VLS_asFunctionalComponent(BadgeSoft, new BadgeSoft({
        ...{ 'onClick': {} },
        label: "Farbe wählen",
        colorIntensity: (__VLS_ctx.selectedTag?.color || 'primary'),
        ...{ class: "mb-2 cursor-pointer" },
    }));
    const __VLS_49 = __VLS_48({
        ...{ 'onClick': {} },
        label: "Farbe wählen",
        colorIntensity: (__VLS_ctx.selectedTag?.color || 'primary'),
        ...{ class: "mb-2 cursor-pointer" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_48));
    let __VLS_51;
    let __VLS_52;
    let __VLS_53;
    const __VLS_54 = {
        onClick: (...[$event]) => {
            if (!(__VLS_ctx.showTagModal))
                return;
            __VLS_ctx.openColorPicker(null);
        }
    };
    var __VLS_50;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-control mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label-text" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.selectedTag.parentTagId),
        ...{ class: "select select-bordered" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: (null),
    });
    for (const [tag] of __VLS_getVForSourceType((__VLS_ctx.tagStore.tags))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (tag.id),
            value: (tag.id),
        });
        (tag.name);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex justify-end space-x-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.closeModal) },
        ...{ class: "btn btn-outline" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.saveTag) },
        ...{ class: "btn btn-primary" },
    });
    (__VLS_ctx.isEditMode ? "Speichern" : "Erstellen");
}
if (__VLS_ctx.showColorPicker) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "fixed inset-0 bg-black/50 z-50 flex items-center justify-center" },
    });
    /** @type {[typeof ColorPicker, ]} */ ;
    // @ts-ignore
    const __VLS_55 = __VLS_asFunctionalComponent(ColorPicker, new ColorPicker({
        ...{ 'onCancel': {} },
        ...{ 'onFarbeIntensity': {} },
    }));
    const __VLS_56 = __VLS_55({
        ...{ 'onCancel': {} },
        ...{ 'onFarbeIntensity': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_55));
    let __VLS_58;
    let __VLS_59;
    let __VLS_60;
    const __VLS_61 = {
        onCancel: (__VLS_ctx.cancelColorPicker)
    };
    const __VLS_62 = {
        onFarbeIntensity: (__VLS_ctx.onColorSelected)
    };
    var __VLS_57;
}
if (__VLS_ctx.showReplaceTagModal) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "fixed modal modal-open flex items-center justify-center z-50" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "bg-base-100 p-6 rounded-md w-full max-w-md shadow-lg border border-base-300" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "text-lg font-bold mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "mb-4" },
    });
    (__VLS_ctx.selectedTagToDelete?.name);
    (__VLS_ctx.tagUsage(__VLS_ctx.selectedTagToDelete?.id || ""));
    /** @type {[typeof SearchableSelect, ]} */ ;
    // @ts-ignore
    const __VLS_63 = __VLS_asFunctionalComponent(SearchableSelect, new SearchableSelect({
        modelValue: (__VLS_ctx.replacementTagId),
        options: (__VLS_ctx.replacementOptions),
        label: "Ersatz-Tag",
        placeholder: "Ersatz auswählen...",
    }));
    const __VLS_64 = __VLS_63({
        modelValue: (__VLS_ctx.replacementTagId),
        options: (__VLS_ctx.replacementOptions),
        label: "Ersatz-Tag",
        placeholder: "Ersatz auswählen...",
    }, ...__VLS_functionalComponentArgsRest(__VLS_63));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex justify-end space-x-2 mt-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showReplaceTagModal))
                    return;
                __VLS_ctx.showReplaceTagModal = false;
            } },
        ...{ class: "btn btn-outline" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (() => {
                if (__VLS_ctx.selectedTagToDelete) {
                    __VLS_ctx.replaceTagInTransactions(__VLS_ctx.selectedTagToDelete, __VLS_ctx.replacementTagId);
                    __VLS_ctx.tagStore.deleteTag(__VLS_ctx.selectedTagToDelete.id);
                }
                __VLS_ctx.showReplaceTagModal = false;
            }) },
        ...{ class: "btn btn-primary" },
    });
}
/** @type {__VLS_StyleScopedClasses['max-w-4xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-screen']} */ ;
/** @type {__VLS_StyleScopedClasses['py-8']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['md:flex-nowrap']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-4']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['table']} */ ;
/** @type {__VLS_StyleScopedClasses['table-zebra']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['md:table-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['md:table-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['break-words']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-normal']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['md:table-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['break-words']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-normal']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['md:table-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['md:table-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['break-words']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-normal']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['md:table-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['break-words']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-normal']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-1']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['modal']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-open']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['z-50']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-md']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-outline']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/50']} */ ;
/** @type {__VLS_StyleScopedClasses['z-50']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['modal']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-open']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['z-50']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-md']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-outline']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            SearchGroup: SearchGroup,
            PagingComponent: PagingComponent,
            SearchableSelect: SearchableSelect,
            BadgeSoft: BadgeSoft,
            ColorPicker: ColorPicker,
            TextInput: TextInput,
            tagStore: tagStore,
            showTagModal: showTagModal,
            isEditMode: isEditMode,
            selectedTag: selectedTag,
            showColorPicker: showColorPicker,
            editingTagId: editingTagId,
            searchQuery: searchQuery,
            currentPage: currentPage,
            itemsPerPage: itemsPerPage,
            sortField: sortField,
            totalPages: totalPages,
            paginatedTags: paginatedTags,
            tagUsage: tagUsage,
            getParentTagName: getParentTagName,
            createTag: createTag,
            editTag: editTag,
            saveTag: saveTag,
            closeModal: closeModal,
            showReplaceTagModal: showReplaceTagModal,
            selectedTagToDelete: selectedTagToDelete,
            replacementTagId: replacementTagId,
            replacementOptions: replacementOptions,
            replaceTagInTransactions: replaceTagInTransactions,
            deleteTag: deleteTag,
            openColorPicker: openColorPicker,
            onColorSelected: onColorSelected,
            cancelColorPicker: cancelColorPicker,
            toggleSort: toggleSort,
            getSortIcon: getSortIcon,
            finishInlineEdit: finishInlineEdit,
            saveInlineEdit: saveInlineEdit,
            handleTagClick: handleTagClick,
            handleTagDoubleClick: handleTagDoubleClick,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
