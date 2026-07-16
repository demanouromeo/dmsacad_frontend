export interface AuthPayload {
  iss: string;
  sub: number;
  email?: string;
  role: string;
  name: string;
  user_id: number;
  iat: number;
  exp: number;
}
