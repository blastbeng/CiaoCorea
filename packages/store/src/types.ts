/** Un profilo che vive in questo browser. */
export interface LocalAccount {
  id: string;
  /** Il nome generato alla creazione: distingue i profili sullo stesso device. */
  username: string;
  /** Il nome che lo studente si è scelto. */
  displayName: string;
  createdAt: string;
  /** C'è una sessione aperta: si entra con un clic. */
  hasSession: boolean;
}

export interface AccountsResponse {
  accounts: LocalAccount[];
  currentUserId: string | null;
}
