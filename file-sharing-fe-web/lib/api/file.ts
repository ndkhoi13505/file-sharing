import { uploadClient, adminClient } from "@/lib/api/client";
import type { FileUploadResponse, UploadedFileSummary, TOTPSetup, UserFilesResponse } from "@/lib/components/schemas";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

type AxiosErrorLike = {
  response?: {
    status?: number;
    data?: unknown;
  };
};

function isAxiosErrorLike(error: unknown): error is AxiosErrorLike {
  return typeof error === "object" && error !== null && "response" in error;
}

type LegacyUploadResponse = {
  fileId?: string;
  fileName?: string;
  shareLink?: string;
  availableFrom?: string;
  availableTo?: string;
  sharedWith?: string[];
  expiresAt?: string;
};

type ModernUploadResponse = {
  success?: boolean;
  message?: string;
  file?: Partial<UploadedFileSummary>;
  totpSetup?: TOTPSetup;
};

function isModernUploadResponse(payload: unknown): payload is ModernUploadResponse {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const candidate = payload as ModernUploadResponse;
  return typeof candidate.file === "object" && candidate.file !== null;
}

function toUploadedFileSummary(data: Partial<UploadedFileSummary>): UploadedFileSummary {
  return {
    id: data.id ?? data.shareToken ?? "",
    fileName: data.fileName ?? "",
    shareLink: data.shareLink ?? "",
    shareToken: data.shareToken,
    isPublic: data.isPublic,
    hasPassword: data.hasPassword,
    availableFrom: data.availableFrom,
    availableTo: data.availableTo,
    sharedWith: data.sharedWith,
    expiresAt: data.expiresAt,
    totpEnabled: data.totpEnabled,
  };
}

function toUploadFileResponse(raw: unknown): FileUploadResponse {
  if (isModernUploadResponse(raw)) {
    return {
      success: raw.success ?? true,
      message: raw.message,
      file: toUploadedFileSummary(raw.file ?? {}),
      totpSetup: raw.totpSetup,
    };
  }

  const legacy = raw as LegacyUploadResponse | null;
  if (legacy && (legacy.fileId || legacy.fileName || legacy.shareLink)) {
    return {
      success: true,
      file: {
        id: legacy.fileId ?? legacy.shareLink ?? "",
        fileName: legacy.fileName ?? "",
        shareLink: legacy.shareLink ?? "",
        availableFrom: legacy.availableFrom,
        availableTo: legacy.availableTo,
        sharedWith: legacy.sharedWith,
        expiresAt: legacy.expiresAt,
      },
    };
  }

  throw new ApiError(500, "Phản hồi upload không hợp lệ", raw);
}

async function uploadFile(formData: FormData): Promise<FileUploadResponse> {
  try {
    const response = await uploadClient.post("/files/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      withCredentials: true,
    });

    return toUploadFileResponse(response);
  } catch (error: unknown) {
    if (isAxiosErrorLike(error)) {
      const status = error.response?.status ?? 500;
      const data = error.response?.data;
      const message =
        typeof data === "object" && data !== null && "message" in data && typeof (data as { message?: unknown }).message === "string"
          ? String((data as { message?: unknown }).message)
          : "Upload file thất bại";

      throw new ApiError(status, message, data);
    }

    if (error instanceof ApiError) {
      throw error;
    }

    const fallbackMessage = error instanceof Error ? error.message : "Upload file thất bại";
    throw new ApiError(500, fallbackMessage, error);
  }
}

async function deleteFile(fileId: string): Promise<any> {
    return adminClient.delete(`/files/${fileId}`);
}

async function getUserFiles(params?: {
  status?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: string;
}): Promise<UserFilesResponse> {
  return adminClient.get<UserFilesResponse>("/files/my", { params });
}

export const fileApi = {
  upload: uploadFile,
  delete: deleteFile,
  getUserFiles: getUserFiles,
};

export { uploadFile, deleteFile, getUserFiles };
