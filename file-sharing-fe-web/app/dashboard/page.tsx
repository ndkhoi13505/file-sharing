"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, File as FileType, UserResponse, UserFilesResponse } from "@/lib/components/schemas";
import { getUserProfile, disableTotp, changePassword } from "@/lib/api/auth";
import { deleteFile, getUserFiles } from "@/lib/api/file";
import { ShieldCheck, ShieldOff, Loader, KeyRound, Trash2 } from "lucide-react";
import { setCurrentUser } from "@/lib/api/helper";
import { toast } from "sonner";
import { ChangePasswordRequest } from "@/lib/components/schemas";

type DashboardProfileResponse = {
  user: User;
  files: FileType[];
  summary: {
    activeFiles: number;
    pendingFiles: number;
    expiredFiles: number;
    deletedFiles: number;
  };
  pagination: {
    currentPage: number;
    totalPages: number;
    totalFiles: number;
    limit: number;
  };
};

export default function Dashboard() {
  const [userProfile, setUserProfile] = useState<DashboardProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // TOTP Disable State
  const [showTotpInput, setShowTotpInput] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Change Password Modal State
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changePasswordTotp, setChangePasswordTotp] = useState("");
  const [useTotpForPasswordChange, setUseTotpForPasswordChange] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // New state for filtering, sorting, and pagination
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalFiles: 0,
    limit: 20,
  });

  const router = useRouter();

  useEffect(() => {
    const fetchProfileAndFiles = async () => {
      setIsLoading(true);
      try {
        const userRes = await getUserProfile();
        setCurrentUser(userRes.user);

        const filesRes = await getUserFiles({
          status: statusFilter,
          page: currentPage,
          limit: pagination.limit,
          sortBy,
          order: sortOrder,
        });
        
        setUserProfile({
          user: userRes.user,
          files: filesRes.files,
          summary: filesRes.summary,
          pagination: filesRes.pagination,
        });
        setPagination(filesRes.pagination);

      } catch (err: any) {
        if (err.message.includes("Unauthorized")) {
          router.push("/login");
        } else {
          setError("Failed to fetch dashboard data.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileAndFiles();
  }, [router, statusFilter, sortBy, sortOrder, currentPage, pagination.limit]);

  const handleDisableTotp = async () => {
    if (!totpCode) {
      toast.error("Please enter the TOTP code.");
      return;
    }
    setIsSubmitting(true);
    try {
      await disableTotp(totpCode);
      // Refresh profile to show updated TOTP status
      const userRes = await getUserProfile();
      setUserProfile((prev) => {
        const base = prev ? { ...prev } : {
          files: [],
          summary: { activeFiles: 0, pendingFiles: 0, expiredFiles: 0, deletedFiles: 0 },
          pagination: { currentPage: 1, totalPages: 1, totalFiles: 0, limit: 20 },
        };
        return {
          ...base,
          user: userRes.user,
        };
      });
      setShowTotpInput(false);
      setTotpCode("");
      toast.success("TOTP has been disabled successfully.");
    } catch (err: any) {
      toast.error(`Failed to disable TOTP: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (fileId: string) => {
    if (window.confirm("Are you sure you want to delete this file? This action cannot be undone.")) {
      try {
        await deleteFile(fileId);
        toast.success("File deleted successfully");
        // Re-fetch files and summary after deletion by triggering the useEffect
        setCurrentPage(1);
      } catch (err: any) {
        toast.error(`Failed to delete file: ${err.message}`);
      }
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters long.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const payload: ChangePasswordRequest = { newPassword };
      if (useTotpForPasswordChange) {
        if (!changePasswordTotp) {
          toast.error("Please enter the TOTP code.");
          setIsChangingPassword(false);
          return;
        }
        payload.totpCode = changePasswordTotp;
      } else {
        if (!oldPassword) {
          toast.error("Please enter your old password.");
          setIsChangingPassword(false);
          return;
        }
        payload.oldPassword = oldPassword;
      }

      await changePassword(payload);
      toast.success("Password changed successfully.");
      setShowChangePasswordModal(false);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setChangePasswordTotp("");
    } catch (err: any) {
      toast.error(`Failed to change password: ${err.message}`);
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader className="animate-spin h-8 w-8 text-gray-500" />
        <p className="ml-2 text-gray-500">Loading your dashboard...</p>
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-500">{error}</div>;
  }

  if (!userProfile || !userProfile.user) {
    return null; // or a fallback UI
  }

  const { user, files, summary } = userProfile;

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <div className="bg-white shadow-md rounded-lg p-6 mb-8">
        <h1 className="text-2xl font-bold mb-4">Welcome, {user.username}!</h1>
        <p className="text-gray-600">Email: {user.email}</p>
        <p className="text-gray-600 mb-6">Role: {user.role}</p>

        <div className="flex items-center gap-4">
            <button
                onClick={() => setShowChangePasswordModal(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
                Change Password
            </button>
        </div>

        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Two-Factor Authentication (2FA)</h2>
          {user.totpEnabled ? (
            <div className="flex items-center gap-4">
              <span className="flex items-center text-green-600">
                <ShieldCheck className="h-5 w-5 mr-1" />
                2FA is Enabled
              </span>
              <button
                onClick={() => setShowTotpInput(!showTotpInput)}
                className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
              >
                Disable 2FA
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <span className="flex items-center text-red-600">
                <ShieldOff className="h-5 w-5 mr-1" />
                2FA is Not Enabled
              </span>
              <Link href="/totp-setup" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                Enable 2FA
              </Link>
            </div>
          )}

          {showTotpInput && (
            <div className="mt-4 p-4 border rounded-lg bg-gray-50">
                <label htmlFor="totp-code" className="block text-sm font-medium text-gray-700 mb-2">Enter TOTP Code to Disable</label>
                <div className="flex gap-2">
                    <div className="relative rounded-md shadow-sm flex-grow">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <KeyRound className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            id="totp-code"
                            value={totpCode}
                            onChange={(e) => setTotpCode(e.target.value)}
                            className="block w-full rounded-md border-gray-300 pl-10 focus:border-indigo-500 focus:ring-indigo-500 lg:text-lg"
                            placeholder="6-digit code"
                            maxLength={6}
                        />
                    </div>
                    <button
                        onClick={handleDisableTotp}
                        disabled={isSubmitting || totpCode.length !== 6}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                        {isSubmitting && <Loader className="animate-spin h-4 w-4 mr-2" />}
                        Confirm & Disable
                    </button>
                </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Your Files</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center mb-6">
            <div className="p-4 bg-blue-100 rounded-lg">
                <p className="text-2xl font-bold">{summary.activeFiles}</p>
                <p className="text-sm text-blue-800">Active</p>
            </div>
            <div className="p-4 bg-gray-100 rounded-lg">
                <p className="text-2xl font-bold">{summary.pendingFiles}</p>
                <p className="text-sm text-gray-800">Pending</p>
            </div>
            <div className="p-4 bg-yellow-100 rounded-lg">
                <p className="text-2xl font-bold">{summary.expiredFiles}</p>
                <p className="text-sm text-yellow-800">Expired</p>
            </div>
            <div className="p-4 bg-red-100 rounded-lg">
                <p className="text-2xl font-bold">{summary.deletedFiles}</p>
                <p className="text-sm text-red-800">Deleted</p>
            </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            <div>
              <label htmlFor="status-filter" className="sr-only">Filter by status</label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div>
              <label htmlFor="sort-by" className="sr-only">Sort by</label>
              <select
                id="sort-by"
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [newSortBy, newSortOrder] = e.target.value.split('-');
                  setSortBy(newSortBy);
                  setSortOrder(newSortOrder);
                }}
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                <option value="createdAt-desc">Newest First</option>
                <option value="createdAt-asc">Oldest First</option>
                <option value="fileName-asc">Name (A-Z)</option>
                <option value="fileName-desc">Name (Z-A)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => { setSortBy("fileName"); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}}>File Name</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => { setSortBy("createdAt"); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}}>Created At</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {files.length > 0 ? (
                files.map((file) => (
                  <tr key={file.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link href={`/f/${file.shareToken}`} className="text-indigo-600 hover:text-indigo-900">
                        {file.fileName}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            file.status === 'active' ? 'bg-green-100 text-green-800' :
                            file.status === 'expired' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                        }`}>
                            {file.status}
                        </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(file.createdAt).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => handleDelete(file.id)} className="text-red-600 hover:text-red-900">
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">You have not uploaded any files yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{(currentPage - 1) * pagination.limit + 1}</span> to <span className="font-medium">{Math.min(currentPage * pagination.limit, pagination.totalFiles)}</span> of{' '}
              <span className="font-medium">{pagination.totalFiles}</span> results
            </p>
          </div>
          <div>
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100"
              >
                Previous
              </button>
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium ${currentPage === page ? 'text-indigo-600 bg-indigo-50' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === pagination.totalPages}
                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:bg-gray-100"
              >
                Next
              </button>
            </nav>
          </div>
        </div>
      </div>

      {showChangePasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Change Password</h2>
            
            {user.totpEnabled && (
              <div className="flex items-center justify-center mb-4">
                <label className="mr-4">Use: </label>
                <button 
                  onClick={() => setUseTotpForPasswordChange(false)}
                  className={`px-4 py-2 text-sm rounded-l-md ${!useTotpForPasswordChange ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
                >
                  Old Password
                </button>
                <button 
                  onClick={() => setUseTotpForPasswordChange(true)}
                  className={`px-4 py-2 text-sm rounded-r-md ${useTotpForPasswordChange ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
                >
                  TOTP Code
                </button>
              </div>
            )}

            <div className="space-y-4">
              {!useTotpForPasswordChange ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Old Password</label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-lg p-2"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700">TOTP Code</label>
                  <input
                    type="text"
                    value={changePasswordTotp}
                    onChange={(e) => setChangePasswordTotp(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-lg p-2"
                    maxLength={6}
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-lg p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-lg p-2"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-4">
              <button
                onClick={() => setShowChangePasswordModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleChangePassword}
                disabled={isChangingPassword}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-400"
              >
                {isChangingPassword && <Loader className="animate-spin h-4 w-4 mr-2" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
