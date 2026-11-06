export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  role: "user" | "admin" | "judge";
}

export interface UserSession {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // Unix timestamp ms
  isSimulated: boolean;
}

export interface AuthCredentials {
  email: string;
  password?: string;
  fullName?: string;
}

export interface AuthResponse {
  success: boolean;
  session?: UserSession;
  user?: AuthUser;
  error?: string;
  message?: string;
}
