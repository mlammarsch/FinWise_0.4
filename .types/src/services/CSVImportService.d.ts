export interface CSVConfiguration {
    delimiter: string;
    customDelimiter: string;
    hasTitleRow: boolean;
    dateFormat: string;
}
export interface MappedColumns {
    date: string;
    amount: string;
    notes: string;
    recipient: string;
    category: string;
}
export interface ImportRow {
    [key: string]: any;
    _originalIndex: number;
    _selected: boolean;
    _potentialMerge: any;
    _recipientMatches: {
        id: string;
        name: string;
        similarity: number;
    }[];
    _categoryMatches: {
        id: string;
        name: string;
        similarity: number;
    }[];
    _uniqueRowIdentifier: string;
    _duplicateType?: 'standard' | 'account_transfer';
    _duplicateConfidence?: number;
    _extractedTags?: string[];
    recipientId?: string;
    categoryId?: string;
    tagIds?: string[];
}
export interface PotentialMatch {
    id: string;
    date: string;
    amount: number;
    recipientId?: string;
    categoryId?: string;
    note?: string;
}
export declare const useCSVImportService: import("pinia").StoreDefinition<"csvImportService", Pick<{
    csvFile: import("vue").Ref<{
        readonly lastModified: number;
        readonly name: string;
        readonly webkitRelativePath: string;
        readonly size: number;
        readonly type: string;
        arrayBuffer: () => Promise<ArrayBuffer>;
        bytes: () => Promise<Uint8Array>;
        slice: (start?: number, end?: number, contentType?: string) => Blob;
        stream: () => ReadableStream<Uint8Array>;
        text: () => Promise<string>;
    } | null, File | {
        readonly lastModified: number;
        readonly name: string;
        readonly webkitRelativePath: string;
        readonly size: number;
        readonly type: string;
        arrayBuffer: () => Promise<ArrayBuffer>;
        bytes: () => Promise<Uint8Array>;
        slice: (start?: number, end?: number, contentType?: string) => Blob;
        stream: () => ReadableStream<Uint8Array>;
        text: () => Promise<string>;
    } | null>;
    csvData: import("vue").Ref<string, string>;
    configuration: import("vue").Ref<{
        delimiter: string;
        customDelimiter: string;
        hasTitleRow: boolean;
        dateFormat: string;
    }, CSVConfiguration | {
        delimiter: string;
        customDelimiter: string;
        hasTitleRow: boolean;
        dateFormat: string;
    }>;
    csvParseStatus: import("vue").Ref<"idle" | "parsing" | "error" | "success", "idle" | "parsing" | "error" | "success">;
    error: import("vue").Ref<string, string>;
    importStatus: import("vue").Ref<"idle" | "error" | "success" | "importing", "idle" | "error" | "success" | "importing">;
    csvHeaders: import("vue").Ref<string[], string[]>;
    allParsedData: import("vue").Ref<{
        [x: string]: any;
        _originalIndex: number;
        _selected: boolean;
        _potentialMerge: any;
        _recipientMatches: {
            id: string;
            name: string;
            similarity: number;
        }[];
        _categoryMatches: {
            id: string;
            name: string;
            similarity: number;
        }[];
        _uniqueRowIdentifier: string;
        _duplicateType?: "standard" | "account_transfer" | undefined;
        _duplicateConfidence?: number | undefined;
        _extractedTags?: string[] | undefined;
        recipientId?: string | undefined;
        categoryId?: string | undefined;
        tagIds?: string[] | undefined;
    }[], ImportRow[] | {
        [x: string]: any;
        _originalIndex: number;
        _selected: boolean;
        _potentialMerge: any;
        _recipientMatches: {
            id: string;
            name: string;
            similarity: number;
        }[];
        _categoryMatches: {
            id: string;
            name: string;
            similarity: number;
        }[];
        _uniqueRowIdentifier: string;
        _duplicateType?: "standard" | "account_transfer" | undefined;
        _duplicateConfidence?: number | undefined;
        _extractedTags?: string[] | undefined;
        recipientId?: string | undefined;
        categoryId?: string | undefined;
        tagIds?: string[] | undefined;
    }[]>;
    mappedColumns: import("vue").Ref<{
        date: string;
        amount: string;
        notes: string;
        recipient: string;
        category: string;
    }, MappedColumns | {
        date: string;
        amount: string;
        notes: string;
        recipient: string;
        category: string;
    }>;
    possibleMappings: import("vue").Ref<{
        [key: string]: string[];
    }, {
        [key: string]: string[];
    }>;
    importedTransactions: import("vue").Ref<any[], any[]>;
    selectedTags: import("vue").Ref<string[], string[]>;
    importSummary: import("vue").ComputedRef<{
        total: number;
        selected: number;
        ready: number;
        withRecipient: number;
        withCategory: number;
        potentialDuplicates: number;
    }>;
    totalAmount: import("vue").ComputedRef<number>;
    readCSVFile: (file: File) => Promise<void>;
    parseCSV: () => boolean;
    parseDate: (dateString: string) => string | null;
    applyAutoMappingToAllData: () => void;
    isRowReadyForImport: (row: ImportRow) => boolean;
    startImport: (accountId: string) => Promise<number>;
    toggleAllRows: (checked: boolean) => void;
    reset: () => void;
    applyRecipientToSimilarRows: (row: ImportRow, recipientId: string) => void;
    applyCategoryToSimilarRows: (row: ImportRow, categoryId: string) => void;
    updateRowNote: (rowIndex: number, newNote: string) => void;
    resolveRecipient: (row: any) => string | null | {
        id: string;
        name: string;
    };
    performRecipientMatching: (recipientName: string) => Promise<string | {
        id: string;
        name: string;
    } | null>;
    performCategoryMatching: (categoryName: string) => Promise<{
        id: string;
        name: string;
    } | null>;
    findPotentialDuplicates: (targetAccountId: string) => {
        csvRow: any;
        existingTransaction: any;
        duplicateType: "exact" | "similar" | "account_transfer";
        confidence: number;
    }[];
}, "error" | "csvFile" | "csvData" | "configuration" | "csvParseStatus" | "importStatus" | "csvHeaders" | "allParsedData" | "mappedColumns" | "possibleMappings" | "importedTransactions" | "selectedTags">, Pick<{
    csvFile: import("vue").Ref<{
        readonly lastModified: number;
        readonly name: string;
        readonly webkitRelativePath: string;
        readonly size: number;
        readonly type: string;
        arrayBuffer: () => Promise<ArrayBuffer>;
        bytes: () => Promise<Uint8Array>;
        slice: (start?: number, end?: number, contentType?: string) => Blob;
        stream: () => ReadableStream<Uint8Array>;
        text: () => Promise<string>;
    } | null, File | {
        readonly lastModified: number;
        readonly name: string;
        readonly webkitRelativePath: string;
        readonly size: number;
        readonly type: string;
        arrayBuffer: () => Promise<ArrayBuffer>;
        bytes: () => Promise<Uint8Array>;
        slice: (start?: number, end?: number, contentType?: string) => Blob;
        stream: () => ReadableStream<Uint8Array>;
        text: () => Promise<string>;
    } | null>;
    csvData: import("vue").Ref<string, string>;
    configuration: import("vue").Ref<{
        delimiter: string;
        customDelimiter: string;
        hasTitleRow: boolean;
        dateFormat: string;
    }, CSVConfiguration | {
        delimiter: string;
        customDelimiter: string;
        hasTitleRow: boolean;
        dateFormat: string;
    }>;
    csvParseStatus: import("vue").Ref<"idle" | "parsing" | "error" | "success", "idle" | "parsing" | "error" | "success">;
    error: import("vue").Ref<string, string>;
    importStatus: import("vue").Ref<"idle" | "error" | "success" | "importing", "idle" | "error" | "success" | "importing">;
    csvHeaders: import("vue").Ref<string[], string[]>;
    allParsedData: import("vue").Ref<{
        [x: string]: any;
        _originalIndex: number;
        _selected: boolean;
        _potentialMerge: any;
        _recipientMatches: {
            id: string;
            name: string;
            similarity: number;
        }[];
        _categoryMatches: {
            id: string;
            name: string;
            similarity: number;
        }[];
        _uniqueRowIdentifier: string;
        _duplicateType?: "standard" | "account_transfer" | undefined;
        _duplicateConfidence?: number | undefined;
        _extractedTags?: string[] | undefined;
        recipientId?: string | undefined;
        categoryId?: string | undefined;
        tagIds?: string[] | undefined;
    }[], ImportRow[] | {
        [x: string]: any;
        _originalIndex: number;
        _selected: boolean;
        _potentialMerge: any;
        _recipientMatches: {
            id: string;
            name: string;
            similarity: number;
        }[];
        _categoryMatches: {
            id: string;
            name: string;
            similarity: number;
        }[];
        _uniqueRowIdentifier: string;
        _duplicateType?: "standard" | "account_transfer" | undefined;
        _duplicateConfidence?: number | undefined;
        _extractedTags?: string[] | undefined;
        recipientId?: string | undefined;
        categoryId?: string | undefined;
        tagIds?: string[] | undefined;
    }[]>;
    mappedColumns: import("vue").Ref<{
        date: string;
        amount: string;
        notes: string;
        recipient: string;
        category: string;
    }, MappedColumns | {
        date: string;
        amount: string;
        notes: string;
        recipient: string;
        category: string;
    }>;
    possibleMappings: import("vue").Ref<{
        [key: string]: string[];
    }, {
        [key: string]: string[];
    }>;
    importedTransactions: import("vue").Ref<any[], any[]>;
    selectedTags: import("vue").Ref<string[], string[]>;
    importSummary: import("vue").ComputedRef<{
        total: number;
        selected: number;
        ready: number;
        withRecipient: number;
        withCategory: number;
        potentialDuplicates: number;
    }>;
    totalAmount: import("vue").ComputedRef<number>;
    readCSVFile: (file: File) => Promise<void>;
    parseCSV: () => boolean;
    parseDate: (dateString: string) => string | null;
    applyAutoMappingToAllData: () => void;
    isRowReadyForImport: (row: ImportRow) => boolean;
    startImport: (accountId: string) => Promise<number>;
    toggleAllRows: (checked: boolean) => void;
    reset: () => void;
    applyRecipientToSimilarRows: (row: ImportRow, recipientId: string) => void;
    applyCategoryToSimilarRows: (row: ImportRow, categoryId: string) => void;
    updateRowNote: (rowIndex: number, newNote: string) => void;
    resolveRecipient: (row: any) => string | null | {
        id: string;
        name: string;
    };
    performRecipientMatching: (recipientName: string) => Promise<string | {
        id: string;
        name: string;
    } | null>;
    performCategoryMatching: (categoryName: string) => Promise<{
        id: string;
        name: string;
    } | null>;
    findPotentialDuplicates: (targetAccountId: string) => {
        csvRow: any;
        existingTransaction: any;
        duplicateType: "exact" | "similar" | "account_transfer";
        confidence: number;
    }[];
}, "importSummary" | "totalAmount">, Pick<{
    csvFile: import("vue").Ref<{
        readonly lastModified: number;
        readonly name: string;
        readonly webkitRelativePath: string;
        readonly size: number;
        readonly type: string;
        arrayBuffer: () => Promise<ArrayBuffer>;
        bytes: () => Promise<Uint8Array>;
        slice: (start?: number, end?: number, contentType?: string) => Blob;
        stream: () => ReadableStream<Uint8Array>;
        text: () => Promise<string>;
    } | null, File | {
        readonly lastModified: number;
        readonly name: string;
        readonly webkitRelativePath: string;
        readonly size: number;
        readonly type: string;
        arrayBuffer: () => Promise<ArrayBuffer>;
        bytes: () => Promise<Uint8Array>;
        slice: (start?: number, end?: number, contentType?: string) => Blob;
        stream: () => ReadableStream<Uint8Array>;
        text: () => Promise<string>;
    } | null>;
    csvData: import("vue").Ref<string, string>;
    configuration: import("vue").Ref<{
        delimiter: string;
        customDelimiter: string;
        hasTitleRow: boolean;
        dateFormat: string;
    }, CSVConfiguration | {
        delimiter: string;
        customDelimiter: string;
        hasTitleRow: boolean;
        dateFormat: string;
    }>;
    csvParseStatus: import("vue").Ref<"idle" | "parsing" | "error" | "success", "idle" | "parsing" | "error" | "success">;
    error: import("vue").Ref<string, string>;
    importStatus: import("vue").Ref<"idle" | "error" | "success" | "importing", "idle" | "error" | "success" | "importing">;
    csvHeaders: import("vue").Ref<string[], string[]>;
    allParsedData: import("vue").Ref<{
        [x: string]: any;
        _originalIndex: number;
        _selected: boolean;
        _potentialMerge: any;
        _recipientMatches: {
            id: string;
            name: string;
            similarity: number;
        }[];
        _categoryMatches: {
            id: string;
            name: string;
            similarity: number;
        }[];
        _uniqueRowIdentifier: string;
        _duplicateType?: "standard" | "account_transfer" | undefined;
        _duplicateConfidence?: number | undefined;
        _extractedTags?: string[] | undefined;
        recipientId?: string | undefined;
        categoryId?: string | undefined;
        tagIds?: string[] | undefined;
    }[], ImportRow[] | {
        [x: string]: any;
        _originalIndex: number;
        _selected: boolean;
        _potentialMerge: any;
        _recipientMatches: {
            id: string;
            name: string;
            similarity: number;
        }[];
        _categoryMatches: {
            id: string;
            name: string;
            similarity: number;
        }[];
        _uniqueRowIdentifier: string;
        _duplicateType?: "standard" | "account_transfer" | undefined;
        _duplicateConfidence?: number | undefined;
        _extractedTags?: string[] | undefined;
        recipientId?: string | undefined;
        categoryId?: string | undefined;
        tagIds?: string[] | undefined;
    }[]>;
    mappedColumns: import("vue").Ref<{
        date: string;
        amount: string;
        notes: string;
        recipient: string;
        category: string;
    }, MappedColumns | {
        date: string;
        amount: string;
        notes: string;
        recipient: string;
        category: string;
    }>;
    possibleMappings: import("vue").Ref<{
        [key: string]: string[];
    }, {
        [key: string]: string[];
    }>;
    importedTransactions: import("vue").Ref<any[], any[]>;
    selectedTags: import("vue").Ref<string[], string[]>;
    importSummary: import("vue").ComputedRef<{
        total: number;
        selected: number;
        ready: number;
        withRecipient: number;
        withCategory: number;
        potentialDuplicates: number;
    }>;
    totalAmount: import("vue").ComputedRef<number>;
    readCSVFile: (file: File) => Promise<void>;
    parseCSV: () => boolean;
    parseDate: (dateString: string) => string | null;
    applyAutoMappingToAllData: () => void;
    isRowReadyForImport: (row: ImportRow) => boolean;
    startImport: (accountId: string) => Promise<number>;
    toggleAllRows: (checked: boolean) => void;
    reset: () => void;
    applyRecipientToSimilarRows: (row: ImportRow, recipientId: string) => void;
    applyCategoryToSimilarRows: (row: ImportRow, categoryId: string) => void;
    updateRowNote: (rowIndex: number, newNote: string) => void;
    resolveRecipient: (row: any) => string | null | {
        id: string;
        name: string;
    };
    performRecipientMatching: (recipientName: string) => Promise<string | {
        id: string;
        name: string;
    } | null>;
    performCategoryMatching: (categoryName: string) => Promise<{
        id: string;
        name: string;
    } | null>;
    findPotentialDuplicates: (targetAccountId: string) => {
        csvRow: any;
        existingTransaction: any;
        duplicateType: "exact" | "similar" | "account_transfer";
        confidence: number;
    }[];
}, "reset" | "readCSVFile" | "parseCSV" | "parseDate" | "applyAutoMappingToAllData" | "isRowReadyForImport" | "startImport" | "toggleAllRows" | "applyRecipientToSimilarRows" | "applyCategoryToSimilarRows" | "updateRowNote" | "resolveRecipient" | "performRecipientMatching" | "performCategoryMatching" | "findPotentialDuplicates">>;
