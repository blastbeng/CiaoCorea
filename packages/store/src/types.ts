/** Un profilo che vive in questo browser. */
export interface LocalAccount {
  id: string;
  /** Il nome con cui si entra: può essere un'email o un nome semplice. */
  email: string;
  displayName: string;
  createdAt: string;
  /** C'è una sessione ancora valida: si può riprendere senza password. */
  hasSession: boolean;
}

export interface AccountsResponse {
  accounts: LocalAccount[];
  currentUserId: string | null;
}
