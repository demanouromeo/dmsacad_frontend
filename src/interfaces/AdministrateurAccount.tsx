// Raw row shape returned by AccountController::allAdministrateurAccounts (admin_id/name joined
// with account.acc_id/login/pwd/type/email) - AccountManager maps this onto the shared
// ManagedAccount shape alongside Staff rows, same as ManagedAccount's own doc comment explains.
export interface AdministrateurAccount {
  admin_id: number;
  name: string;
  acc_id: number;
  login: string;
  pwd: string;
  type: number;
  email: string | null;
}
