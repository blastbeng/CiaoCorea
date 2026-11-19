/** Un profilo che vive in questo browser. */
export interface LocalAccount {
  id: string;
  /** L'unico nome del profilo: distingue i profili sullo stesso device. */
  username: string;
  createdAt: string;
  /** C'è una sessione aperta: si entra con un clic. */
  hasSession: boolean;
}

export interface AccountsResponse {
  accounts: LocalAccount[];
  currentUserId: string | null;
}
