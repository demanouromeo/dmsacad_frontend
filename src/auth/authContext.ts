import { createContext } from "react";
import type { AuthPayload } from "../interfaces/AuthPayload";

export interface AuthContextValue {
  accessToken: string | null;
  authPayload: AuthPayload | null;
  connection: string;
  schoolYear: string;
  isRestoring: boolean;
  login: (login: string, pwd: string, connection: string) => Promise<boolean>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
