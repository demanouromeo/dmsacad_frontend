import { useLanguage } from "../../../i18n/useLanguage";
import { accountHubTranslations } from "../../../i18n/translations";
import AdminMenuCard from "../../dashboard/AdminMenuCard";
import iconAllCredentials from "../../../assets/compo/account/all_credentials.png";
import iconCredential from "../../../assets/compo/account/credential.png";

// Landing page for the "Gestion du compte" dashboard card - its 2 sub-modules, both built:
// "allCredentials" (AccountManager - ADMIN-only, manages every staff/administrateur account) and
// "myCredential" (SelfCredentialsManager - any authenticated role, self-service login/password
// change). Same SubjectsHub/FillRateHub pattern. Only ADMIN ever reaches this hub itself (via the
// AdminMenuGrid card, unchanged) - non-ADMIN roles reach SelfCredentialsManager directly from a
// button on Dashboard.tsx instead, since they never see AdminMenuGrid.
const AccountHub = () => {
  const [language] = useLanguage();
  const t = accountHubTranslations[language];

  const items: { key: string; label: string; icon: string; to?: string }[] = [
    {
      key: "allCredentials",
      label: t.allCredentials,
      icon: iconAllCredentials,
      to: "/admin/manage-accounts/all",
    },
    {
      key: "myCredential",
      label: t.myCredential,
      icon: iconCredential,
      to: "/account/credentials",
    },
  ];

  return (
    <div className="p-10 flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-6">{t.title}</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 max-w-3xl justify-items-center">
        {items.map((item) => (
          <AdminMenuCard key={item.key} label={item.label} icon={item.icon} to={item.to} />
        ))}
      </div>
    </div>
  );
};

export default AccountHub;
