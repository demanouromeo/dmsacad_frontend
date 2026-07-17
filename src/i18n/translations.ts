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

export const classeManagerTranslations = {
  fr: {
    title: "Classes",
    sectionHint: (section: string) =>
      `Section : ${section} — utilisez l'icône section dans la barre du haut pour changer de section.`,
    tableHeaderName: "Nom de la classe",
    tableHeaderLevel: "Niveau",
    tableHeaderSpeciality: "Spécialité",
    emptySection: "Aucune classe pour cette section.",
    saveBtn: "Enregistrer",
    cancelBtn: "Annuler",
    editBtn: "Modifier",
    deleteSelectionBtn: (count: number) => `Supprimer la sélection (${count})`,
    deleteConfirm: (count: number) => `Supprimer ${count} classe(s) ?`,
    noSpecialityOption: "Aucune spécialité",
    addPlaceholder: "Nouvelle classe",
    levelPlaceholder: "Niveau",
    addBtn: "Ajouter",
    nameTooShort: (min: number) =>
      `Le nom de la classe doit contenir au moins ${min} caractères.`,
    levelInvalid: "Le niveau doit être un nombre entier positif.",
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
  },
  en: {
    title: "Classes",
    sectionHint: (section: string) =>
      `Section: ${section} — use the section icon in the top bar to switch sections.`,
    tableHeaderName: "Classe name",
    tableHeaderLevel: "Level",
    tableHeaderSpeciality: "Speciality",
    emptySection: "No classe for this section.",
    saveBtn: "Save",
    cancelBtn: "Cancel",
    editBtn: "Edit",
    deleteSelectionBtn: (count: number) => `Delete selection (${count})`,
    deleteConfirm: (count: number) => `Delete ${count} classe(s)?`,
    noSpecialityOption: "No speciality",
    addPlaceholder: "New classe",
    levelPlaceholder: "Level",
    addBtn: "Add",
    nameTooShort: (min: number) =>
      `The classe name must contain at least ${min} characters.`,
    levelInvalid: "The level must be a positive whole number.",
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
  },
};

export const subjectManagerTranslations = {
  fr: {
    title: "Matières",
    sectionHint: (section: string) =>
      `Section : ${section} — utilisez l'icône section dans la barre du haut pour changer de section.`,
    tableHeaderName: "Nom de la matière",
    emptySection: "Aucune matière pour cette section.",
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
  },
  en: {
    title: "Subjects",
    sectionHint: (section: string) =>
      `Section: ${section} — use the section icon in the top bar to switch sections.`,
    tableHeaderName: "Subject name",
    emptySection: "No subject for this section.",
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
    logoRequired: "Veuillez sélectionner un logo.",
    logoReselectHint:
      "Logo actuel. Sélectionnez à nouveau un fichier pour l'enregistrer avec vos modifications.",
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
    logoRequired: "Please select a logo.",
    logoReselectHint:
      "Current logo. Select a file again to save it along with your changes.",
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
