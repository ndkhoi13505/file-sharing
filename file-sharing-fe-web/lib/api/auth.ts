import { authClient, adminClient } from "./client";
import { clearAuth } from "./helper";
import { 
  LoginRequest, 
  LoginResponse, 
  RegisterRequest, 
  RegisterSuccessResponse, 
  TotpSetupResponse, 
  TotpVerifyRequest, 
  TotpVerifyResponse, 
  TotpLoginRequest, 
  LoginSuccessResponse,
  UserResponse,
  ChangePasswordRequest
} from "../components/schemas";

export const login = (payload: LoginRequest) =>
  authClient.post<LoginResponse>("/auth/login", payload);
  
export const register = (payload: RegisterRequest) =>
  authClient.post<RegisterSuccessResponse>("/auth/register", payload);

export const setupTotp = () => 
  adminClient.post<TotpSetupResponse>("/auth/totp/setup", {});

export const verifyTotp = (payload: TotpVerifyRequest) =>
  adminClient.post<TotpVerifyResponse>("/auth/totp/verify", payload);

export const loginTotp = (payload: TotpLoginRequest) =>
  authClient.post<LoginSuccessResponse>("/auth/login/totp", payload);

export const getUserProfile = () => 
  adminClient.get<UserResponse>("/user");

export const disableTotp = (code: string) =>
  adminClient.post<any>("/auth/totp/disable", { code });

export const changePassword = (payload: ChangePasswordRequest) =>
  adminClient.post<any>("/auth/password/change", payload);

export const logout = () => {
  clearAuth();
};
