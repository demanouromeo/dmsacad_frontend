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
    tableHeaderName: "Nom de la filière",
    emptySection: "Aucune filière pour cette section.",
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
    tableHeaderName: "Option name",
    emptySection: "No option for this section.",
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
    tableHeaderName: "Nom de la spécialité",
    tableHeaderFiliere: "Filière",
    tableHeaderDescription: "Description",
    emptySection: "Aucune spécialité pour cette section.",
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
    tableHeaderName: "Speciality name",
    tableHeaderFiliere: "Option",
    tableHeaderDescription: "Description",
    emptySection: "No speciality for this section.",
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
