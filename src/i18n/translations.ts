export type Language = "fr" | "en";

export const loginTranslations = {
  fr: {
    title: "Connexion",
    loginLabel: "Login",
    loginPlaceholder: "Login ou code utilisateur",
    passwordLabel: "Mot de passe",
    passwordPlaceholder: "Mot de passe",
    schoolLabel: "Choisissez l'établissement",
    currentSchool: "Ecole actuelle: ",
    schoolYearLabel: "Choisissez l'année scolaire",
    currentSchoolYear: "Année scolaire actuelle: ",
    sectionLabel: "Section",
    francoLabel: "Franco",
    anglophoneLabel: "Anglophone",
    settingsBtn: "Paramètres",
    settingsTitle: "Paramètres de connexion",
    remoteBtn: "Distant",
    localBtn: "Local",
    closeBtn: "Fermer",
    submitBtn: "Se connecter",
    invalidCredentials: "Login ou mot de passe incorrect.",
    alertNoSchool: (school: string) =>
      `Veuillez sélectionner une école [${school}]`,
    alertBadCredentials: (school: string) =>
      `Login ou mot de passe incorrect \nECOLE:[${school}]`,
  },
  en: {
    title: "Login",
    loginLabel: "Username",
    loginPlaceholder: "Username or user code",
    passwordLabel: "Password",
    passwordPlaceholder: "Password",
    schoolLabel: "Select your school",
    currentSchool: "Current school: ",
    schoolYearLabel: "Select the school year",
    currentSchoolYear: "Current school year: ",
    sectionLabel: "Section",
    francoLabel: "Franco",
    anglophoneLabel: "Anglophone",
    settingsBtn: "Settings",
    settingsTitle: "Connection settings",
    remoteBtn: "Remote",
    localBtn: "Local",
    closeBtn: "Close",
    submitBtn: "Sign in",
    invalidCredentials: "Incorrect username or password.",
    alertNoSchool: (school: string) => `Please select a school [${school}]`,
    alertBadCredentials: (school: string) =>
      `Incorrect username or password \nSCHOOL:[${school}]`,
  },
};

export const bannerTranslations = {
  fr: {
    logoAlt: "Logo de l'établissement",
    backHint: "Retour à la page précédente",
    homeHint: "Aller au tableau de bord",
    schoolYearHint: "Changer l'année scolaire",
    sectionHint: "Changer la section",
    languageHint: "Changer la langue",
    profileHint: "Profil",
    schoolYearDialogTitle: "Changer l'année scolaire",
    sectionDialogTitle: "Changer la section",
    francoLabel: "Franco",
    anglophoneLabel: "Anglophone",
    saveBtn: "Enregistrer",
    cancelBtn: "Annuler",
  },
  en: {
    logoAlt: "School logo",
    backHint: "Back to the previous page",
    homeHint: "Go to dashboard",
    schoolYearHint: "Change the school year",
    sectionHint: "Change the section",
    languageHint: "Change the language",
    profileHint: "Profile",
    schoolYearDialogTitle: "Change the school year",
    sectionDialogTitle: "Change the section",
    francoLabel: "Franco",
    anglophoneLabel: "Anglophone",
    saveBtn: "Save",
    cancelBtn: "Cancel",
  },
};

export const confirmTranslations = {
  fr: {
    defaultTitle: "Confirmation",
    confirmBtn: "Confirmer",
    cancelBtn: "Annuler",
  },
  en: {
    defaultTitle: "Confirmation",
    confirmBtn: "Confirm",
    cancelBtn: "Cancel",
  },
};

export const exportTranslations = {
  fr: {
    excelBtn: "Exporter en Excel",
    pdfBtn: "Exporter en PDF",
  },
  en: {
    excelBtn: "Export to Excel",
    pdfBtn: "Export to PDF",
  },
};

export const dashboardTranslations = {
  fr: {
    logoutBtn: "Déconnexion",
  },
  en: {
    logoutBtn: "Logout",
  },
};

export const filiereManagerTranslations = {
  fr: {
    title: "Filières",
    sectionHint: (section: string) =>
      `Section : ${section} — utilisez l'icône section dans la barre du haut pour changer de section.`,
    tableHeaderIndex: "Nº",
    tableHeaderName: "Nom de la filière",
    emptySection: "Aucune filière pour cette section.",
    searchPlaceholder: "Rechercher une filière…",
    noSearchResults: "Aucune filière ne correspond à cette recherche.",
    saveBtn: "Enregistrer",
    cancelBtn: "Annuler",
    editBtn: "Modifier",
    deleteSelectionBtn: (count: number) => `Supprimer la sélection (${count})`,
    deleteConfirm: (count: number) => `Supprimer ${count} filière(s) ?`,
    addPlaceholder: "Nouvelle filière",
    addBtn: "Ajouter",
    nameTooShort: (min: number) =>
      `Le nom de la filière doit contenir au moins ${min} caractères.`,
    addSuccess: "Filière enregistrée avec succès.",
    addDuplicate:
      "Échec de l'enregistrement du nom de la filière, car une filière portant le même nom existe déjà (dans cette section ou dans une autre section).",
    addFailure: "Échec de l'ajout de la filière.",
    renameSuccess: "Filière mise à jour avec succès.",
    renameDuplicate:
      "Échec de la mise à jour du nom de la filière, car une filière portant le même nom existe déjà (dans cette section ou dans une autre section).",
    renameFailure: "Échec du renommage de la filière.",
    deleteSuccess: "Filière supprimée avec succès.",
    deleteFailure: "Échec de la suppression d'au moins une filière.",
  },
  en: {
    title: "Options",
    sectionHint: (section: string) =>
      `Section: ${section} — use the section icon in the top bar to switch sections.`,
    tableHeaderIndex: "Nº",
    tableHeaderName: "Option name",
    emptySection: "No option for this section.",
    searchPlaceholder: "Search an option…",
    noSearchResults: "No option matches this search.",
    saveBtn: "Save",
    cancelBtn: "Cancel",
    editBtn: "Edit",
    deleteSelectionBtn: (count: number) => `Delete selection (${count})`,
    deleteConfirm: (count: number) => `Delete ${count} option(s)?`,
    addPlaceholder: "New option",
    addBtn: "Add",
    nameTooShort: (min: number) =>
      `The option name must contain at least ${min} characters.`,
    addSuccess: "Option saved successfully.",
    addDuplicate:
      "Failed to save the option name, because an option with the same name already exists (within the section or in another section).",
    addFailure: "Failed to add the option.",
    renameSuccess: "Option successfully updated.",
    renameDuplicate:
      "Failed to update the option name, because an option with the same name already exists (within the section or in another section).",
    renameFailure: "Failed to rename the option.",
    deleteSuccess: "Option successfully deleted.",
    deleteFailure: "Failed to delete at least one option.",
  },
};

export const specialityManagerTranslations = {
  fr: {
    title: "Spécialités",
    sectionHint: (section: string) =>
      `Section : ${section} — utilisez l'icône section dans la barre du haut pour changer de section.`,
    tableHeaderIndex: "Nº",
    tableHeaderName: "Nom de la spécialité",
    tableHeaderFiliere: "Filière",
    tableHeaderDescription: "Description",
    emptySection: "Aucune spécialité pour cette section.",
    searchPlaceholder: "Rechercher une spécialité…",
    noSearchResults: "Aucune spécialité ne correspond à cette recherche.",
    saveBtn: "Enregistrer",
    cancelBtn: "Annuler",
    editBtn: "Modifier",
    deleteSelectionBtn: (count: number) => `Supprimer la sélection (${count})`,
    deleteConfirm: (count: number) => `Supprimer ${count} spécialité(s) ?`,
    noFiliereOption: "Aucune filière",
    addPlaceholder: "Nouvelle spécialité",
    descriptionPlaceholder: "Description (optionnel)",
    addBtn: "Ajouter",
    createFiliereFirst: "Créez d'abord une filière pour cette section.",
    nameTooShort: (min: number) =>
      `Le nom de la spécialité doit contenir au moins ${min} caractères.`,
    addSuccess: "Spécialité enregistrée avec succès.",
    addDuplicate:
      "Échec de l'enregistrement du nom de la spécialité, car une spécialité portant le même nom existe déjà (dans cette section ou dans une autre section).",
    addFailure: "Échec de l'ajout de la spécialité.",
    updateSuccess: "Spécialité mise à jour avec succès.",
    updateDuplicate:
      "Échec de la mise à jour du nom de la spécialité, car une spécialité portant le même nom existe déjà (dans cette section ou dans une autre section).",
    updateFailure: "Échec de la modification de la spécialité.",
    deleteSuccess: "Spécialité supprimée avec succès.",
    deleteFailure: "Échec de la suppression d'au moins une spécialité.",
  },
  en: {
    title: "Specialities",
    sectionHint: (section: string) =>
      `Section: ${section} — use the section icon in the top bar to switch sections.`,
    tableHeaderIndex: "Nº",
    tableHeaderName: "Speciality name",
    tableHeaderFiliere: "Option",
    tableHeaderDescription: "Description",
    emptySection: "No speciality for this section.",
    searchPlaceholder: "Search a speciality…",
    noSearchResults: "No speciality matches this search.",
    saveBtn: "Save",
    cancelBtn: "Cancel",
    editBtn: "Edit",
    deleteSelectionBtn: (count: number) => `Delete selection (${count})`,
    deleteConfirm: (count: number) => `Delete ${count} speciality(ies)?`,
    noFiliereOption: "No option",
    addPlaceholder: "New speciality",
    descriptionPlaceholder: "Description (optional)",
    addBtn: "Add",
    createFiliereFirst: "First create an option for this section.",
    nameTooShort: (min: number) =>
      `The speciality name must contain at least ${min} characters.`,
    addSuccess: "Speciality saved successfully.",
    addDuplicate:
      "Failed to save the speciality name, because a speciality with the same name already exists (within the section or in another section).",
    addFailure: "Failed to add the speciality.",
    updateSuccess: "Speciality successfully updated.",
    updateDuplicate:
      "Failed to update the speciality name, because a speciality with the same name already exists (within the section or in another section).",
    updateFailure: "Failed to update the speciality.",
    deleteSuccess: "Speciality deleted successfully.",
    deleteFailure: "Failed to delete at least one speciality.",
  },
};

export const classeManagerTranslations = {
  fr: {
    title: "Classes",
    sectionHint: (section: string) =>
      `Section : ${section} — utilisez l'icône section dans la barre du haut pour changer de section.`,
    tableHeaderIndex: "Nº",
    tableHeaderName: "Nom de la classe",
    tableHeaderLevel: "Niveau",
    tableHeaderSpeciality: "Spécialité",
    tableHeaderClasseMaster: "Titulaire",
    tableHeaderSg: "SG",
    tableHeaderApc: "APC",
    apcYes: "OUI",
    apcNo: "NON",
    apcLabel: "APC ?",
    apcUpdateSuccess: "Statut APC mis à jour avec succès.",
    apcUpdateFailure: "Échec de la mise à jour du statut APC.",
    emptySection: "Aucune classe pour cette section.",
    searchPlaceholder: "Rechercher une classe…",
    noSearchResults: "Aucune classe ne correspond à cette recherche.",
    saveBtn: "Enregistrer",
    cancelBtn: "Annuler",
    editBtn: "Modifier",
    deleteSelectionBtn: (count: number) => `Supprimer la sélection (${count})`,
    deleteConfirm: (count: number) => `Supprimer ${count} classe(s) ?`,
    noSpecialityOption: "Aucune spécialité",
    noClasseMasterOption: "Aucun titulaire",
    noSgOption: "Aucun SG",
    addPlaceholder: "Nouvelle classe",
    levelPlaceholder: "Niveau",
    addBtn: "Ajouter",
    nameTooShort: (min: number) =>
      `Le nom de la classe doit contenir au moins ${min} caractères.`,
    levelInvalid: (max: number) =>
      `Le niveau doit être un nombre entier compris entre 1 et ${max}.`,
    addSuccess: "Classe enregistrée avec succès.",
    addDuplicate:
      "Échec de l'enregistrement du nom de la classe, car une classe portant le même nom existe déjà (dans cette section ou dans une autre section).",
    addFailure: "Échec de l'ajout de la classe.",
    updateSuccess: "Classe mise à jour avec succès.",
    updateDuplicate:
      "Échec de la mise à jour du nom de la classe, car une classe portant le même nom existe déjà (dans cette section ou dans une autre section).",
    updateFailure: "Échec de la modification de la classe.",
    deleteSuccess: "Classe supprimée avec succès.",
    deleteFailure: "Échec de la suppression d'au moins une classe.",
    importBtn: "Importer",
    importUnsupportedExtension:
      "Format de fichier non pris en charge. Utilisez un fichier .xlsx ou .csv.",
    importEmptyFile:
      "Le fichier est vide ou ne contient aucune ligne de données.",
    importBadHeader:
      "Le fichier ne respecte pas la structure attendue : la première ligne doit contenir trois colonnes.",
    importEmptyName: (row: number) =>
      `Le fichier ne respecte pas la structure attendue : le nom de la classe est vide (ligne ${row}, colonne B).`,
    importInvalidLevel: (row: number) =>
      `Le fichier ne respecte pas la structure attendue : le niveau doit être un nombre (ligne ${row}, colonne C).`,
    importOverrideQuestion:
      "Voulez-vous supprimer toutes les classes existantes de la section et de l'année scolaire en cours avant d'importer les nouvelles classes ?",
    importOverrideBtn: "Supprimer",
    importAddWithoutOverrideBtn: "Ne pas supprimer",
    importOverrideConfirmAgain:
      "Cette action supprimera définitivement toutes les classes existantes de la section et de l'année scolaire en cours. Confirmez-vous ?",
    importOverrideFinalBtn: "Oui, supprimer",
    importDuplicateFound: (name: string, row: number) =>
      `Le fichier contient une classe déjà existante dans la base de données : "${name}" (ligne ${row}, colonne B). Import annulé.`,
    importDeleteFailure:
      "Échec de la suppression des classes existantes. L'import a été annulé.",
    importSuccess: (count: number) =>
      `${count} classe(s) importée(s) avec succès.`,
    importFailure: "Échec de l'import des classes.",
    importFailureDetail: (detail: string) =>
      `Échec de l'import des classes. Détails : ${detail}`,
  },
  en: {
    title: "Classes",
    sectionHint: (section: string) =>
      `Section: ${section} — use the section icon in the top bar to switch sections.`,
    tableHeaderIndex: "Nº",
    tableHeaderName: "Classe name",
    tableHeaderLevel: "Level",
    tableHeaderSpeciality: "Speciality",
    tableHeaderClasseMaster: "Classe master",
    tableHeaderSg: "SG",
    tableHeaderApc: "APC",
    apcYes: "YES",
    apcNo: "NO",
    apcLabel: "APC?",
    apcUpdateSuccess: "APC status successfully updated.",
    apcUpdateFailure: "Failed to update the APC status.",
    emptySection: "No classe for this section.",
    searchPlaceholder: "Search a classe…",
    noSearchResults: "No classe matches this search.",
    saveBtn: "Save",
    cancelBtn: "Cancel",
    editBtn: "Edit",
    deleteSelectionBtn: (count: number) => `Delete selection (${count})`,
    deleteConfirm: (count: number) => `Delete ${count} classe(s)?`,
    noSpecialityOption: "No speciality",
    noClasseMasterOption: "No classe master",
    noSgOption: "No SG",
    addPlaceholder: "New classe",
    levelPlaceholder: "Level",
    addBtn: "Add",
    nameTooShort: (min: number) =>
      `The classe name must contain at least ${min} characters.`,
    levelInvalid: (max: number) =>
      `The level must be a whole number between 1 and ${max}.`,
    addSuccess: "Classe saved successfully.",
    addDuplicate:
      "Failed to save the classe name, because a classe with the same name already exists (within the section or in another section).",
    addFailure: "Failed to add the classe.",
    updateSuccess: "Classe successfully updated.",
    updateDuplicate:
      "Failed to update the classe name, because a classe with the same name already exists (within the section or in another section).",
    updateFailure: "Failed to update the classe.",
    deleteSuccess: "Classe deleted successfully.",
    deleteFailure: "Failed to delete at least one classe.",
    importBtn: "Import",
    importUnsupportedExtension:
      "Unsupported file format. Use an .xlsx or .csv file.",
    importEmptyFile: "The file is empty or contains no data row.",
    importBadHeader:
      "The file does not match the expected structure: the first row must have three columns.",
    importEmptyName: (row: number) =>
      `The file does not match the expected structure: the classe name is empty (row ${row}, column B).`,
    importInvalidLevel: (row: number) =>
      `The file does not match the expected structure: the level must be a number (row ${row}, column C).`,
    importOverrideQuestion:
      "Do you want to delete all existing classes of the current section and school year before importing the new ones?",
    importOverrideBtn: "Delete",
    importAddWithoutOverrideBtn: "Don't delete",
    importOverrideConfirmAgain:
      "This will permanently delete all existing classes of the current section and school year. Confirm?",
    importOverrideFinalBtn: "Yes, delete",
    importDuplicateFound: (name: string, row: number) =>
      `The file contains a classe that already exists in the database: "${name}" (row ${row}, column B). Import cancelled.`,
    importDeleteFailure:
      "Failed to delete the existing classes. The import was cancelled.",
    importSuccess: (count: number) => `${count} classe(s) imported successfully.`,
    importFailure: "Failed to import the classes.",
    importFailureDetail: (detail: string) =>
      `Failed to import the classes. Details: ${detail}`,
  },
};

// `function` is a numeric role code (see MyHelper::getAccountType on the backend) that drives the
// linked account's role. Codes 3 and 5 both map to the TOP_MANAGEMENT role server-side with no
// finer-grained distinction documented anywhere - labeled by number here rather than guessing at
// job titles the backend doesn't actually differentiate.
export const staffFunctionLabels = {
  fr: {
    0: "Enseignant(e)",
    1: "Surveillant Général (SG)",
    2: "Censeur",
    3: "Direction (3)",
    4: "Économe",
    5: "Direction (5)",
  },
  en: {
    0: "Teacher",
    1: "Senior Supervisor (SG)",
    2: "Deputy Principal (Censeur)",
    3: "Management (3)",
    4: "Bursar",
    5: "Management (5)",
  },
};

export const staffManagerTranslations = {
  fr: {
    title: "Personnel",
    tableHeaderName: "Nom",
    tableHeaderSurname: "Prénom",
    tableHeaderPhone: "Téléphone",
    tableHeaderSexe: "Sexe",
    tableHeaderCivility: "Civilité",
    tableHeaderFunction: "Fonction",
    tableHeaderLogin: "Login",
    tableHeaderNewPassword: "Nouveau mot de passe",
    emptyList: "Aucun membre du personnel.",
    searchPlaceholder: "Rechercher un membre du personnel…",
    noSearchResults: "Aucun membre du personnel ne correspond à cette recherche.",
    saveBtn: "Enregistrer",
    cancelBtn: "Annuler",
    editBtn: "Modifier",
    deleteSelectionBtn: (count: number) => `Supprimer la sélection (${count})`,
    deleteConfirm: (count: number) =>
      `Supprimer ${count} membre(s) du personnel ?`,
    addPlaceholderName: "Nom",
    addPlaceholderSurname: "Prénom",
    addPlaceholderPhone: "Téléphone",
    addPlaceholderCivility: "Civilité (Mr, Mme...)",
    addPlaceholderLogin: "Login",
    addPlaceholderPassword: "Mot de passe",
    newPasswordPlaceholder: "Laisser vide pour ne pas changer",
    sexeMale: "M",
    sexeFemale: "F",
    addBtn: "Ajouter",
    nameTooShort: (min: number) =>
      `Le nom doit contenir au moins ${min} caractères.`,
    loginOrPasswordTooShort: (min: number) =>
      `Le login et le mot de passe doivent contenir au moins ${min} caractères.`,
    addSuccess: "Personnel enregistré avec succès.",
    addDuplicate:
      "Échec de l'enregistrement : ce login ou ce numéro de téléphone est déjà utilisé par un autre membre du personnel.",
    addFailure: "Échec de l'ajout du personnel.",
    updateSuccess: "Personnel mis à jour avec succès.",
    updateDuplicate:
      "Échec de la mise à jour : ce login ou ce numéro de téléphone est déjà utilisé par un autre membre du personnel.",
    updateFailure: "Échec de la modification du personnel.",
    deleteSuccess: "Personnel supprimé avec succès.",
    deleteFailure: "Échec de la suppression d'au moins un membre du personnel.",
    importBtn: "Importer",
    importUnsupportedExtension:
      "Format de fichier non pris en charge. Utilisez un fichier .xlsx ou .csv.",
    importEmptyFile:
      "Le fichier est vide ou ne contient aucune ligne de données.",
    importBadHeader:
      "Le fichier ne respecte pas la structure attendue : la première ligne doit contenir six colonnes.",
    importEmptyName: (row: number) =>
      `Le fichier ne respecte pas la structure attendue : le nom est vide (ligne ${row}, colonne C).`,
    importDeleteExistingQuestion:
      "Souhaitez-vous supprimer tout le personnel existant de l'année scolaire en cours avant d'enregistrer le personnel importé ? Si vous refusez, le personnel importé sera simplement ajouté à la liste actuelle.",
    importDeleteBtn: "Supprimer",
    importAddWithoutDeleteBtn: "Ne pas supprimer",
    importDeleteConfirmAgain:
      "Cette action supprimera définitivement tout le personnel existant de l'année scolaire en cours. Confirmez-vous ?",
    importDeleteFinalBtn: "Oui, supprimer",
    importSuccess: (count: number) =>
      `${count} membre(s) du personnel importé(s) avec succès. Des identifiants (login/mot de passe) temporaires ont été générés automatiquement — pensez à les modifier depuis la liste du personnel.`,
    importFailure: "Échec de l'import du personnel.",
    importFailureDetail: (detail: string) =>
      `Échec de l'import du personnel. Détails : ${detail}`,
  },
  en: {
    title: "Staff",
    tableHeaderName: "Name",
    tableHeaderSurname: "Surname",
    tableHeaderPhone: "Phone",
    tableHeaderSexe: "Sex",
    tableHeaderCivility: "Civility",
    tableHeaderFunction: "Role",
    tableHeaderLogin: "Login",
    tableHeaderNewPassword: "New password",
    emptyList: "No staff members.",
    searchPlaceholder: "Search a staff member…",
    noSearchResults: "No staff member matches this search.",
    saveBtn: "Save",
    cancelBtn: "Cancel",
    editBtn: "Edit",
    deleteSelectionBtn: (count: number) => `Delete selection (${count})`,
    deleteConfirm: (count: number) => `Delete ${count} staff member(s)?`,
    addPlaceholderName: "Name",
    addPlaceholderSurname: "Surname",
    addPlaceholderPhone: "Phone",
    addPlaceholderCivility: "Civility (Mr, Mrs...)",
    addPlaceholderLogin: "Login",
    addPlaceholderPassword: "Password",
    newPasswordPlaceholder: "Leave blank to keep unchanged",
    sexeMale: "M",
    sexeFemale: "F",
    addBtn: "Add",
    nameTooShort: (min: number) =>
      `The name must contain at least ${min} characters.`,
    loginOrPasswordTooShort: (min: number) =>
      `The login and password must contain at least ${min} characters.`,
    addSuccess: "Staff member saved successfully.",
    addDuplicate:
      "Failed to save: this login or phone number is already used by another staff member.",
    addFailure: "Failed to add the staff member.",
    updateSuccess: "Staff member successfully updated.",
    updateDuplicate:
      "Failed to update: this login or phone number is already used by another staff member.",
    updateFailure: "Failed to update the staff member.",
    deleteSuccess: "Staff member deleted successfully.",
    deleteFailure: "Failed to delete at least one staff member.",
    importBtn: "Import",
    importUnsupportedExtension:
      "Unsupported file format. Use an .xlsx or .csv file.",
    importEmptyFile: "The file is empty or contains no data row.",
    importBadHeader:
      "The file does not match the expected structure: the first row must have six columns.",
    importEmptyName: (row: number) =>
      `The file does not match the expected structure: the name is empty (row ${row}, column C).`,
    importDeleteExistingQuestion:
      "Would you like to delete all existing staff of the current school year before saving the imported staff? If you decline, the imported staff will simply be added to the current list.",
    importDeleteBtn: "Delete",
    importAddWithoutDeleteBtn: "Don't delete",
    importDeleteConfirmAgain:
      "This will permanently delete all existing staff of the current school year. Confirm?",
    importDeleteFinalBtn: "Yes, delete",
    importSuccess: (count: number) =>
      `${count} staff member(s) imported successfully. Temporary logins/passwords were generated automatically — remember to update them from the staff list.`,
    importFailure: "Failed to import the staff.",
    importFailureDetail: (detail: string) =>
      `Failed to import the staff. Details: ${detail}`,
  },
};

export const subjectManagerTranslations = {
  fr: {
    title: "Matières",
    sectionHint: (section: string) =>
      `Section : ${section} — utilisez l'icône section dans la barre du haut pour changer de section.`,
    tableHeaderName: "Nom de la matière",
    emptySection: "Aucune matière pour cette section.",
    searchPlaceholder: "Rechercher une matière…",
    noSearchResults: "Aucune matière ne correspond à cette recherche.",
    saveBtn: "Enregistrer",
    cancelBtn: "Annuler",
    editBtn: "Modifier",
    deleteSelectionBtn: (count: number) => `Supprimer la sélection (${count})`,
    deleteConfirm: (count: number) => `Supprimer ${count} matière(s) ?`,
    addPlaceholder: "Nouvelle matière",
    addBtn: "Ajouter",
    nameTooShort: (min: number) =>
      `Le nom de la matière doit contenir au moins ${min} caractères.`,
    addSuccess: "Matière enregistrée avec succès.",
    addDuplicate:
      "Échec de l'enregistrement du nom de la matière, car une matière portant le même nom existe déjà (dans cette section ou dans une autre section).",
    addFailure: "Échec de l'ajout de la matière.",
    renameSuccess: "Matière mise à jour avec succès.",
    renameDuplicate:
      "Échec de la mise à jour du nom de la matière, car une matière portant le même nom existe déjà (dans cette section ou dans une autre section).",
    renameFailure: "Échec du renommage de la matière.",
    deleteSuccess: "Matière supprimée avec succès.",
    deleteFailure: "Échec de la suppression d'au moins une matière.",
    importBtn: "Importer",
    importUnsupportedExtension:
      "Format de fichier non pris en charge. Utilisez un fichier .xlsx.",
    importEmptyFile:
      "Le fichier est vide ou ne contient aucune ligne de données.",
    importBadHeader:
      "Le fichier ne respecte pas la structure attendue : la première ligne doit contenir deux colonnes.",
    importEmptyName: (row: number) =>
      `Le fichier ne respecte pas la structure attendue : le nom de la matière est vide (ligne ${row}, colonne B).`,
    importDeleteExistingQuestion:
      "Souhaitez-vous supprimer toutes les matières existantes de la section et de l'année scolaire en cours avant d'enregistrer les matières importées ? Si vous refusez, les matières importées seront simplement ajoutées à la liste actuelle.",
    importDeleteExistingConfirm:
      "Cette action supprimera définitivement toutes les matières existantes de la section et de l'année scolaire en cours. Confirmez-vous ?",
    importDuplicateFound: (name: string, row: number) =>
      `Le fichier contient une matière déjà existante dans la base de données : "${name}" (ligne ${row}, colonne B). Import annulé.`,
    importDeleteFailure:
      "Échec de la suppression des matières existantes. L'import a été annulé.",
    importSuccess: (count: number) =>
      `${count} matière(s) importée(s) avec succès.`,
    importFailure: "Échec de l'import des matières.",
    importFailureDetail: (detail: string) =>
      `Échec de l'import des matières. Détails : ${detail}`,
  },
  en: {
    title: "Subjects",
    sectionHint: (section: string) =>
      `Section: ${section} — use the section icon in the top bar to switch sections.`,
    tableHeaderName: "Subject name",
    emptySection: "No subject for this section.",
    searchPlaceholder: "Search a subject…",
    noSearchResults: "No subject matches this search.",
    saveBtn: "Save",
    cancelBtn: "Cancel",
    editBtn: "Edit",
    deleteSelectionBtn: (count: number) => `Delete selection (${count})`,
    deleteConfirm: (count: number) => `Delete ${count} subject(s)?`,
    addPlaceholder: "New subject",
    addBtn: "Add",
    nameTooShort: (min: number) =>
      `The subject name must contain at least ${min} characters.`,
    addSuccess: "Subject saved successfully.",
    addDuplicate:
      "Failed to save the subject name, because a subject with the same name already exists (within the section or in another section).",
    addFailure: "Failed to add the subject.",
    renameSuccess: "Subject successfully updated.",
    renameDuplicate:
      "Failed to update the subject name, because a subject with the same name already exists (within the section or in another section).",
    renameFailure: "Failed to rename the subject.",
    deleteSuccess: "Subject deleted successfully.",
    deleteFailure: "Failed to delete at least one subject.",
    importBtn: "Import",
    importUnsupportedExtension:
      "Unsupported file format. Please use a .xlsx file.",
    importEmptyFile: "The file is empty or contains no data rows.",
    importBadHeader:
      "The file doesn't match the expected structure: the first row must contain two columns.",
    importEmptyName: (row: number) =>
      `The file doesn't match the expected structure: the subject name is empty (row ${row}, column B).`,
    importDeleteExistingQuestion:
      "Would you like to delete all existing subjects of the current section and school year before saving the imported subjects? If you decline, the imported subjects will simply be added to the current list.",
    importDeleteExistingConfirm:
      "This will permanently delete all existing subjects of the current section and school year. Do you confirm?",
    importDuplicateFound: (name: string, row: number) =>
      `The file contains a subject that already exists in the database: "${name}" (row ${row}, column B). Import cancelled.`,
    importDeleteFailure:
      "Failed to delete the existing subjects. The import was cancelled.",
    importSuccess: (count: number) =>
      `${count} subject(s) successfully imported.`,
    importFailure: "Failed to import the subjects.",
    importFailureDetail: (detail: string) =>
      `Failed to import the subjects. Details: ${detail}`,
  },
};

// The 4 sub-modules reachable from the "Manage subjects" dashboard card (see subjectsHubTranslations
// below). Only "matieres" (SubjectManager) and "groupes" (GroupeManager) are built - the hub renders
// the other two as inert placeholder cards, same convention as AdminMenuGrid's unbuilt modules.
export const subjectsHubTranslations = {
  fr: {
    title: "Gestion des matières",
    matieres: "Gestion des matières",
    groupes: "Gestion des groupes",
    matieresClasses: "Matières et classes",
    matieresCompetences: "Matières et compétences",
  },
  en: {
    title: "Manage subjects",
    matieres: "Manage subjects",
    groupes: "Manage groups",
    matieresClasses: "Subjects and classes",
    matieresCompetences: "Subjects and competencies",
  },
};

export const groupeManagerTranslations = {
  fr: {
    title: "Groupes",
    sectionHint: (section: string) =>
      `Section : ${section} — utilisez l'icône section dans la barre du haut pour changer de section.`,
    tableHeaderIndex: "Nº",
    tableHeaderName: "Nom du groupe",
    emptySection: "Aucun groupe pour cette section.",
    searchPlaceholder: "Rechercher un groupe…",
    noSearchResults: "Aucun groupe ne correspond à cette recherche.",
    saveBtn: "Enregistrer",
    cancelBtn: "Annuler",
    editBtn: "Modifier",
    deleteSelectionBtn: (count: number) => `Supprimer la sélection (${count})`,
    deleteConfirm: (count: number) => `Supprimer ${count} groupe(s) ?`,
    addPlaceholder: "Nouveau groupe",
    addBtn: "Ajouter",
    nameTooShort: (min: number) =>
      `Le nom du groupe doit contenir au moins ${min} caractères.`,
    addSuccess: "Groupe enregistré avec succès.",
    addDuplicate:
      "Échec de l'enregistrement : un groupe portant le même nom existe déjà (dans cette section ou dans une autre section).",
    addFailure: "Échec de l'ajout du groupe.",
    renameSuccess: "Groupe mis à jour avec succès.",
    renameDuplicate:
      "Échec de la mise à jour : un groupe portant le même nom existe déjà (dans cette section ou dans une autre section).",
    renameFailure: "Échec du renommage du groupe.",
    deleteSuccess: "Groupe supprimé avec succès.",
    deleteFailure: "Échec de la suppression d'au moins un groupe.",
  },
  en: {
    title: "Groups",
    sectionHint: (section: string) =>
      `Section: ${section} — use the section icon in the top bar to switch sections.`,
    tableHeaderIndex: "Nº",
    tableHeaderName: "Group name",
    emptySection: "No group for this section.",
    searchPlaceholder: "Search a group…",
    noSearchResults: "No group matches this search.",
    saveBtn: "Save",
    cancelBtn: "Cancel",
    editBtn: "Edit",
    deleteSelectionBtn: (count: number) => `Delete selection (${count})`,
    deleteConfirm: (count: number) => `Delete ${count} group(s)?`,
    addPlaceholder: "New group",
    addBtn: "Add",
    nameTooShort: (min: number) =>
      `The group name must contain at least ${min} characters.`,
    addSuccess: "Group saved successfully.",
    addDuplicate:
      "Failed to save: a group with the same name already exists (within the section or in another section).",
    addFailure: "Failed to add the group.",
    renameSuccess: "Group successfully updated.",
    renameDuplicate:
      "Failed to update: a group with the same name already exists (within the section or in another section).",
    renameFailure: "Failed to rename the group.",
    deleteSuccess: "Group deleted successfully.",
    deleteFailure: "Failed to delete at least one group.",
  },
};

export const subjectClasseManagerTranslations = {
  fr: {
    title: "Matières et classes",
    sectionHint: (section: string) =>
      `Section : ${section} — utilisez l'icône section dans la barre du haut pour changer de section.`,
    classeLabel: "Classe :",
    noClasseOption: "Sélectionnez une classe",
    emptyClasses: "Aucune classe pour cette section.",
    leftPanelTitle: (classeName: string) =>
      `Matières non assignées à '${classeName}'`,
    rightPanelTitle: (classeName: string) => `Matières de '${classeName}'`,
    tableHeaderIndex: "Nº",
    tableHeaderSubject: "Matière",
    tableHeaderCoef: "Coef.",
    tableHeaderGroup: "Groupe",
    emptyLeft: "Toutes les matières sont assignées à cette classe.",
    emptyRight: "Aucune matière assignée à cette classe.",
    addBtn: "Ajouter >",
    removeBtn: "< Retirer",
    saveBtn: "Enregistrer",
    refreshBtn: "Actualiser",
    printBtn: "Imprimer",
    copyBtn: (classeName: string) => `Copier ${classeName}`,
    noGroupsHint:
      "Aucun groupe n'est défini pour cette section — créez-en un dans « Gestion des groupes » avant d'ajouter des matières.",
    addSuccess: "Matière(s) ajoutée(s) avec succès.",
    addFailure: "Échec de l'ajout d'au moins une matière.",
    removeConfirm: (count: number) =>
      `Retirer ${count} matière(s) de cette classe ?`,
    removeSuccess: "Matière(s) retirée(s) avec succès.",
    removePartialFailure: "Échec du retrait d'au moins une matière.",
    invalidCoef: (subjectTitle: string) =>
      `Le coefficient de "${subjectTitle}" doit être un nombre supérieur à 0 et inférieur ou égal à 10.`,
    saveSuccess: "Modifications enregistrées avec succès.",
    saveFailure: "Échec de l'enregistrement des modifications.",
    copyDialogTitle: (classeName: string) =>
      `Copier les matières de '${classeName}' vers…`,
    copyNoOtherClassesOfLevel:
      "Aucune autre classe de ce niveau dans cette section.",
    copyNoTargetSelected: "Sélectionnez au moins une classe de destination.",
    copyApplyBtn: "Appliquer",
    copyCancelBtn: "Annuler",
    copyConfirmAgain: (count: number, classeName: string) =>
      `Les matières actuelles de ${count} classe(s) sélectionnée(s) seront supprimées et remplacées par celles de '${classeName}'. Continuer ?`,
    copyConfirmFinalBtn: "Copier",
    copySuccess: "Matières copiées avec succès.",
    copyPartialFailure: "Échec de la copie vers au moins une classe.",
  },
  en: {
    title: "Subjects and classes",
    sectionHint: (section: string) =>
      `Section: ${section} — use the section icon in the top bar to switch sections.`,
    classeLabel: "Class:",
    noClasseOption: "Select a class",
    emptyClasses: "No class for this section.",
    leftPanelTitle: (classeName: string) =>
      `Subjects not assigned to '${classeName}'`,
    rightPanelTitle: (classeName: string) => `Subjects of '${classeName}'`,
    tableHeaderIndex: "Nº",
    tableHeaderSubject: "Subject",
    tableHeaderCoef: "Coef.",
    tableHeaderGroup: "group",
    emptyLeft: "Every subject is already assigned to this class.",
    emptyRight: "No subject assigned to this class.",
    addBtn: "Add >",
    removeBtn: "< Remove",
    saveBtn: "Save",
    refreshBtn: "Refresh",
    printBtn: "Print",
    copyBtn: (classeName: string) => `Copy ${classeName}`,
    noGroupsHint:
      "No group is defined for this section — create one under \"Manage groups\" before adding subjects.",
    addSuccess: "Subject(s) added successfully.",
    addFailure: "Failed to add at least one subject.",
    removeConfirm: (count: number) =>
      `Remove ${count} subject(s) from this class?`,
    removeSuccess: "Subject(s) removed successfully.",
    removePartialFailure: "Failed to remove at least one subject.",
    invalidCoef: (subjectTitle: string) =>
      `The coefficient of "${subjectTitle}" must be a number greater than 0 and at most 10.`,
    saveSuccess: "Changes saved successfully.",
    saveFailure: "Failed to save changes.",
    copyDialogTitle: (classeName: string) =>
      `Copy subjects of '${classeName}' to…`,
    copyNoOtherClassesOfLevel: "No other class of this level in this section.",
    copyNoTargetSelected: "Select at least one destination class.",
    copyApplyBtn: "Apply",
    copyCancelBtn: "Cancel",
    copyConfirmAgain: (count: number, classeName: string) =>
      `The current subjects of ${count} selected class(es) will be deleted and replaced with those of '${classeName}'. Continue?`,
    copyConfirmFinalBtn: "Copy",
    copySuccess: "Subjects copied successfully.",
    copyPartialFailure: "Failed to copy to at least one class.",
  },
};

export const subjectCompetenceManagerTranslations = {
  fr: {
    title: "Matières et compétences",
    sectionHint: (section: string) =>
      `Section : ${section} — utilisez l'icône section dans la barre du haut pour changer de section.`,
    classeLabel: "Classe :",
    subjectLabel: "Matière :",
    termLabel: "Trimestre :",
    term: (n: number) => `Trimestre ${n}`,
    emptyClasses:
      "Aucune classe à profil de compétence (APC) pour cette section. Activez le profil de compétence sur au moins un niveau dans « Gestion des classes ».",
    emptySubjects: "Aucune matière assignée à cette classe.",
    deleteAllOfClasseTooltip: (classeName: string) =>
      `Supprimer toutes les compétences de ${classeName}`,
    deleteAllOfClasseConfirm: (classeName: string) =>
      `Supprimer TOUTES les compétences de "${classeName}" (toutes matières et tous trimestres confondus) pour l'année scolaire en cours ? Cette action est irréversible.`,
    deleteAllOfClasseSuccess: "Toutes les compétences de la classe ont été supprimées.",
    deleteAllOfClasseFailure: "Échec de la suppression des compétences de la classe.",
    addPlaceholder: "Compétence (300 caractères)",
    addBtn: "Ajouter",
    addTextRequired: "Le texte de la compétence est requis.",
    addDuplicate:
      "Cette compétence existe déjà pour cette matière, cette classe et ce trimestre.",
    addSuccess: "Compétence enregistrée avec succès.",
    addFailure: "Échec de l'enregistrement de la compétence.",
    tableHeaderIndex: "Nº",
    tableHeaderCompetence: "Compétence",
    emptyCompetences:
      "Aucune compétence pour cette matière, cette classe et ce trimestre.",
    searchPlaceholder: "Rechercher une compétence…",
    noSearchResults: "Aucune compétence ne correspond à cette recherche.",
    editBtn: "Modifier",
    saveBtn: "Enregistrer",
    cancelBtn: "Annuler",
    renameSuccess: "Compétence mise à jour avec succès.",
    renameDuplicate:
      "Cette compétence existe déjà pour cette matière, cette classe et ce trimestre.",
    renameFailure: "Échec de la mise à jour de la compétence.",
    deleteSelectionBtn: (count: number) => `Supprimer la sélection (${count})`,
    deleteConfirm: (count: number) => `Supprimer ${count} compétence(s) ?`,
    deleteSuccess: "Compétence(s) supprimée(s) avec succès.",
    deleteFailure: "Échec de la suppression d'au moins une compétence.",
  },
  en: {
    title: "Subjects and competencies",
    sectionHint: (section: string) =>
      `Section: ${section} — use the section icon in the top bar to switch sections.`,
    classeLabel: "Class:",
    subjectLabel: "Subject:",
    termLabel: "Term:",
    term: (n: number) => `Term ${n}`,
    emptyClasses:
      "No competency-based (APC) class for this section. Activate the competency-based profile on at least one level in \"Manage classes\".",
    emptySubjects: "No subject assigned to this class.",
    deleteAllOfClasseTooltip: (classeName: string) =>
      `Delete all competencies of ${classeName}`,
    deleteAllOfClasseConfirm: (classeName: string) =>
      `Delete ALL competencies of "${classeName}" (every subject and every term) for the current school year? This action cannot be undone.`,
    deleteAllOfClasseSuccess: "All competencies of the class were deleted.",
    deleteAllOfClasseFailure: "Failed to delete the class's competencies.",
    addPlaceholder: "Competency (300 characters)",
    addBtn: "Add",
    addTextRequired: "The competency text is required.",
    addDuplicate:
      "This competency already exists for this subject, class and term.",
    addSuccess: "Competency saved successfully.",
    addFailure: "Failed to save the competency.",
    tableHeaderIndex: "Nº",
    tableHeaderCompetence: "Competency",
    emptyCompetences: "No competency for this subject, class and term.",
    searchPlaceholder: "Search a competency…",
    noSearchResults: "No competency matches this search.",
    editBtn: "Edit",
    saveBtn: "Save",
    cancelBtn: "Cancel",
    renameSuccess: "Competency successfully updated.",
    renameDuplicate:
      "This competency already exists for this subject, class and term.",
    renameFailure: "Failed to update the competency.",
    deleteSelectionBtn: (count: number) => `Delete selection (${count})`,
    deleteConfirm: (count: number) => `Delete ${count} competency(ies)?`,
    deleteSuccess: "Competency(ies) deleted successfully.",
    deleteFailure: "Failed to delete at least one competency.",
  },
};

export const schoolInfoTranslations = {
  fr: {
    title: "Information de l'établissement",
    requiredHint: "Veuillez remplir les champs obligatoires",
    schoolNameLabel: "Nom de l'établissement",
    schoolNameENLabel: "Nom de l'établissement (EN)",
    regionLabel: "Région",
    regionENLabel: "Région (EN)",
    deptLabel: "Département",
    deptENLabel: "Département (EN)",
    phoneLabel: "Téléphone",
    emailLabel: "Email",
    poboxLabel: "Bp.",
    typeLabel: "Type d'établissement",
    responsableLabel: (name: string) => `Responsable:[${name}]`,
    signDateLabel: "Date de signature",
    immtLabel: "Immatriculation",
    str1Label: "Référence (Transfert/Certificat de scolarité)",
    str2Label: "Référence (Document administratif du personnel)",
    signPlaceLabel: "Lieu de signature",
    selectFileBtn: "Sélectionnez le fichier",
    saveBtn: "Enregistrer",
    requiredField: "Ce champ est obligatoire.",
    invalidPhone: "Le numéro de téléphone doit contenir entre 5 et 10 chiffres.",
    invalidEmail: "Veuillez saisir une adresse email valide.",
    logoReselectHint:
      "Logo actuel. Sélectionnez un fichier uniquement si vous souhaitez le remplacer.",
    saveSuccess: "Information de l'établissement enregistrée avec succès.",
    saveFailure: "Échec de l'enregistrement de l'information de l'établissement.",
  },
  en: {
    title: "Establishment information",
    requiredHint: "Please fill in the required fields",
    schoolNameLabel: "Establishment name",
    schoolNameENLabel: "Establishment name (EN)",
    regionLabel: "Region",
    regionENLabel: "Region (EN)",
    deptLabel: "Department",
    deptENLabel: "Department (EN)",
    phoneLabel: "Phone",
    emailLabel: "Email",
    poboxLabel: "P.O. Box",
    typeLabel: "Establishment type",
    responsableLabel: (name: string) => `Head:[${name}]`,
    signDateLabel: "Signature date",
    immtLabel: "Registration number",
    str1Label: "Reference (Transfer/School certificate)",
    str2Label: "Reference (Staff administrative document)",
    signPlaceLabel: "Signature place",
    selectFileBtn: "Select the file",
    saveBtn: "Save",
    requiredField: "This field is required.",
    invalidPhone: "Phone number must contain between 5 and 10 digits.",
    invalidEmail: "Please enter a valid email address.",
    logoReselectHint: "Current logo. Select a file only if you want to replace it.",
    saveSuccess: "Establishment information saved successfully.",
    saveFailure: "Failed to save the establishment information.",
  },
};

export const connectivityTranslations = {
  fr: {
    offline: "Vous êtes hors ligne. Vérifiez votre connexion internet.",
    serverUnavailable:
      "Le serveur est actuellement injoignable. Veuillez réessayer plus tard.",
    backOnline: "La connexion au serveur a été rétablie.",
  },
  en: {
    offline: "You are offline. Please check your internet connection.",
    serverUnavailable:
      "The server is currently unreachable. Please try again later.",
    backOnline: "Connection to the server has been restored.",
  },
};

export const adminMenuTranslations = {
  fr: {
    schoolDetails: "Information de base",
    filieres: "Filières",
    specialities: "Spécialité",
    classes: "Classes",
    subjects: "Gérer les Matières",
    staff: "Personnel",
    assignCourses: "Attribution des cours",
    students: "Elèves",
    marksEntry: "Saisir les notes",
    markSheet: "Fiche de report",
    printReportCards: "Imprimer les bulletins",
    fillRate: "Taux de remplissage",
    discipline: "Discipline",
    summary: "Bilan",
    sms: "SMS",
    schoolReport: "Livrets",
    parents: "Parents",
    manageAccount: "Gestion du compte",
    settings: "Paramètres",
    promotions: "Promotions",
    basculement: "Basculement",
    scholarship: "Bourse",
    insolvents: "Insolvables",
  },
  en: {
    schoolDetails: "School details",
    filieres: "Options",
    specialities: "Speciality",
    classes: "Manage classes",
    subjects: "Manage subjects",
    staff: "Staff",
    assignCourses: "Assign courses",
    students: "Manage students",
    marksEntry: "Marks entry",
    markSheet: "Mark sheet",
    printReportCards: "Print report cards",
    fillRate: "Fill rate",
    discipline: "Discipline",
    summary: "Summary",
    sms: "SMS",
    schoolReport: "School report",
    parents: "Parents",
    manageAccount: "Manage account",
    settings: "Settings",
    promotions: "Promotions",
    basculement: "Basculement",
    scholarship: "Scholarship",
    insolvents: "Insolvents",
  },
};
