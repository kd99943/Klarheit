import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, MapPin, Trash2, Edit2, CheckCircle2, ShieldCheck } from "lucide-react";
import { fetchAddresses, createAddress, updateAddress, deleteAddress, setDefaultAddress, type AddressResponse } from "../services/api";
import { Button } from "../components/ui/Button";
import { PageIntro } from "../components/ui/PageIntro";
import { SectionCard } from "../components/ui/SectionCard";
import { track } from "../services/analytics";

export function AddressesPage() {
  const { t } = useTranslation("profile");

  const [addresses, setAddresses] = useState<AddressResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [detailAddress, setDetailAddress] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  // 用于操作类（删除、设为默认）失败时的非阻塞提示，3 秒后自动消失
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!actionError) return;
    const timer = setTimeout(() => setActionError(null), 3000);
    return () => clearTimeout(timer);
  }, [actionError]);

  useEffect(() => {
    if (!showModal) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowModal(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showModal]);

  async function loadAddresses() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAddresses();
      setAddresses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load saved addresses.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAddresses();
  }, []);

  function handleOpenCreate() {
    setEditingId(null);
    setRecipientName("");
    setPhoneNumber("");
    setProvince("");
    setCity("");
    setDistrict("");
    setDetailAddress("");
    setIsDefault(false);
    setFormError(null);
    setShowModal(true);
  }

  function handleOpenEdit(addr: AddressResponse) {
    setEditingId(addr.id);
    setRecipientName(addr.recipientName);
    setPhoneNumber(addr.phoneNumber);
    setProvince(addr.province);
    setCity(addr.city);
    setDistrict(addr.district || "");
    setDetailAddress(addr.detailAddress);
    setIsDefault(addr.isDefault);
    setFormError(null);
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const payload = {
      recipientName: recipientName.trim(),
      phoneNumber: phoneNumber.trim(),
      province: province.trim(),
      city: city.trim(),
      district: district.trim() || undefined,
      detailAddress: detailAddress.trim(),
      isDefault,
    };

    if (!payload.recipientName || !payload.phoneNumber || !payload.province || !payload.city || !payload.detailAddress) {
      setFormError(t("addresses.requiredFieldsError"));
      return;
    }

    try {
      if (editingId) {
        await updateAddress(editingId, payload);
      } else {
        await createAddress(payload);
        track("address_added", {});
      }
      setShowModal(false);
      void loadAddresses();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save address.");
    }
  }

  async function handleDelete(id: number) {
    if (confirm(t("addresses.confirmDelete"))) {
      try {
        await deleteAddress(id);
        track("address_deleted", {});
        void loadAddresses();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Failed to delete address.");
      }
    }
  }

  async function handleSetDefault(id: number) {
    try {
      await setDefaultAddress(id);
      void loadAddresses();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to set default address.");
    }
  }

  return (
    <div className="flex-1 w-full bg-surface-offwhite px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8">
        {/* Back Link */}
        <Link
          to="/profile-details"
          className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 hover:text-brand-primary transition-colors w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          {t("addresses.backToProfile")}
        </Link>

        <PageIntro
          eyebrow={t("addresses.eyebrow")}
          title={t("addresses.title")}
          description={t("addresses.description")}
          actions={
            <Button variant="outline-light" className="flex items-center gap-2" onClick={handleOpenCreate}>
              <Plus className="w-4 h-4" />
              {t("addresses.addNew")}
            </Button>
          }
        />

        {actionError && (
          <div
            role="alert"
            className="fixed top-6 right-6 z-50 max-w-sm rounded-2xl border border-red-200 bg-red-50 px-5 py-4 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300"
          >
            <p className="text-sm text-red-700">{actionError}</p>
          </div>
        )}

        {isLoading ? (
          <p className="text-center text-sm text-slate-500 py-10">{t("addresses.loading")}</p>
        ) : error ? (
          <p className="text-center text-sm text-red-500 py-10">{error}</p>
        ) : addresses.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 border-dashed bg-white px-5 py-12 text-center max-w-xl mx-auto w-full">
            <MapPin className="mx-auto w-10 h-10 text-slate-300 mb-4" strokeWidth={1.5} />
            <p className="text-sm text-slate-500 font-medium">{t("addresses.empty")}</p>
            <Button variant="outline-light" className="mt-4 text-xs" onClick={handleOpenCreate}>
              {t("addresses.addFirst")}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {addresses.map((addr) => (
              <div
                key={addr.id}
                className={`rounded-[24px] border bg-white p-6 shadow-sm flex flex-col justify-between gap-6 transition-all duration-300 ${
                  addr.isDefault ? "border-brand-cyan ring-1 ring-brand-cyan/20" : "border-slate-200"
                }`}
              >
                <div>
                  <div className="flex justify-between items-start gap-4 mb-4">
                    <span className="font-display font-medium text-brand-primary text-lg">
                      {addr.recipientName}
                    </span>
                    {addr.isDefault && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-cyan/15 px-2.5 py-1 text-[9px] uppercase tracking-wider font-semibold text-brand-cyan">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t("addresses.defaultBadge")}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-brand-primary font-mono mb-2">{addr.phoneNumber}</p>
                  <p className="text-sm text-slate-500 leading-relaxed font-light">
                    {addr.province} {addr.city} {addr.district || ""}
                    <br />
                    {addr.detailAddress}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenEdit(addr)}
                      className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-brand-primary text-slate-400 transition-colors"
                      title={t("addresses.edit")}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(addr.id)}
                      className="p-2 border border-red-100 text-red-400 rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors"
                      title={t("addresses.delete")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {!addr.isDefault && (
                    <button
                      onClick={() => handleSetDefault(addr.id)}
                      className="text-xs font-semibold text-brand-cyan hover:underline"
                    >
                      {t("addresses.setAsDefault")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create/Edit Address Modal Overlay */}
        {showModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-brand-primary/40 backdrop-blur-sm p-4"
            onClick={() => setShowModal(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="address-modal-title"
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[32px] border border-slate-200/50 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            >
              <div className="bg-brand-primary px-6 py-6 text-white flex justify-between items-center">
                <h3 id="address-modal-title" className="font-display font-medium text-lg tracking-wide text-white">
                  {editingId ? t("addresses.editTitle") : t("addresses.addTitle")}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-white/70 hover:text-white text-sm uppercase tracking-widest font-semibold"
                >
                  {t("addresses.close")}
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
                {formError && <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl p-3">{formError}</p>}

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {t("addresses.recipientName")}
                    </label>
                    <input
                      type="text"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      required
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {t("addresses.phoneNumber")}
                    </label>
                    <input
                      type="text"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      required
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {t("addresses.province")}
                    </label>
                    <input
                      type="text"
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      required
                      placeholder={t("addresses.provincePlaceholder")}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {t("addresses.city")}
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                      placeholder={t("addresses.cityPlaceholder")}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {t("addresses.district")}
                    </label>
                    <input
                      type="text"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      placeholder={t("addresses.districtPlaceholder")}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    {t("addresses.detailAddress")}
                  </label>
                  <input
                    type="text"
                    value={detailAddress}
                    onChange={(e) => setDetailAddress(e.target.value)}
                    required
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary"
                  />
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    id="isDefaultCheckbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-cyan border-slate-300 focus:ring-brand-cyan"
                  />
                  <label htmlFor="isDefaultCheckbox" className="text-xs font-semibold text-brand-primary cursor-pointer select-none">
                    {t("addresses.setAsDefaultShipping")}
                  </label>
                </div>

                <div className="flex gap-3 justify-end mt-4 border-t border-slate-100 pt-4">
                  <Button type="button" variant="outline-light" onClick={() => setShowModal(false)}>
                    {t("addresses.cancel")}
                  </Button>
                  <Button type="submit" variant="primary">
                    {t("addresses.save")}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
