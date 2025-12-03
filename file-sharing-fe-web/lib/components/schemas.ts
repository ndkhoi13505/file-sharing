// =====================
// core types
// =====================

// enums
export type UserRole = "user" | "admin";
export type FileStatus = "pending" | "active" | "expired";

// core
export type User = {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  totpEnabled: boolean;
};

export type File = {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  shareToken: string;
  shareLink: string;
  isPublic: boolean;
  hasPassword: boolean;
  availableFrom?: string;
  availableTo?: string;
  validityDays?: number;
  status: FileStatus;
  hoursRemaining?: number;
  sharedWith?: string[];
  totpEnabled: boolean;
  owner: User;
  createdAt: string;
};

// =====================
// auth
// =====================
export type RegisterRequest = {
  username: string;
  email: string;
  password: string;
//   role?: string; // Why allow users to register with role?
};

export type RegisterSuccessResponse = {
  message: string;
  userId: string;
  totpSetup?: TOTPSetup;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginSuccessResponse = {
  accessToken: string;
  user: User;
};

export type TOTPRequiredResponse = {
  requireTOTP: boolean;
  message?: string;
};

export type LoginResponse = LoginSuccessResponse | TOTPRequiredResponse;

export type TOTPSetup = {
  secret: string;
  qrCode: string;
};

export interface TotpSetupResponse {
  message: string;
  totpSetup: TOTPSetup;
}

export interface TotpVerifyRequest {
  code: string;
}

export interface TotpVerifyResponse {
  message: string;
  totpEnabled: boolean;
}

export interface TotpLoginRequest {
  email: string;
  code: string;
}

export type ChangePasswordRequest = {
  oldPassword?: string;
  totpCode?: string;
  newPassword: string;
};

// =====================
// file upload
// =====================
export interface UploadedFileSummary {
  id: string;
  fileName: string;
  shareLink: string;
  shareToken?: string;
  isPublic?: boolean;
  hasPassword?: boolean;
  availableFrom?: string;
  availableTo?: string;
  sharedWith?: string[];
  expiresAt?: string;
  totpEnabled?: boolean;
}

export interface FileUploadRequest {
  file: File | Blob;
  isPublic?: boolean;
  password?: string;
  availableFrom?: string;
  availableTo?: string;
  sharedWith?: string[];
  enableTOTP?: boolean;
}

export interface FileUploadResponse {
  success?: boolean;
  file: UploadedFileSummary;
  totpSetup?: TOTPSetup;
  message?: string;
}

export interface FileInfoResponse {
  file: File;
}

// =====================
// user profile
// =====================
export interface UserResponse {
  user: User;
}

export interface UserFilesResponse {
  files: File[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalFiles: number;
    limit: number;
  };
  summary: {
    activeFiles: number;
    pendingFiles: number;
    expiredFiles: number;
    deletedFiles: number;
  };
}

// =====================
// admin
// =====================
export interface SystemPolicy {
  id: number;
  maxFileSizeMB: number;
  minValidityHours: number;
  maxValidityDays: number;
  defaultValidityDays: number;
  requirePasswordMinLength: number;
}

export interface SystemPolicyUpdate {
  maxFileSizeMB?: number;
  minValidityHours?: number;
  maxValidityDays?: number;
  defaultValidityDays?: number;
  requirePasswordMinLength?: number;
}

export interface UpdatePolicyResponse {
  message: string;
  policy: SystemPolicy;
}

export interface CleanupResponse {
  message: string;
  deletedFiles: number;
  timestamp: string;
}

// error

// export interface Error {
//   error: string;
//   message: string;
//   code: string;
// }
