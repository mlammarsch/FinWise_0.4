import { type Account, type AccountGroup } from '@/types';
interface AccountInfo {
    id: string;
    name: string;
    balance: number;
}
export declare const AccountService: {
    getAllAccounts(): Account[];
    getAccountById(id: string): Promise<Account | null>;
    addAccount(accountData: Omit<Account, "id" | "uuid" | "balance">): Promise<Account | null>;
    updateAccount(id: string, updates: Partial<Omit<Account, "id">>): Promise<boolean>;
    deleteAccount(id: string): Promise<boolean>;
    /**
     * Liefert den Saldo eines Kontos zum Stichtag (default = heute).
     * Berücksichtigt nur Transaktionen bis zum angegebenen Datum.
     */
    getCurrentBalance(accountId: string, asOf?: Date): number;
    /**
     * Liefert den projizierten Saldo eines Kontos zum Stichtag (default = heute).
     * Berücksichtigt auch zukünftige geplante Transaktionen.
     */
    getProjectedBalance(accountId: string, asOf?: Date): number;
    /**
     * Gesamtsaldo aller aktiven Konten zum Stichtag.
     */
    getTotalBalance(asOf?: Date): number;
    /**
     * Salden je Kontogruppe; liefert Objekt { groupId: balance }.
     */
    getGroupBalances(asOf?: Date): Record<string, number>;
    getAccountInfo(accountId: string): Promise<AccountInfo | null>;
    getAccountName(id: string | null): Promise<string>;
    getAccountNameSync(id: string | null): string;
    getAllAccountGroups(): AccountGroup[];
    getAccountGroupById(id: string): Promise<AccountGroup | null>;
    addAccountGroup(groupData: Omit<AccountGroup, "id">): Promise<AccountGroup | null>;
    updateAccountGroup(id: string, updates: Partial<Omit<AccountGroup, "id">>): Promise<boolean>;
    deleteAccountGroup(id: string): Promise<boolean>;
    updateAccountGroupOrder(orderUpdates: {
        id: string;
        sortOrder: number;
    }[]): Promise<void>;
    updateAccountOrder(groupId: string, accountIds: string[]): Promise<void>;
    moveAccountToGroup(accountId: string, newGroupId: string, newIndex: number): Promise<void>;
    initializeDefaultAccountsAndGroups(): Promise<void>;
};
export {};
