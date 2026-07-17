import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Upload } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useLanguage } from "../../../i18n/useLanguage";
import { schoolInfoTranslations } from "../../../i18n/translations";
import { MyConstants } from "../../../dbmanger/MyConstants";
import { SchoolInfoReader } from "../../../dbmanger/SchoolInfoReader";
import {
  EMPTY_SCHOOL_CONFIG,
  type SchoolConfig,
} from "../../../interfaces/SchoolConfig";
import {
  SCHOOL_TYPES,
  computeResponsable,
  type Responsable,
} from "../../../utils/schoolTypes";
import { sanitizeSchoolInfoText } from "../../../utils/textValidation";
import type { SchoolHeaderConfig } from "../../../interfaces/SchoolHeaderConfig";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";

const todayIsoDate = (): string => new Date().toISOString().slice(0, 10);

const loadStoredConfig = (): SchoolConfig => {
  const stored = sessionStorage.getItem(MyConstants.SCHOOL_CONFIG_KEY);
  if (!stored) {
    return {
      ...EMPTY_SCHOOL_CONFIG,
      type: MyConstants.DEFAULT_SCHOOL_TYPE,
      signDate: todayIsoDate(),
    };
  }
  try {
    return { ...EMPTY_SCHOOL_CONFIG, ...JSON.parse(stored) };
  } catch {
    return {
      ...EMPTY_SCHOOL_CONFIG,
      type: MyConstants.DEFAULT_SCHOOL_TYPE,
      signDate: todayIsoDate(),
    };
  }
};

const loadStoredResponsable = (): Responsable => ({
  fr:
    sessionStorage.getItem(MyConstants.RESPONSABLE_FR_KEY) ||
    MyConstants.DEFAULT_RESPONSABLE_FR,
  en:
    sessionStorage.getItem(MyConstants.RESPONSABLE_EN_KEY) ||
    MyConstants.DEFAULT_RESPONSABLE_EN,
});

const persistResponsable = (responsable: Responsable) => {
  sessionStorage.setItem(MyConstants.RESPONSABLE_FR_KEY, responsable.fr);
  sessionStorage.setItem(MyConstants.RESPONSABLE_EN_KEY, responsable.en);
};

const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// Maps the raw allSchoolConfigOfYear row (snake_case DB columns, str1/str2 aliased to
// ref_transfert/ref_document server-side) onto the form's request-param-named fields.
const mapHeaderConfigToFields = (config: SchoolHeaderConfig): SchoolConfig => ({
  schoolName: config.name_fr ?? "",
  schoolNameEN: config.name_en ?? "",
  delRegionFR: config.del_regionale_fr ?? "",
  delRegionEN: config.del_regionale_en ?? "",
  delDeptFR: config.del_dept_fr ?? "",
  delDeptEN: config.del_dept_en ?? "",
  phone: config.phone1 !== null && config.phone1 !== undefined
    ? String(config.phone1)
    : "",
  email: config.email ?? "",
  pobox: config.pobox ?? "",
  type: config.type || MyConstants.DEFAULT_SCHOOL_TYPE,
  signDate: config.date_signature
    ? config.date_signature.slice(0, 10)
    : todayIsoDate(),
  signPlace: config.lieu_signature ?? "",
  immt: config.school_matricule ?? "",
  str1: config.ref_transfert ?? "",
  str2: config.ref_document ?? "",
});

const SchoolInfoManager = () => {
  const { connection, schoolYear, accessToken } = useAuth();
  const showToast = useToast();
  const [language] = useLanguage();
  const t = schoolInfoTranslations[language];

  const [fields, setFields] = useState<SchoolConfig>(loadStoredConfig);
  const [responsable, setResponsable] = useState<Responsable>(
    loadStoredResponsable,
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ensure the three session variables the rest of the app relies on exist as soon as this
  // screen loads, not only after a save - mirrors the spec's "must be created with these
  // defaults" requirement rather than leaving them unset until the first successful save.
  useEffect(() => {
    if (!sessionStorage.getItem(MyConstants.SCHOOL_TYPE_KEY)) {
      sessionStorage.setItem(
        MyConstants.SCHOOL_TYPE_KEY,
        MyConstants.DEFAULT_SCHOOL_TYPE,
      );
    }
    if (!sessionStorage.getItem(MyConstants.RESPONSABLE_FR_KEY)) {
      persistResponsable(loadStoredResponsable());
    }
  }, []);

  // Re-fetch the current year's saved config every time this screen is opened (and whenever the
  // top-bar year/school switch changes it under us) rather than trusting the sessionStorage draft,
  // since another admin/session may have saved a newer version server-side in the meantime.
  useEffect(() => {
    let cancelled = false;
    const loadExistingConfig = async () => {
      setIsLoading(true);
      const config = await SchoolInfoReader.fetchSchoolConfigOfYear(
        accessToken,
        connection,
        schoolYear,
      );
      if (cancelled) {
        return;
      }
      if (config) {
        const mapped = mapHeaderConfigToFields(config);
        setFields(mapped);
        const nextResponsable = computeResponsable(mapped.type);
        setResponsable(nextResponsable);
        sessionStorage.setItem(MyConstants.SCHOOL_TYPE_KEY, mapped.type);
        persistResponsable(nextResponsable);
      }
      // Trust the backend's own recorded logo_path (from this same response) rather than
      // guessing the file extension - see SchoolInfoReader.loadLogoImage.
      const logoImage = await SchoolInfoReader.loadLogoImage(config?.logo_path);
      if (cancelled) {
        return;
      }
      setExistingLogoUrl(logoImage ? logoImage.src : null);
      setLogoFile(null);
      setLogoPreviewUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev);
        }
        return null;
      });
      setIsLoading(false);
    };
    loadExistingConfig();
    return () => {
      cancelled = true;
    };
  }, [connection, schoolYear, accessToken]);

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl]);

  const updateField = (key: keyof SchoolConfig, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const type = e.target.value;
    updateField("type", type);
    const nextResponsable = computeResponsable(type);
    setResponsable(nextResponsable);
    sessionStorage.setItem(MyConstants.SCHOOL_TYPE_KEY, type);
    persistResponsable(nextResponsable);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setLogoFile(file);
    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }
    setLogoPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedPhone = fields.phone.trim();
    if (
      !fields.schoolName.trim() ||
      !fields.schoolNameEN.trim() ||
      !trimmedPhone ||
      !fields.signDate ||
      !fields.signPlace.trim()
    ) {
      showToast(t.requiredHint, { type: "warning" });
      return;
    }
    if (trimmedPhone.length < 5 || trimmedPhone.length > 10) {
      showToast(t.invalidPhone, { type: "warning" });
      return;
    }
    if (fields.email.trim() && !isValidEmail(fields.email.trim())) {
      showToast(t.invalidEmail, { type: "warning" });
      return;
    }

    setIsSaving(true);
    const result = await SchoolInfoReader.saveSchoolInfo(
      accessToken,
      connection,
      schoolYear,
      fields,
      logoFile,
    );
    setIsSaving(false);

    if (result.status) {
      showToast(t.saveSuccess, { type: "info" });
      sessionStorage.setItem(
        MyConstants.SCHOOL_CONFIG_KEY,
        JSON.stringify(fields),
      );
    } else {
      showToast(t.saveFailure, { type: "danger" });
    }
  };

  const responsableName =
    language === "fr" ? responsable.fr : responsable.en;

  return (
    <div className="p-10">
      {isSaving && <LoadingOverlay />}
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 text-center">{t.title}</h1>
        <p className="mb-6 opacity-70 text-sm text-center">
          {t.requiredHint}
        </p>

        {isLoading ? (
          <Loading />
        ) : (
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
        <div>
          <label className="label" htmlFor="schoolName">
            {t.schoolNameLabel} <span className="text-error">*</span>
          </label>
          <input
            id="schoolName"
            type="text"
            className="input w-full"
            required
            value={fields.schoolName}
            onChange={(e) =>
              updateField("schoolName", sanitizeSchoolInfoText(e.target.value))
            }
          />
        </div>

        <div>
          <label className="label" htmlFor="schoolNameEN">
            {t.schoolNameENLabel} <span className="text-error">*</span>
          </label>
          <input
            id="schoolNameEN"
            type="text"
            className="input w-full"
            required
            value={fields.schoolNameEN}
            onChange={(e) =>
              updateField(
                "schoolNameEN",
                sanitizeSchoolInfoText(e.target.value),
              )
            }
          />
        </div>

        <div>
          <label className="label" htmlFor="delRegionFR">
            {t.regionLabel}
          </label>
          <input
            id="delRegionFR"
            type="text"
            className="input w-full"
            value={fields.delRegionFR}
            onChange={(e) =>
              updateField(
                "delRegionFR",
                sanitizeSchoolInfoText(e.target.value),
              )
            }
          />
        </div>

        <div>
          <label className="label" htmlFor="delRegionEN">
            {t.regionENLabel}
          </label>
          <input
            id="delRegionEN"
            type="text"
            className="input w-full"
            value={fields.delRegionEN}
            onChange={(e) =>
              updateField(
                "delRegionEN",
                sanitizeSchoolInfoText(e.target.value),
              )
            }
          />
        </div>

        <div>
          <label className="label" htmlFor="delDeptFR">
            {t.deptLabel}
          </label>
          <input
            id="delDeptFR"
            type="text"
            className="input w-full"
            value={fields.delDeptFR}
            onChange={(e) =>
              updateField("delDeptFR", sanitizeSchoolInfoText(e.target.value))
            }
          />
        </div>

        <div>
          <label className="label" htmlFor="delDeptEN">
            {t.deptENLabel}
          </label>
          <input
            id="delDeptEN"
            type="text"
            className="input w-full"
            value={fields.delDeptEN}
            onChange={(e) =>
              updateField("delDeptEN", sanitizeSchoolInfoText(e.target.value))
            }
          />
        </div>

        <div>
          <label className="label" htmlFor="phone">
            {t.phoneLabel} <span className="text-error">*</span>
          </label>
          <input
            id="phone"
            type="tel"
            className="input w-full"
            required
            value={fields.phone}
            onChange={(e) => updateField("phone", e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="email">
            {t.emailLabel}
          </label>
          <input
            id="email"
            type="email"
            className="input w-full"
            value={fields.email}
            onChange={(e) => updateField("email", e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="pobox">
            {t.poboxLabel}
          </label>
          <input
            id="pobox"
            type="text"
            className="input w-full"
            value={fields.pobox}
            onChange={(e) =>
              updateField("pobox", sanitizeSchoolInfoText(e.target.value))
            }
          />
        </div>

        <div>
          <label className="label" htmlFor="type">
            {t.typeLabel}
          </label>
          <select
            id="type"
            className="select w-full"
            value={fields.type}
            onChange={handleTypeChange}
          >
            {SCHOOL_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm opacity-70">
            {t.responsableLabel(responsableName)}
          </p>
        </div>

        <div>
          <label className="label" htmlFor="signDate">
            {t.signDateLabel} <span className="text-error">*</span>
          </label>
          <input
            id="signDate"
            type="date"
            className="input w-full"
            required
            value={fields.signDate}
            onChange={(e) => updateField("signDate", e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="immt">
            {t.immtLabel}
          </label>
          <input
            id="immt"
            type="text"
            className="input w-full"
            value={fields.immt}
            onChange={(e) =>
              updateField("immt", sanitizeSchoolInfoText(e.target.value))
            }
          />
        </div>

        <div>
          <label className="label" htmlFor="str1">
            {t.str1Label}
          </label>
          <input
            id="str1"
            type="text"
            className="input w-full"
            value={fields.str1}
            onChange={(e) =>
              updateField("str1", sanitizeSchoolInfoText(e.target.value))
            }
          />
        </div>

        <div>
          <label className="label" htmlFor="str2">
            {t.str2Label}
          </label>
          <input
            id="str2"
            type="text"
            className="input w-full"
            value={fields.str2}
            onChange={(e) =>
              updateField("str2", sanitizeSchoolInfoText(e.target.value))
            }
          />
        </div>

        <div>
          <label className="label" htmlFor="signPlace">
            {t.signPlaceLabel} <span className="text-error">*</span>
          </label>
          <input
            id="signPlace"
            type="text"
            className="input w-full"
            required
            value={fields.signPlace}
            onChange={(e) =>
              updateField("signPlace", sanitizeSchoolInfoText(e.target.value))
            }
          />
        </div>

        <div className="md:col-span-2 flex items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/jpg"
            className="hidden"
            onChange={handleLogoChange}
          />
          <button
            type="button"
            className="btn btn-neutral gap-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4" />
            {t.selectFileBtn}
          </button>
          <div className="w-30 h-30 shrink-0 rounded border flex items-center justify-center overflow-hidden bg-base-200">
            {logoPreviewUrl || existingLogoUrl ? (
              <img
                src={logoPreviewUrl ?? existingLogoUrl ?? undefined}
                alt=""
                className="w-full h-full object-contain"
              />
            ) : (
              <ImageIcon className="w-8 h-8 opacity-40" />
            )}
          </div>
          {!logoPreviewUrl && existingLogoUrl && (
            <p className="text-sm opacity-70">{t.logoReselectHint}</p>
          )}
        </div>

        <div className="md:col-span-2 flex justify-center">
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {t.saveBtn}
          </button>
        </div>
        </form>
        )}
      </div>
    </div>
  );
};

export default SchoolInfoManager;
