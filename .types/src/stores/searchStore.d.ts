export declare const useSearchStore: import("pinia").StoreDefinition<"search", Pick<{
    globalSearchQuery: import("vue").Ref<string, string>;
    lastSearches: import("vue").Ref<string[], string[]>;
    hasActiveSearch: import("vue").ComputedRef<boolean>;
    search: (query: string) => string;
    clearSearch: () => void;
    loadSearchHistory: () => void;
}, "globalSearchQuery" | "lastSearches">, Pick<{
    globalSearchQuery: import("vue").Ref<string, string>;
    lastSearches: import("vue").Ref<string[], string[]>;
    hasActiveSearch: import("vue").ComputedRef<boolean>;
    search: (query: string) => string;
    clearSearch: () => void;
    loadSearchHistory: () => void;
}, "hasActiveSearch">, Pick<{
    globalSearchQuery: import("vue").Ref<string, string>;
    lastSearches: import("vue").Ref<string[], string[]>;
    hasActiveSearch: import("vue").ComputedRef<boolean>;
    search: (query: string) => string;
    clearSearch: () => void;
    loadSearchHistory: () => void;
}, "search" | "clearSearch" | "loadSearchHistory">>;
