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
    submitBtn: "Se connecter",
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
    submitBtn: "Sign in",
    alertNoSchool: (school: string) => `Please select a school [${school}]`,
    alertBadCredentials: (school: string) =>
      `Incorrect username or password \nSCHOOL:[${school}]`,
  },
};
