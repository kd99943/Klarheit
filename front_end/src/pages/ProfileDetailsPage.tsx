import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Eye,
  FileText,
  Glasses,
  Heart,
  Mail,
  MapPin,
  Palette,
  Phone,
  Ruler,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthProvider";
import { useOrders } from "../hooks/useOrders";
import { formatDate } from "../lib/utils";
import { PageIntro } from "../components/ui/PageIntro";
import { SectionCard } from "../components/ui/SectionCard";
import { Button } from "../components/ui/Button";
import { PhoneBindingSection } from "../components/profile/PhoneBindingSection";

export function ProfileDetailsPage() {
  const { t } = useTranslation("profile");
  const { user } = useAuth();
  const { orders } = useOrders();

  const accountInitials = user
    ? `${user.firstName.slice(0, 1)}${user.lastName.slice(0, 1)}`.toUpperCase()
    : "KA";

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
            {/* Decorative grid pattern */}
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
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] font-semibold text-brand-cyan">
                    <ShieldCheck className="h-3 w-3" />
                    {t("verifiedBadge")}
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
                  <p className="mt-2 text-3xl font-display font-light text-white">{orders.length}</p>
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
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 overflow-hidden">
                <div className="grid grid-cols-2 divide-x divide-slate-200">
                  <div className="px-5 py-4 bg-white">
                    <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 text-center mb-4">{t("prescription.rightEye")}</p>
                    <div className="flex flex-col gap-3">
                      {[
                        { label: "SPH", value: "—" },
                        { label: "CYL", value: "—" },
                        { label: "AXIS", value: "—" },
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
                        { label: "SPH", value: "—" },
                        { label: "CYL", value: "—" },
                        { label: "AXIS", value: "—" },
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
                  <span className="text-sm font-mono font-medium text-brand-primary">— mm</span>
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
              className="xl:sticky xl:top-28"
            >
              <div className="flex flex-col gap-3">
                {[
                  { icon: UserRound, label: t("sidebar.actions.editProfile"), meta: t("sidebar.actions.editProfileMeta") },
                  { icon: MapPin, label: t("sidebar.actions.addresses"), meta: t("sidebar.actions.addressesMeta") },
                  { icon: CreditCard, label: t("sidebar.actions.billing"), meta: t("sidebar.actions.billingMeta"), to: "/checkout" },
                  { icon: CalendarDays, label: t("sidebar.actions.appointments"), meta: t("sidebar.actions.appointmentsMeta") },
                ].map((item) => {
                  const content = (
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
                  );
                  return item.to ? (
                    <Link key={item.label} to={item.to}>{content}</Link>
                  ) : (
                    <div key={item.label}>{content}</div>
                  );
                })}
              </div>
            </SectionCard>

            {/* Account Security */}
            <SectionCard
              eyebrow={t("sidebar.security.eyebrow")}
              title={t("sidebar.security.title")}
              description={t("sidebar.security.description")}
            >
              <div className="flex flex-col gap-3 text-sm text-slate-600">
                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-4">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-brand-cyan shrink-0" />
                  <span>{t("sidebar.security.emailVerified")}</span>
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

            {/* Danger Zone */}
            <SectionCard
              eyebrow={t("sidebar.danger.eyebrow")}
              title={t("sidebar.danger.title")}
              description={t("sidebar.danger.description")}
            >
              <div className="flex flex-col gap-3">
                <button className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50/50 px-4 py-4 text-left text-sm text-red-600 transition-colors hover:bg-red-50">
                  <span>{t("sidebar.danger.changePassword")}</span>
                  <ChevronRight className="h-4 w-4 text-red-400" strokeWidth={1.5} />
                </button>
                <button className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50/50 px-4 py-4 text-left text-sm text-red-600 transition-colors hover:bg-red-50">
                  <span>{t("sidebar.danger.deleteAccount")}</span>
                  <ChevronRight className="h-4 w-4 text-red-400" strokeWidth={1.5} />
                </button>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
