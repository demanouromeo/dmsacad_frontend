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
    nameTooShort: (min: number) =>
      `Le nom de la filière doit contenir au moins ${min} caractères.`,
    addSuccess: "Filière ajoutée avec succès.",
    addDuplicate: (name: string) =>
      `Une filière portant le nom [${name}] existe déjà.`,
    addFailure: "Échec de l'ajout de la filière.",
    renameSuccess: (oldName: string, newName: string) =>
      `Filière renommée de [${oldName}] à [${newName}].`,
    renameDuplicate: (name: string) =>
      `Une filière portant le nom [${name}] existe déjà.`,
    renameFailure: "Échec du renommage de la filière.",
    deleteSuccess: "Filière(s) supprimée(s) avec succès.",
    deleteFailure: "Échec de la suppression d'au moins une filière.",
  },
  en: {
    nameTooShort: (min: number) =>
      `The filiere name must contain at least ${min} characters.`,
    addSuccess: "Filiere added successfully.",
    addDuplicate: (name: string) =>
      `A filiere with the name [${name}] already exists.`,
    addFailure: "Failed to add the filiere.",
    renameSuccess: (oldName: string, newName: string) =>
      `Filiere renamed from [${oldName}] to [${newName}].`,
    renameDuplicate: (name: string) =>
      `A filiere with the name [${name}] already exists.`,
    renameFailure: "Failed to rename the filiere.",
    deleteSuccess: "Filiere(s) successfully deleted.",
    deleteFailure: "Failed to delete at least one filiere.",
  },
};

export const specialityManagerTranslations = {
  fr: {
    nameTooShort: (min: number) =>
      `Le nom de la spécialité doit contenir au moins ${min} caractères.`,
    addSuccess: "Spécialité ajoutée avec succès.",
    addDuplicate: (name: string) =>
      `Une spécialité portant le nom [${name}] existe déjà.`,
    addFailure: "Échec de l'ajout de la spécialité.",
    updateSuccess: "Spécialité modifiée avec succès.",
    updateDuplicate: (name: string) =>
      `Une spécialité portant le nom [${name}] existe déjà.`,
    updateFailure: "Échec de la modification de la spécialité.",
    deleteSuccess: "Spécialité(s) supprimée(s) avec succès.",
    deleteFailure: "Échec de la suppression d'au moins une spécialité.",
  },
  en: {
    nameTooShort: (min: number) =>
      `The speciality name must contain at least ${min} characters.`,
    addSuccess: "Speciality added successfully.",
    addDuplicate: (name: string) =>
      `A speciality with the name [${name}] already exists.`,
    addFailure: "Failed to add the speciality.",
    updateSuccess: "Speciality updated successfully.",
    updateDuplicate: (name: string) =>
      `A speciality with the name [${name}] already exists.`,
    updateFailure: "Failed to update the speciality.",
    deleteSuccess: "Speciality(ies) successfully deleted.",
    deleteFailure: "Failed to delete at least one speciality.",
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
    filieres: "Filières",
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
