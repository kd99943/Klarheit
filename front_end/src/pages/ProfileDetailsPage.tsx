import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Compass,
  Eye,
  FileText,
  Glasses,
  Heart,
  KeyRound,
  Mail,
  MapPin,
  Palette,
  Ruler,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthProvider";
import { useCart } from "../hooks/useCart";
import { useOrders } from "../hooks/useOrders";
import { PageIntro } from "../components/ui/PageIntro";
import { SectionCard } from "../components/ui/SectionCard";
import { Button } from "../components/ui/Button";
import { PhoneBindingSection } from "../components/profile/PhoneBindingSection";
import {
  changePassword,
  fetchLatestPrescription,
  type PrescriptionRecord,
} from "../services/api";

export function ProfileDetailsPage() {
  const { t } = useTranslation("profile");
  const { t: tAccount } = useTranslation("account");
  const { user } = useAuth();
  const { clearPrivateData } = useCart();
  const { orders, error: ordersError } = useOrders();

  const [latestRx, setLatestRx] = useState<PrescriptionRecord | null>(null);
  const [deviceDataNotice, setDeviceDataNotice] = useState<string | null>(null);

  // Change password modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);

  // Delete / export guidance modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (!showPasswordModal && !showDeleteModal) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowPasswordModal(false);
        setShowDeleteModal(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showPasswordModal, showDeleteModal]);

  useEffect(() => {
    let active = true;
    fetchLatestPrescription()
      .then((rx) => {
        if (active && rx) setLatestRx(rx);
      })
      .catch(() => {
        // No saved prescription yet
      });
    return () => {
      active = false;
    };
  }, []);

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(null);
    if (newPwd !== confirmPwd) {
      setPwdError(t("passwordModal.mismatch"));
      return;
    }
    setPwdBusy(true);
    try {
      await changePassword(currentPwd, newPwd);
      setPwdSuccess(t("passwordModal.success"));
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setPwdBusy(false);
    }
  };

  const handleClearDeviceData = () => {
    clearPrivateData();
    setDeviceDataNotice(t("sidebar.danger.deviceDataCleared"));
  };

  const accountInitials = user
    ? `${user.firstName.slice(0, 1)}${user.lastName.slice(0, 1)}`.toUpperCase()
    : "KA";

  const formatDiopter = (val?: number | null) =>
    val === undefined || val === null ? "—" : `${val > 0 ? "+" : ""}${val.toFixed(2)}`;

  return (
    <div className="flex-1 w-full bg-surface-offwhite px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8">
        {/* Back Navigation */}
        <Link
          to="/my-account"
          className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 hover:text-brand-primary transition-colors w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          {t("backToAccount")}
        </Link>

        <PageIntro
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />

        {/* Hero Identity Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_24px_60px_-42px_rgba(15,23,42,0.28)] overflow-hidden">
          <div className="bg-brand-primary px-6 py-8 sm:px-10 sm:py-10 relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
            <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-2xl font-display font-medium tracking-widest text-white">
                {accountInitials}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl sm:text-3xl font-display font-light text-white tracking-tight">
                  {user ? `${user.firstName} ${user.lastName}` : t("defaultName")}
                </h2>
                <p className="mt-1 text-sm text-white/60 font-light">
                  {user?.email ?? t("defaultEmail")}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] font-semibold ${
                    user?.phoneVerified ? "text-brand-cyan" : "text-white/75"
                  }`}>
                    <ShieldCheck className="h-3 w-3" />
                    {user?.phoneVerified ? t("verifiedBadge") : t("unverifiedBadge")}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] font-semibold text-white/70">
                    <CalendarDays className="h-3 w-3" />
                    {t("memberSinceBadge")}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] font-semibold text-white/70">
                    <Sparkles className="h-3 w-3" />
                    {t("tierBadge")}
                  </span>
                </div>
              </div>
              <div className="hidden sm:block">
                <div className="rounded-xl bg-white/8 backdrop-blur-sm border border-white/10 px-5 py-4 text-center">
                  <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-white/45">{t("ordersCount")}</p>
                  {ordersError ? (
                    <>
                      <p className="mt-2 text-3xl font-display font-light text-white/40">—</p>
                      <p className="mt-1 text-[10px] text-red-300 leading-tight">{ordersError}</p>
                    </>
                  ) : (
                    <p className="mt-2 text-3xl font-display font-light text-white">{orders.length}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-8">
            {/* Personal Information */}
            <SectionCard
              eyebrow={t("personalInfo.eyebrow")}
              title={t("personalInfo.title")}
              description={t("personalInfo.description")}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-5 py-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary/5">
                      <UserRound className="h-4 w-4 text-brand-primary" strokeWidth={1.5} />
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("personalInfo.firstName")}</p>
                  </div>
                  <p className="text-lg font-display font-medium text-brand-primary">
                    {user?.firstName ?? "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-5 py-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary/5">
                      <UserRound className="h-4 w-4 text-brand-primary" strokeWidth={1.5} />
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("personalInfo.lastName")}</p>
                  </div>
                  <p className="text-lg font-display font-medium text-brand-primary">
                    {user?.lastName ?? "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-5 py-4 sm:col-span-2">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary/5">
                      <Mail className="h-4 w-4 text-brand-primary" strokeWidth={1.5} />
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("personalInfo.email")}</p>
                  </div>
                  <p className="text-lg font-display font-medium text-brand-primary">
                    {user?.email ?? "—"}
                  </p>
                </div>
                <PhoneBindingSection />
              </div>
            </SectionCard>

            {/* Optical Prescription Profile */}
            <SectionCard
              eyebrow={t("prescription.eyebrow")}
              title={t("prescription.title")}
              description={t("prescription.description")}
            >
              {!latestRx && (
                <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  {t("prescription.emptyHint")}
                </div>
              )}
              {latestRx?.wearerName && (
                <p className="mb-3 text-xs text-slate-600">
                  <span className="font-semibold text-brand-primary">{t("prescription.wearer")}: </span>
                  {latestRx.wearerName}
                </p>
              )}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 overflow-hidden">
                <div className="grid grid-cols-2 divide-x divide-slate-200">
                  <div className="px-5 py-4 bg-white">
                    <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 text-center mb-4">{t("prescription.rightEye")}</p>
                    <div className="flex flex-col gap-3">
                      {[
                        { label: "SPH", value: formatDiopter(latestRx?.sphOd) },
                        { label: "CYL", value: formatDiopter(latestRx?.cylOd) },
                        { label: "AXIS", value: latestRx ? `${latestRx.axisOd}°` : "—" },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{item.label}</span>
                          <span className="text-sm font-mono font-medium text-brand-primary">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="px-5 py-4 bg-white">
                    <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 text-center mb-4">{t("prescription.leftEye")}</p>
                    <div className="flex flex-col gap-3">
                      {[
                        { label: "SPH", value: formatDiopter(latestRx?.sphOs) },
                        { label: "CYL", value: formatDiopter(latestRx?.cylOs) },
                        { label: "AXIS", value: latestRx ? `${latestRx.axisOs}°` : "—" },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{item.label}</span>
                          <span className="text-sm font-mono font-medium text-brand-primary">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="border-t border-slate-200 px-5 py-4 bg-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Ruler className="h-4 w-4 text-brand-cyan" strokeWidth={1.5} />
                    <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("prescription.pd")}</span>
                  </div>
                  <span className="text-sm font-mono font-medium text-brand-primary">
                    {latestRx ? `${latestRx.pd.toFixed(1)} mm` : "— mm"}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <Link to="/config-lab" className="flex-1">
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-4 transition-colors hover:bg-slate-50 group">
                    <span className="flex items-center gap-3 text-sm text-brand-primary">
                      <FileText className="h-4 w-4" strokeWidth={1.5} />
                      {t("prescription.updateBtn")}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-brand-primary transition-colors" strokeWidth={1.5} />
                  </div>
                </Link>
                <Link to="/virtual-studio" className="flex-1">
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-4 transition-colors hover:bg-slate-50 group">
                    <span className="flex items-center gap-3 text-sm text-brand-primary">
                      <Eye className="h-4 w-4" strokeWidth={1.5} />
                      {t("prescription.arTryOn")}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-brand-primary transition-colors" strokeWidth={1.5} />
                  </div>
                </Link>
              </div>
            </SectionCard>

            {/* Style Preferences */}
            <SectionCard
              eyebrow={t("style.eyebrow")}
              title={t("style.title")}
              description={t("style.description")}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white px-5 py-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/5">
                      <Glasses className="h-4 w-4 text-brand-primary" strokeWidth={1.5} />
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("style.faceShape")}</p>
                  </div>
                  <p className="text-sm font-medium text-brand-primary">{t("style.faceShapeValue")}</p>
                  <p className="mt-1 text-xs text-slate-400 font-light">{t("style.faceShapeHint")}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-5 py-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/5">
                      <Palette className="h-4 w-4 text-brand-primary" strokeWidth={1.5} />
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("style.material")}</p>
                  </div>
                  <p className="text-sm font-medium text-brand-primary">{t("style.materialValue")}</p>
                  <p className="mt-1 text-xs text-slate-400 font-light">{t("style.materialHint")}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-5 py-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/5">
                      <Heart className="h-4 w-4 text-brand-primary" strokeWidth={1.5} />
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("style.preferredStyle")}</p>
                  </div>
                  <p className="text-sm font-medium text-brand-primary">{t("style.preferredStyleValue")}</p>
                  <p className="mt-1 text-xs text-slate-400 font-light">{t("style.preferredStyleHint")}</p>
                </div>
              </div>
              <div className="mt-5 rounded-2xl bg-brand-primary px-5 py-5 text-white">
                <div className="flex items-center gap-2 text-brand-cyan">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-[10px] uppercase tracking-[0.2em] font-semibold">{t("style.aiRecommendation")}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-white/80">{t("style.aiRecommendationText")}</p>
                <Link to="/virtual-studio" className="mt-4 inline-block">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-[10px] uppercase tracking-[0.18em] font-semibold text-white hover:bg-white/20 transition-colors">
                    {t("style.startARTryOn")}
                    <ChevronRight className="h-3 w-3" strokeWidth={2} />
                  </div>
                </Link>
              </div>
            </SectionCard>
          </div>

          {/* Right Sidebar */}
          <div className="flex flex-col gap-6">
            {/* Quick Actions */}
            <SectionCard
              eyebrow={t("sidebar.actions.eyebrow")}
              title={t("sidebar.actions.title")}
              description={t("sidebar.actions.description")}
            >
              <div className="flex flex-col gap-3">
                {[
                  { icon: MapPin, label: t("sidebar.actions.addresses"), meta: t("sidebar.actions.addressesMeta"), to: "/addresses" },
                  { icon: Compass, label: tAccount("quickActions.browseCatalog"), meta: tAccount("quickActions.browseCatalogMeta"), to: "/collections" },
                  { icon: ShoppingBag, label: tAccount("quickActions.cart"), meta: tAccount("quickActions.cartMeta"), to: "/cart" },
                  { icon: FileText, label: tAccount("ordersPage.title"), meta: t("ordersCount"), to: "/my-orders" },
                ].map((item) => (
                  <Link key={item.to} to={item.to}>
                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-left transition-colors hover:bg-slate-50 group">
                      <span className="flex items-center gap-3 text-sm text-brand-primary">
                        <item.icon className="h-4 w-4" strokeWidth={1.5} />
                        {item.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{item.meta}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-brand-primary transition-colors" strokeWidth={1.5} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </SectionCard>

            {/* Account Security */}
            <SectionCard
              eyebrow={t("sidebar.security.eyebrow")}
              title={t("sidebar.security.title")}
              description={t("sidebar.security.description")}
            >
              <div className="flex flex-col gap-3 text-xs leading-5 text-slate-600">
                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-4">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-brand-cyan shrink-0" />
                  <span>{t("sidebar.security.emailVerified")}</span>
                </div>
                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-4">
                  <ShieldCheck className={`mt-0.5 h-4 w-4 shrink-0 ${user?.phoneVerified ? "text-emerald-600" : "text-slate-400"}`} />
                  <span>
                    {user?.phoneVerified
                      ? t("sidebar.security.phoneStatusVerified")
                      : t("sidebar.security.phoneStatusUnverified")}
                  </span>
                </div>
                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-4">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-brand-cyan shrink-0" />
                  <span>{t("sidebar.security.dataEncrypted")}</span>
                </div>
                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-4">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-brand-cyan shrink-0" />
                  <span>{t("sidebar.security.sessionActive")}</span>
                </div>
              </div>
            </SectionCard>

            {/* Security Actions & Privacy Cleanup */}
            <SectionCard
              eyebrow={t("sidebar.danger.eyebrow")}
              title={t("sidebar.danger.title")}
              description={t("sidebar.danger.description")}
            >
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPwdError(null);
                    setPwdSuccess(null);
                    setShowPasswordModal(true);
                  }}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left text-sm text-brand-primary transition-colors hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2.5">
                    <KeyRound className="h-4 w-4 text-slate-400" strokeWidth={1.5} />
                    {t("sidebar.danger.changePassword")}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400" strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  onClick={handleClearDeviceData}
                  className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50/50 px-4 py-4 text-left text-sm text-amber-800 transition-colors hover:bg-amber-50"
                >
                  <span className="flex items-center gap-2.5">
                    <Trash2 className="h-4 w-4 text-amber-600" strokeWidth={1.5} />
                    {t("sidebar.danger.clearDeviceData")}
                  </span>
                  <ChevronRight className="h-4 w-4 text-amber-500" strokeWidth={1.5} />
                </button>
                {deviceDataNotice && (
                  <p className="text-xs text-emerald-700 px-1">{deviceDataNotice}</p>
                )}
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50/50 px-4 py-4 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
                >
                  <span>{t("sidebar.danger.deleteAccount")}</span>
                  <ChevronRight className="h-4 w-4 text-red-400" strokeWidth={1.5} />
                </button>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
          onClick={() => setShowPasswordModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-password-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="profile-password-modal-title" className="text-lg font-display font-medium text-brand-primary">{t("passwordModal.title")}</h3>
              <button
                type="button"
                aria-label={t("addresses.close")}
                onClick={() => setShowPasswordModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1.5">
                  {t("passwordModal.current")}
                </label>
                <input
                  type="password"
                  required
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-brand-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1.5">
                  {t("passwordModal.new")}
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-brand-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1.5">
                  {t("passwordModal.confirm")}
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-brand-primary focus:outline-none"
                />
              </div>
              {pwdError && <p className="text-xs text-red-600">{pwdError}</p>}
              {pwdSuccess && <p className="text-xs text-emerald-600">{pwdSuccess}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline-light" size="sm" onClick={() => setShowPasswordModal(false)}>
                  {t("addresses.cancel")}
                </Button>
                <Button type="submit" size="sm" disabled={pwdBusy}>
                  {t("passwordModal.submit")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account Deletion / Export Guidance Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-delete-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 id="profile-delete-modal-title" className="text-lg font-display font-medium text-brand-primary">{t("deleteModal.title")}</h3>
              <button
                type="button"
                aria-label={t("addresses.close")}
                onClick={() => setShowDeleteModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{t("deleteModal.desc")}</p>
            <p className="text-xs text-slate-500 rounded-xl bg-slate-50 border border-slate-200 p-3.5">
              {t("deleteModal.contact")}
            </p>
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={() => setShowDeleteModal(false)}>
                {t("deleteModal.close")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
