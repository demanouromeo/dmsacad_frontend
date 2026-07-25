import { useState } from "react";
import { useLanguage } from "../../i18n/useLanguage";
import { adminMenuTranslations, subjectsHubTranslations } from "../../i18n/translations";
import AdminMenuCard from "./AdminMenuCard";
import SearchInput from "../sharedcomp/SearchInput";
import { ADMIN_MENU_ITEMS } from "./menuItems";

type SubjectsHubKey = keyof (typeof subjectsHubTranslations)["fr"];

// The 4 sub-modules reachable from the "subjects" card via SubjectsHub - the only functionality with
// subfunctionalities right now (see SubjectsHub.tsx). Searching one of their names (e.g.
// "compétences") still surfaces the parent "subjects" card below, since a subfunctionality has no
// card of its own on this grid.
const SUBJECT_SUB_ITEM_KEYS: SubjectsHubKey[] = [
  "matieres",
  "groupes",
  "matieresClasses",
  "matieresCompetences",
];

const AdminMenuGrid = () => {
  const [language] = useLanguage();
  const t = adminMenuTranslations[language];
  const hubT = subjectsHubTranslations[language];
  const [searchQuery, setSearchQuery] = useState("");

  const query = searchQuery.trim().toLowerCase();
  const matches = (text: string) => text.toLowerCase().includes(query);
  const filteredItems =
    query === ""
      ? ADMIN_MENU_ITEMS
      : ADMIN_MENU_ITEMS.filter(
          (item) =>
            matches(t[item.key]) ||
            (item.key === "subjects" &&
              SUBJECT_SUB_ITEM_KEYS.some((key) => matches(hubT[key]))),
        );

  return (
    <div>
      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={t.searchPlaceholder}
        className="w-full max-w-sm mb-6"
      />
      {filteredItems.length === 0 ? (
        <p className="opacity-60 text-center py-10">{t.searchNoResults}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
          {filteredItems.map((item) => (
            <AdminMenuCard
              key={item.key}
              label={t[item.key]}
              icon={item.icon}
              to={item.to}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminMenuGrid;
