export type LinkedAccount = {
    providerId: string;
    accountId: string;
    hasPassword: boolean;
};
export type SignInProvider = { id: string; label: string; enabled: boolean };
export type SignInMethod = {
    providerId: string;
    accountId?: string;
    label: string;
    connected: boolean;
    enabled: boolean;
    usable: boolean;
    canDisconnect: boolean;
};

export function signInMethods(
    accounts: LinkedAccount[],
    providers: SignInProvider[],
): SignInMethod[] {
    const credential = accounts.find(
        (account) => account.providerId === "credential" && account.hasPassword,
    );
    const methods: SignInMethod[] = [
        {
            providerId: "credential",
            label: "Email & password",
            connected: Boolean(credential),
            enabled: true,
            usable: Boolean(credential),
            canDisconnect: false,
        },
    ];
    const ids = new Set([
        ...providers.map((provider) => provider.id),
        ...accounts
            .filter((account) => account.providerId !== "credential")
            .map((account) => account.providerId),
    ]);
    for (const id of ids) {
        const provider = providers.find((provider) => provider.id === id);
        const linked = accounts.filter((account) => account.providerId === id);
        for (const account of linked.length ? linked : [undefined])
            methods.push({
                providerId: id,
                accountId: account?.accountId,
                label: provider?.label ?? id,
                connected: Boolean(account),
                enabled: provider?.enabled ?? false,
                usable: Boolean(account && provider?.enabled),
                canDisconnect: false,
            });
    }
    return methods.map((method) => ({
        ...method,
        canDisconnect:
            method.providerId !== "credential" &&
            method.connected &&
            methods.some((other) => other !== method && other.usable),
    }));
}

export function canUnlinkAccount(
    accounts: LinkedAccount[],
    providers: SignInProvider[],
    providerId: string,
    accountId?: string,
): boolean {
    const target = accounts.find(
        (account) =>
            account.providerId === providerId &&
            (accountId === undefined || account.accountId === accountId),
    );
    if (!target) return false;
    return signInMethods(
        accounts.filter((account) => account !== target),
        providers,
    ).some((method) => method.usable);
}

export function linkingFeedback(error: string | null): string {
    if (!error) return "";
    if (error === "access_denied")
        return "Connection cancelled. Your sign-in methods have not changed.";
    if (
        error === "email_doesn't_match" ||
        error === "LINKING_DIFFERENT_EMAILS_NOT_ALLOWED"
    )
        return "Use a provider account with the same email address as your Homi account.";
    if (error === "account_already_linked_to_different_user")
        return "That provider account is already connected to another Homi user.";
    if (
        error === "state_mismatch" ||
        error === "state_not_found" ||
        error === "state_expired"
    )
        return "The connection request expired. Please try connecting again.";
    return "Could not connect the account. Please try again; your existing sign-in methods are unchanged.";
}
