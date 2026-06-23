import { type FormEvent, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Phone, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { sendSmsCode, resetPasswordViaSms } from "../../services/api";

type Step = "phone" | "code" | "password" | "success";

interface Props {
  onBack: () => void;
}

export function ForgotPasswordFlow({ onBack }: Props) {
  const { t } = useTranslation("common");
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError(t("auth.phoneRequired"));
      return;
    }
    setIsLoading(true);
    try {
      await sendSmsCode(phone);
      setCooldown(60);
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (code.length !== 6) {
      setError(t("auth.codeRequired"));
      return;
    }
    setStep("password");
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) return;
    if (newPassword !== confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    setIsLoading(true);
    try {
      await resetPasswordViaSms(phone, code, newPassword);
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "重置失败");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Back Button */}
      {step !== "success" && (
        <button
          type="button"
          onClick={step === "phone" ? onBack : () => setStep("phone")}
          className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 hover:text-brand-primary transition-colors w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          {step === "phone" ? t("auth.backToSignIn") : t("auth.backToSignIn")}
        </button>
      )}

      {/* Header */}
      <div>
        <h3 className="text-3xl font-display font-light text-brand-primary mb-3">
          {step === "success" ? t("auth.passwordResetSuccess") : t("auth.resetPassword")}
        </h3>
        <p className="text-sm text-slate-500 font-light">
          {step === "success" ? "" : t("auth.resetPasswordDesc")}
        </p>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Step: Enter Phone */}
      {step === "phone" && (
        <form className="flex flex-col gap-6" onSubmit={handleSendCode}>
          <div className="flex flex-col gap-2 relative group">
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest group-focus-within:text-brand-primary transition-colors">
              {t("auth.phoneNumber", "手机号")}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400 font-medium">+86</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                maxLength={11}
                placeholder="138 0000 0000"
                className="flex-1 bg-transparent border-0 border-b border-slate-300 py-3 px-0 focus:ring-0 focus:border-brand-primary outline-none transition-colors text-lg font-medium text-brand-primary rounded-none placeholder:text-slate-300"
              />
            </div>
          </div>

          <button
            disabled={isLoading || phone.length !== 11}
            className="w-full bg-brand-primary text-white py-4 text-xs font-bold uppercase tracking-[0.2em] hover:bg-brand-primary/90 transition-colors rounded-sm shadow-[0_10px_20px_rgba(11,32,70,0.15)] flex justify-center items-center gap-2 disabled:opacity-70"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Phone className="h-4 w-4" />
            )}
            {t("auth.sendCode", "发送验证码")}
          </button>
        </form>
      )}

      {/* Step: Enter Code */}
      {step === "code" && (
        <form className="flex flex-col gap-6" onSubmit={handleVerifyCode}>
          <div className="flex flex-col gap-2 relative group">
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest group-focus-within:text-brand-primary transition-colors">
              {t("auth.verificationCode", "验证码")}
            </label>
            <p className="text-xs text-slate-400 mb-2">
              {t("auth.codeSentTo", "验证码已发送至")} +86 {phone}
            </p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              className="w-full bg-transparent border-0 border-b border-slate-300 py-3 px-0 focus:ring-0 focus:border-brand-primary outline-none transition-colors text-2xl font-mono font-medium text-brand-primary tracking-[0.5em] rounded-none placeholder:text-slate-300"
              autoFocus
            />
          </div>

          {cooldown > 0 ? (
            <p className="text-xs text-slate-400 text-center">
              {t("auth.resendCode", "重新发送 ({seconds}s)").replace("{seconds}", String(cooldown))}
            </p>
          ) : (
            <button
              type="button"
              onClick={async () => {
                setIsLoading(true);
                try {
                  await sendSmsCode(phone);
                  setCooldown(60);
                } catch {
                  // silent
                } finally {
                  setIsLoading(false);
                }
              }}
              className="text-xs text-brand-primary hover:underline text-center"
            >
              {t("auth.sendCode", "重新发送验证码")}
            </button>
          )}

          <button
            disabled={code.length !== 6}
            className="w-full bg-brand-primary text-white py-4 text-xs font-bold uppercase tracking-[0.2em] hover:bg-brand-primary/90 transition-colors rounded-sm shadow-[0_10px_20px_rgba(11,32,70,0.15)] flex justify-center items-center gap-2 disabled:opacity-70"
          >
            <ShieldCheck className="h-4 w-4" />
            {t("auth.verifyCode", "验证")}
          </button>
        </form>
      )}

      {/* Step: New Password */}
      {step === "password" && (
        <form className="flex flex-col gap-6" onSubmit={handleResetPassword}>
          <div className="flex flex-col gap-2 relative group">
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest group-focus-within:text-brand-primary transition-colors">
              {t("auth.newPassword")}
            </label>
            <input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              type="password"
              required
              minLength={8}
              placeholder="••••••••"
              className="w-full bg-transparent border-0 border-b border-slate-300 py-3 px-0 focus:ring-0 focus:border-brand-primary outline-none transition-colors text-lg font-medium text-brand-primary rounded-none placeholder:text-slate-300"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2 relative group">
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest group-focus-within:text-brand-primary transition-colors">
              {t("auth.confirmNewPassword")}
            </label>
            <input
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              type="password"
              required
              minLength={8}
              placeholder="••••••••"
              className="w-full bg-transparent border-0 border-b border-slate-300 py-3 px-0 focus:ring-0 focus:border-brand-primary outline-none transition-colors text-lg font-medium text-brand-primary rounded-none placeholder:text-slate-300"
            />
          </div>

          <button
            disabled={isLoading || newPassword.length < 8 || newPassword !== confirmPassword}
            className="w-full bg-brand-primary text-white py-4 text-xs font-bold uppercase tracking-[0.2em] hover:bg-brand-primary/90 transition-colors rounded-sm shadow-[0_10px_20px_rgba(11,32,70,0.15)] flex justify-center items-center gap-2 disabled:opacity-70"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            {t("auth.resetPassword")}
          </button>
        </form>
      )}

      {/* Step: Success */}
      {step === "success" && (
        <div className="flex flex-col items-center gap-6 py-4">
          <CheckCircle2 className="h-12 w-12 text-brand-cyan" />
          <p className="text-sm text-slate-600 text-center">
            {t("auth.passwordResetSuccess")}
          </p>
          <button
            onClick={onBack}
            className="w-full bg-brand-primary text-white py-4 text-xs font-bold uppercase tracking-[0.2em] hover:bg-brand-primary/90 transition-colors rounded-sm"
          >
            {t("auth.backToSignIn")}
          </button>
        </div>
      )}
    </div>
  );
}
