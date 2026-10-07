import { ChangePasswordForm } from "@/components/change-password-form";
import { requireUser } from "@/lib/auth";
import { uiText as text } from "@/lib/ui";

export default async function ChangePasswordPage() {
  await requireUser();

  return (
    <section className="mx-auto w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-semibold text-slate-950">{text.changePassword}</h1>
      <p className="mt-3 text-sm text-slate-600">{text.changePasswordHint}</p>
      <ChangePasswordForm text={{
        currentPassword: text.currentPassword,
        newPassword: text.newPassword,
        confirmPassword: text.confirmPassword,
        changePassword: text.changePassword,
        changingPassword: text.changingPassword,
      }} />
    </section>
  );
}
