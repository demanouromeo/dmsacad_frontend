import { createContext } from "react";
import type { AuthPayload } from "../interfaces/AuthPayload";

export interface AuthContextValue {
  accessToken: string | null;
  authPayload: AuthPayload | null;
  connection: string;
  schoolYear: string;
  section: string;
  isRestoring: boolean;
  login: (
    login: string,
    pwd: string,
    connection: string,
    year: string,
    section: string,
  ) => Promise<boolean>;
  setSchoolYear: (year: string) => void;
  setSection: (section: string) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
