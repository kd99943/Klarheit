import { type FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Phone, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../auth/AuthProvider";
import { sendSmsCode, verifyAndBindPhone } from "../../services/api";

type BindStep = "idle" | "phone" | "code" | "success";

export function PhoneBindingSection() {
  const { t } = useTranslation("profile");
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState<BindStep>(user?.phone ? "idle" : "idle");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const isPhoneBound = user?.phone && user?.phoneVerified;

  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError(t("personalInfo.invalidPhone"));
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

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (code.length !== 6) return;
    setIsLoading(true);
    try {
      await verifyAndBindPhone(phone, code);
      await refreshUser();
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "验证失败");
    } finally {
      setIsLoading(false);
    }
  }

  // Already bound — show status
  if (isPhoneBound && step === "idle") {
    const masked = user.phone!.length >= 11
      ? user.phone!.substring(0, 3) + "****" + user.phone!.substring(7)
      : user.phone;
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-5 py-4 sm:col-span-2">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary/5">
            <Phone className="h-4 w-4 text-brand-primary" strokeWidth={1.5} />
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("personalInfo.phone")}</p>
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.15em] font-semibold text-brand-cyan">
            <CheckCircle2 className="h-3 w-3" />
            {t("personalInfo.phoneBound")}
          </span>
        </div>
        <p className="text-lg font-display font-medium text-brand-primary">{masked}</p>
      </div>
    );
  }

  // Success state
  if (step === "success") {
    return (
      <div className="rounded-xl border border-brand-cyan/30 bg-brand-cyan/5 px-5 py-4 sm:col-span-2">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-cyan/10">
            <CheckCircle2 className="h-4 w-4 text-brand-cyan" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium text-brand-primary">{t("personalInfo.bindSuccess")}</p>
        </div>
        <button
          onClick={() => setStep("idle")}
          className="text-xs text-slate-400 hover:text-brand-primary transition-colors"
        >
          OK
        </button>
      </div>
    );
  }

  // Binding flow
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-5 py-4 sm:col-span-2">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary/5">
          <Phone className="h-4 w-4 text-brand-primary" strokeWidth={1.5} />
        </div>
        <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("personalInfo.phone")}</p>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 text-red-700 px-3 py-2 rounded-lg text-xs mb-4">
          {error}
        </div>
      )}

      {step === "idle" && (
        <button
          onClick={() => setStep("phone")}
          className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-4 py-2.5 text-[10px] uppercase tracking-[0.18em] font-semibold text-white hover:bg-brand-primary/90 transition-colors"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          {t("personalInfo.bindPhone")}
        </button>
      )}

      {step === "phone" && (
        <form className="flex flex-col gap-4" onSubmit={handleSendCode}>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400 font-medium shrink-0">+86</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              maxLength={11}
              placeholder="138 0000 0000"
              className="flex-1 bg-transparent border-0 border-b border-slate-300 py-2.5 px-0 focus:ring-0 focus:border-brand-primary outline-none transition-colors text-lg font-medium text-brand-primary rounded-none placeholder:text-slate-300"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setStep("idle"); setError(null); }}
              className="px-4 py-2 text-xs text-slate-400 hover:text-brand-primary transition-colors"
            >
              取消
            </button>
            <button
              disabled={isLoading || phone.length !== 11}
              className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-4 py-2.5 text-[10px] uppercase tracking-[0.18em] font-semibold text-white hover:bg-brand-primary/90 transition-colors disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {t("personalInfo.sendCode")}
            </button>
          </div>
        </form>
      )}

      {step === "code" && (
        <form className="flex flex-col gap-4" onSubmit={handleVerify}>
          <p className="text-xs text-slate-400">
            {t("personalInfo.codeSent")} +86 {phone}
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            className="w-full bg-transparent border-0 border-b border-slate-300 py-2.5 px-0 focus:ring-0 focus:border-brand-primary outline-none transition-colors text-2xl font-mono font-medium text-brand-primary tracking-[0.5em] rounded-none placeholder:text-slate-300"
            autoFocus
          />
          {cooldown > 0 ? (
            <p className="text-xs text-slate-400">
              {t("personalInfo.resendCode").replace("{seconds}", String(cooldown))}
            </p>
          ) : (
            <button
              type="button"
              onClick={async () => {
                setIsLoading(true);
                try {
                  await sendSmsCode(phone);
                  setCooldown(60);
                } catch { /* silent */ }
                finally { setIsLoading(false); }
              }}
              className="text-xs text-brand-primary hover:underline text-left"
            >
              {t("personalInfo.sendCode")}
            </button>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setStep("phone"); setCode(""); setError(null); }}
              className="px-4 py-2 text-xs text-slate-400 hover:text-brand-primary transition-colors"
            >
              返回
            </button>
            <button
              disabled={isLoading || code.length !== 6}
              className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-4 py-2.5 text-[10px] uppercase tracking-[0.18em] font-semibold text-white hover:bg-brand-primary/90 transition-colors disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {t("personalInfo.verify")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
