// Unified row shape for AccountManager, merging two backend sources that share the same
// acc_id/login/pwd/type/email columns but come from different joined tables (StaffController's
// allStaffs1 vs AccountController's allAdministrateurAccounts) - `source`/`sourceId` track which
// table (and its own primary key) a row actually came from, since neither staff_id nor admin_id
// alone is unique across both lists.
export type AccountSource = "staff" | "administrateur";

export interface ManagedAccount {
  acc_id: number;
  source: AccountSource;
  sourceId: number;
  name: string;
  surname: string | null;
  login: string;
  pwd: string;
  type: number;
  email: string | null;
}
