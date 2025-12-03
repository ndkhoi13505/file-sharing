"use client";

import { ChangeEvent, FormEvent, KeyboardEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
	CalendarCheck2,
	CheckCircle2,
	Clipboard,
	Clock4,
	Lock,
	ShieldCheck,
	UploadCloud,
	Users,
	X,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError, uploadFile } from "@/lib/api/file";
import type { FileUploadResponse } from "@/lib/components/schemas";


const MAX_FILE_SIZE_MB = 50;
const ACCEPTED_EXTENSIONS = [
	"pdf",
	"doc",
	"docx",
	"xls",
	"xlsx",
	"ppt",
	"pptx",
	"txt",
	"csv",
	"jpg",
	"jpeg",
	"png",
	"gif",
	"zip",
	"rar",
	"mp4",
	"mp3",
];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function UploadPage() {
	const router = useRouter();
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [passwordEnabled, setPasswordEnabled] = useState(false);
	const [passwordValue, setPasswordValue] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [availableFrom, setAvailableFrom] = useState("");
	const [availableTo, setAvailableTo] = useState("");
	const [sharedWithInput, setSharedWithInput] = useState("");
	const [sharedWith, setSharedWith] = useState<string[]>([]);
	const [enableTOTP, setEnableTOTP] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [uploadResult, setUploadResult] = useState<FileUploadResponse | null>(null);

	const acceptAttribute = useMemo(
		() => ACCEPTED_EXTENSIONS.map((ext) => `.${ext}`).join(","),
		[]
	);

	const resetForm = () => {
		setSelectedFile(null);
		setPasswordEnabled(false);
		setPasswordValue("");
		setShowPassword(false);
		setAvailableFrom("");
		setAvailableTo("");
		setSharedWithInput("");
		setSharedWith([]);
		setEnableTOTP(false);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	const validateFile = (file: File) => {
		const extension = file.name.split(".").pop()?.toLowerCase();
		if (!extension || !ACCEPTED_EXTENSIONS.includes(extension)) {
			toast.error("Định dạng file không được hỗ trợ.");
			return false;
		}

		const sizeInMb = file.size / (1024 * 1024);
		if (sizeInMb > MAX_FILE_SIZE_MB) {
			toast.error(`Kích thước tối đa ${MAX_FILE_SIZE_MB}MB.`);
			return false;
		}

		return true;
	};

	const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) {
			setSelectedFile(null);
			return;
		}

		if (!validateFile(file)) {
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
			return;
		}

		setSelectedFile(file);
		setUploadResult(null);
	};

	const addEmailToList = () => {
		const value = sharedWithInput.trim().toLowerCase();
		if (!value) {
			return;
		}

		if (!EMAIL_REGEX.test(value)) {
			toast.error("Email không hợp lệ.");
			return;
		}

		if (sharedWith.includes(value)) {
			toast.warning("Email đã tồn tại trong danh sách.");
			return;
		}

		setSharedWith((prev) => [...prev, value]);
		setSharedWithInput("");
	};

	const handleSharedWithKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter" || event.key === ",") {
			event.preventDefault();
			addEmailToList();
		}
	};

	const removeEmail = (email: string) => {
		setSharedWith((prev) => prev.filter((item) => item !== email));
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (!selectedFile) {
			toast.error("Vui lòng chọn một file để upload.");
			return;
		}

		if (passwordEnabled && passwordValue.trim().length < 6) {
			toast.error("Mật khẩu phải có tối thiểu 6 ký tự.");
			return;
		}

		if (availableFrom && availableTo) {
			const fromDate = new Date(availableFrom);
			const toDate = new Date(availableTo);
			if (!(fromDate < toDate)) {
				toast.error("Thời gian bắt đầu phải trước thời gian kết thúc.");
				return;
			}
		}

		const formData = new FormData();
		formData.append("file", selectedFile);

		if (passwordEnabled && passwordValue) {
			formData.append("password", passwordValue);
		}

		if (availableFrom) {
			formData.append("availableFrom", new Date(availableFrom).toISOString());
		}

		if (availableTo) {
			formData.append("availableTo", new Date(availableTo).toISOString());
		}

		if (sharedWith.length) {
			sharedWith.forEach((email) => formData.append("sharedWith", email));
		}

		formData.append("enableTOTP", String(enableTOTP));

		// Nếu bật mật khẩu hoặc chia sẻ riêng, coi như file không công khai.
		const isPublic = !passwordEnabled && sharedWith.length === 0;
		formData.append("isPublic", String(isPublic));

		setIsSubmitting(true);

		try {
			const response = await uploadFile(formData);
			setUploadResult(response);
			toast.success("Upload thành công!");
			resetForm();
		} catch (err) {
			if (err instanceof ApiError) {
				if (err.status === 401) {
					toast.error("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
					router.push("/login");
					return;
				}

				toast.error(err.message);
			} else if (err instanceof Error) {
				toast.error(err.message || "Có lỗi xảy ra, vui lòng thử lại.");
			} else {
				toast.error("Có lỗi xảy ra, vui lòng thử lại.");
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleCopyShareLink = async () => {
		const shareLink = uploadResult?.file?.shareLink;
		if (!shareLink) {
			return;
		}

		// Modern approach: Clipboard API (secure contexts only)
		if (navigator.clipboard) {
			try {
				await navigator.clipboard.writeText(shareLink);
				toast.success("Đã sao chép link chia sẻ.");
				return;
			} catch (err) {
				console.error("Clipboard API writeText failed, falling back.", err);
				// If it fails, we'll try the fallback method below.
			}
		}

		// Fallback for older browsers or non-secure contexts (HTTP)
		try {
			const textArea = document.createElement("textarea");
			textArea.value = shareLink;
			
			// Make the textarea out of sight
			textArea.style.position = "fixed";
			textArea.style.top = "-9999px";
			textArea.style.left = "-9999px";
			
			document.body.appendChild(textArea);
			textArea.focus();
			textArea.select();
			
			const successful = document.execCommand("copy");
			
			document.body.removeChild(textArea);
			
			if (successful) {
				toast.success("Đã sao chép link chia sẻ.");
			} else {
				// This can happen if the user denies clipboard permissions.
				throw new Error("Copy command was not successful.");
			}
		} catch (err) {
			console.error("Fallback clipboard copy failed.", err);
			toast.error("Không thể sao chép link. Vui lòng sao chép thủ công.");
		}
	};

	return (
		<div className="max-w-4xl mx-auto px-4 pb-16">
			<div className="bg-white border border-gray-200 rounded-3xl shadow-sm px-6 py-10 sm:px-10 sm:py-12 mt-10">
				<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
					<div>
						<h1 className="text-3xl font-semibold text-gray-900 flex items-center gap-3">
							<UploadCloud className="w-8 h-8 text-blue-600" />
							Upload File Bảo Mật
						</h1>
						<p className="mt-3 text-gray-500 max-w-2xl">
							Kéo thả hoặc chọn file từ máy của bạn. Tùy chỉnh mật khẩu, thời gian hiệu lực và người được phép truy cập trước khi chia sẻ.
						</p>
					</div>
					<div className="hidden sm:flex flex-col gap-3 text-sm text-gray-500">
						<div className="flex items-center gap-2">
							<ShieldCheck className="w-4 h-4 text-green-600" />
							Bảo vệ bằng mật khẩu/TOTP
						</div>
						<div className="flex items-center gap-2">
							<Clock4 className="w-4 h-4 text-blue-600" />
							Thiết lập thời gian hiệu lực
						</div>
						<div className="flex items-center gap-2">
							<Users className="w-4 h-4 text-purple-600" />
							Chia sẻ cho danh sách email
						</div>
					</div>
				</div>

				<form className="mt-10 space-y-10" onSubmit={handleSubmit}>
					<section>
						<h2 className="text-xl font-medium text-gray-900 mb-4">1. Chọn file</h2>
						<label
							htmlFor="fileInput"
							className="relative flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-2xl px-6 py-12 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
						>
							<input
								id="fileInput"
								ref={fileInputRef}
								type="file"
								className="hidden"
								onChange={handleFileChange}
								accept={acceptAttribute}
							/>
							<UploadCloud className="w-14 h-14 text-blue-600 mb-4" />
							{selectedFile ? (
								<>
									<p className="text-base font-semibold text-gray-900">{selectedFile.name}</p>
									<p className="mt-1 text-sm text-gray-500">
										{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
									</p>
								</>
							) : (
								<>
									<p className="text-base font-semibold text-gray-900">Kéo thả file vào đây</p>
									<p className="mt-1 text-sm text-gray-500">
										Hoặc nhấn để chọn file từ thiết bị của bạn
									</p>
								</>
							)}
							<p className="mt-4 text-xs text-gray-400">
								Hỗ trợ: {ACCEPTED_EXTENSIONS.join(", ")} • Tối đa {MAX_FILE_SIZE_MB}MB
							</p>
						</label>
					</section>

					<section>
						<h2 className="text-xl font-medium text-gray-900 mb-4">2. Cấu hình nâng cao</h2>
						<div className="space-y-6">
							<div className="flex items-start justify-between gap-6">
								<div className="flex-1">
									<label className="flex items-center gap-3 text-sm font-medium text-gray-900">
										<Lock className="w-4 h-4" />
										Bảo vệ bằng mật khẩu
									</label>
									<p className="mt-1 text-sm text-gray-500">Chỉ những người biết mật khẩu mới có thể tải file.</p>
								</div>
								<button
									type="button"
									onClick={() => setPasswordEnabled((prev) => !prev)}
									className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${passwordEnabled ? "bg-blue-600" : "bg-gray-300"}`}
									aria-pressed={passwordEnabled}
								>
									<span
										className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${passwordEnabled ? "translate-x-5" : "translate-x-1"}`}
									/>
								</button>
							</div>

							{passwordEnabled && (
								<div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">
									<div className="relative">
										<input
											type={showPassword ? "text" : "password"}
											value={passwordValue}
											onChange={(event) => setPasswordValue(event.target.value)}
											className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
											placeholder="Nhập mật khẩu bảo vệ (tối thiểu 6 ký tự)"
										/>
										<button
											type="button"
											onClick={() => setShowPassword((prev) => !prev)}
											className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
										>
											{showPassword ? <ShieldCheck className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
										</button>
									</div>
									<p className="text-sm text-gray-500 flex items-center">
										Nên kết hợp với Enable TOTP để tăng bảo mật.
									</p>
								</div>
							)}

							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div>
									<label htmlFor="availableFrom" className="flex items-center gap-2 text-sm font-medium text-gray-900">
										<CalendarCheck2 className="w-4 h-4" />
										Available From
									</label>
									<input
										id="availableFrom"
										type="datetime-local"
										value={availableFrom}
										onChange={(event) => setAvailableFrom(event.target.value)}
										className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
									/>
								</div>
								<div>
									<label htmlFor="availableTo" className="flex items-center gap-2 text-sm font-medium text-gray-900">
										<Clock4 className="w-4 h-4" />
										Available To
									</label>
									<input
										id="availableTo"
										type="datetime-local"
										value={availableTo}
										onChange={(event) => setAvailableTo(event.target.value)}
										className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
									/>
								</div>
							</div>

							<div>
								<label className="flex items-center gap-2 text-sm font-medium text-gray-900">
									<Users className="w-4 h-4" />
									Danh sách email được chia sẻ
								</label>
								<p className="mt-1 text-sm text-gray-500">Nhấn Enter hoặc dấu phẩy để thêm email. Để trống nếu muốn chia sẻ công khai.</p>
								<div className="mt-3 flex gap-3">
									<input
										type="email"
										value={sharedWithInput}
										onChange={(event) => setSharedWithInput(event.target.value)}
										onKeyDown={handleSharedWithKeyDown}
										className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
										placeholder="ví dụ: user@example.com"
									/>
									<button
										type="button"
										onClick={addEmailToList}
										className="px-4 py-3 text-sm font-medium rounded-xl border border-blue-500 text-blue-600 hover:bg-blue-50 transition-colors"
									>
										Thêm
									</button>
								</div>
								{sharedWith.length > 0 && (
									<div className="mt-3 flex flex-wrap gap-2">
										{sharedWith.map((email) => (
											<span
												key={email}
												className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700"
											>
												{email}
												<button
													type="button"
													onClick={() => removeEmail(email)}
													className="text-blue-600 hover:text-blue-800"
													aria-label={`Xóa ${email}`}
												>
													<X className="w-3 h-3" />
												</button>
											</span>
										))}
									</div>
								)}
							</div>

							<label className="flex items-center justify-between gap-6 rounded-2xl border border-gray-200 px-4 py-4">
								<div className="flex items-center gap-3">
									<ShieldCheck className="w-5 h-5 text-blue-600" />
									<div>
										<p className="text-sm font-medium text-gray-900">Enable TOTP cho file này</p>
										<p className="text-xs text-gray-500">Yêu cầu mã OTP khi người nhận tải xuống, áp dụng cùng mật khẩu để tăng bảo mật.</p>
									</div>
								</div>
								<input
									type="checkbox"
									checked={enableTOTP}
									onChange={(event) => setEnableTOTP(event.target.checked)}
									className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
								/>
							</label>
						</div>
					</section>

					<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
						<p className="text-sm text-gray-500">
							Kiểm tra kỹ thông tin trước khi gửi. Bạn có thể quản lý file sau khi đăng nhập.
						</p>
						<button
							type="submit"
							disabled={isSubmitting}
							className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed disabled:bg-blue-300"
						>
							{isSubmitting ? "Đang xử lý..." : "Upload ngay"}
						</button>
					</div>
				</form>

				{uploadResult && (
					<div className="mt-10 rounded-2xl border border-green-200 bg-green-50 p-6 space-y-6">
						<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
							<div className="flex items-start gap-3">
								<CheckCircle2 className="mt-1 h-5 w-5 text-green-600" />
								<div>
									<p className="text-sm font-semibold text-green-700">Upload thành công!</p>
									{uploadResult.message && (
										<p className="mt-1 text-sm text-green-600">{uploadResult.message}</p>
									)}
									<p className="mt-2 text-sm text-green-600">
										Chia sẻ thông tin bên dưới cho người nhận và lưu ý bảo mật mật khẩu/TOTP nếu bạn đã bật.
									</p>
									{uploadResult.file?.fileName && (
										<p className="mt-2 text-xs text-green-700">
											File: <span className="font-medium">{uploadResult.file.fileName}</span>
										</p>
									)}
									{uploadResult.file?.shareToken && (
										<p className="mt-1 text-xs text-green-700">
											Share token: <span className="font-mono">{uploadResult.file.shareToken}</span>
										</p>
									)}
									{uploadResult.file?.shareLink && (
										<div className="mt-3 rounded-lg bg-white px-4 py-3 text-sm text-gray-700 border border-green-100 break-all">
											{uploadResult.file.shareLink}
										</div>
									)}
								</div>
							</div>
							{uploadResult.file?.shareLink && (
								<button
									type="button"
									onClick={handleCopyShareLink}
									className="inline-flex items-center gap-2 rounded-lg border border-green-500 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
								>
									<Clipboard className="h-4 w-4" />
									Sao chép link
								</button>
							)}
						</div>
						{uploadResult.totpSetup && (
							<div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
								<div>
									<p className="text-sm font-semibold text-green-700">TOTP được bật cho file này</p>
									<p className="mt-1 text-xs text-green-600">
										Quét QR hoặc nhập secret bên dưới vào ứng dụng Google Authenticator/Authy, sau đó cung cấp mã TOTP cho người cần tải.
									</p>
									<div className="mt-3 rounded-lg bg-white px-4 py-3 text-xs text-gray-700 border border-green-100 break-all font-mono">
										Secret: {uploadResult.totpSetup.secret}
									</div>
								</div>
								{uploadResult.totpSetup.qrCode && (
									<div className="flex justify-center">
										<img
											src={uploadResult.totpSetup.qrCode}
											alt="QR code TOTP"
											className="h-32 w-32 rounded-xl border border-green-200 bg-white p-2 shadow-sm"
										/>
									</div>
								)}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
