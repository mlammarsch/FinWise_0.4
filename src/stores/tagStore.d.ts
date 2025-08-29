/**
 * Pfad: src/stores/tagStore.ts
 * Speichert Tags – jetzt tenant-spezifisch mit bidirektionaler Synchronisation.
 */
import type { Tag } from '@/types';
export declare const useTagStore: import("pinia").StoreDefinition<"tag", Pick<{
    tags: import("vue").Ref<{
        id: string;
        name: string;
        parentTagId?: string | null | undefined;
        color?: string | undefined;
        icon?: string | undefined;
        updatedAt?: string | undefined;
    }[], Tag[] | {
        id: string;
        name: string;
        parentTagId?: string | null | undefined;
        color?: string | undefined;
        icon?: string | undefined;
        updatedAt?: string | undefined;
    }[]>;
    colorHistory: import("vue").Ref<string[], string[]>;
    getTagById: import("vue").ComputedRef<(id: string) => {
        id: string;
        name: string;
        parentTagId?: string | null | undefined;
        color?: string | undefined;
        icon?: string | undefined;
        updatedAt?: string | undefined;
    } | undefined>;
    rootTags: import("vue").ComputedRef<{
        id: string;
        name: string;
        parentTagId?: string | null | undefined;
        color?: string | undefined;
        icon?: string | undefined;
        updatedAt?: string | undefined;
    }[]>;
    getChildTags: import("vue").ComputedRef<(parentId: string) => {
        id: string;
        name: string;
        parentTagId?: string | null | undefined;
        color?: string | undefined;
        icon?: string | undefined;
        updatedAt?: string | undefined;
    }[]>;
    getTagsByIds: import("vue").ComputedRef<(ids: string[]) => {
        id: string;
        name: string;
        parentTagId?: string | null | undefined;
        color?: string | undefined;
        icon?: string | undefined;
        updatedAt?: string | undefined;
    }[]>;
    addTag: (tagData: Omit<Tag, "id" | "updatedAt"> | Tag, fromSync?: boolean) => Promise<Tag>;
    addMultipleTags: (tagsToAdd: Tag[], fromSync?: boolean) => Promise<Tag[]>;
    updateTag: (tagUpdatesData: Tag, fromSync?: boolean) => Promise<boolean>;
    deleteTag: (tagId: string, fromSync?: boolean) => Promise<void>;
    loadTags: () => Promise<void>;
    reset: () => Promise<void>;
}, "tags" | "colorHistory">, Pick<{
    tags: import("vue").Ref<{
        id: string;
        name: string;
        parentTagId?: string | null | undefined;
        color?: string | undefined;
        icon?: string | undefined;
        updatedAt?: string | undefined;
    }[], Tag[] | {
        id: string;
        name: string;
        parentTagId?: string | null | undefined;
        color?: string | undefined;
        icon?: string | undefined;
        updatedAt?: string | undefined;
    }[]>;
    colorHistory: import("vue").Ref<string[], string[]>;
    getTagById: import("vue").ComputedRef<(id: string) => {
        id: string;
        name: string;
        parentTagId?: string | null | undefined;
        color?: string | undefined;
        icon?: string | undefined;
        updatedAt?: string | undefined;
    } | undefined>;
    rootTags: import("vue").ComputedRef<{
        id: string;
        name: string;
        parentTagId?: string | null | undefined;
        color?: string | undefined;
        icon?: string | undefined;
        updatedAt?: string | undefined;
    }[]>;
    getChildTags: import("vue").ComputedRef<(parentId: string) => {
        id: string;
        name: string;
        parentTagId?: string | null | undefined;
        color?: string | undefined;
        icon?: string | undefined;
        updatedAt?: string | undefined;
    }[]>;
    getTagsByIds: import("vue").ComputedRef<(ids: string[]) => {
        id: string;
        name: string;
        parentTagId?: string | null | undefined;
        color?: string | undefined;
        icon?: string | undefined;
        updatedAt?: string | undefined;
    }[]>;
    addTag: (tagData: Omit<Tag, "id" | "updatedAt"> | Tag, fromSync?: boolean) => Promise<Tag>;
    addMultipleTags: (tagsToAdd: Tag[], fromSync?: boolean) => Promise<Tag[]>;
    updateTag: (tagUpdatesData: Tag, fromSync?: boolean) => Promise<boolean>;
    deleteTag: (tagId: string, fromSync?: boolean) => Promise<void>;
    loadTags: () => Promise<void>;
    reset: () => Promise<void>;
}, "getTagById" | "rootTags" | "getChildTags" | "getTagsByIds">, Pick<{
    tags: import("vue").Ref<{
        id: string;
        name: string;
        parentTagId?: string | null | undefined;
        color?: string | undefined;
        icon?: string | undefined;
        updatedAt?: string | undefined;
    }[], Tag[] | {
        id: string;
        name: string;
        parentTagId?: string | null | undefined;
        color?: string | undefined;
        icon?: string | undefined;
        updatedAt?: string | undefined;
    }[]>;
    colorHistory: import("vue").Ref<string[], string[]>;
    getTagById: import("vue").ComputedRef<(id: string) => {
        id: string;
        name: string;
        parentTagId?: string | null | undefined;
        color?: string | undefined;
        icon?: string | undefined;
        updatedAt?: string | undefined;
    } | undefined>;
    rootTags: import("vue").ComputedRef<{
        id: string;
        name: string;
        parentTagId?: string | null | undefined;
        color?: string | undefined;
        icon?: string | undefined;
        updatedAt?: string | undefined;
    }[]>;
    getChildTags: import("vue").ComputedRef<(parentId: string) => {
        id: string;
        name: string;
        parentTagId?: string | null | undefined;
        color?: string | undefined;
        icon?: string | undefined;
        updatedAt?: string | undefined;
    }[]>;
    getTagsByIds: import("vue").ComputedRef<(ids: string[]) => {
        id: string;
        name: string;
        parentTagId?: string | null | undefined;
        color?: string | undefined;
        icon?: string | undefined;
        updatedAt?: string | undefined;
    }[]>;
    addTag: (tagData: Omit<Tag, "id" | "updatedAt"> | Tag, fromSync?: boolean) => Promise<Tag>;
    addMultipleTags: (tagsToAdd: Tag[], fromSync?: boolean) => Promise<Tag[]>;
    updateTag: (tagUpdatesData: Tag, fromSync?: boolean) => Promise<boolean>;
    deleteTag: (tagId: string, fromSync?: boolean) => Promise<void>;
    loadTags: () => Promise<void>;
    reset: () => Promise<void>;
}, "reset" | "addTag" | "addMultipleTags" | "updateTag" | "deleteTag" | "loadTags">>;
