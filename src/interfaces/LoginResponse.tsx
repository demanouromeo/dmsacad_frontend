import type { Account } from "./Account";

export interface LoginResponse {
  status: boolean;
  message: string;
  access_token: string;
  token_type: string;
  expires_in: number;
  user: Account;
}
