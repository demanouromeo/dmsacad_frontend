// Local, offline knowledge base powering MagicAssistant - deliberately not a real AI/LLM call (no
// backend proxy exists for one). Each entry is matched by keyword against whatever the user types
// (see assistantEngine.ts) and, when `roles` is set, only ever surfaced to those roles - asking
// about an out-of-scope feature gets a role-restricted answer instead (see assistantEngine.ts's
// two-pass matching), not the real instructions, per "enable them to access resources they have
// right to". Extend this list (not a second mechanism) when the app gains new features the
// assistant should know about.

export type Role =
  | "ADMIN"
  | "SG"
  | "TEACHER"
  | "CENSEUR"
  | "PARENT"
  | "BURSAR"
  | "TOP_MANAGEMENT"
  | "STUDENT";

export interface KbEntry {
  id: string;
  // Omit to make an entry visible/answerable for every role.
  roles?: Role[];
  keywords: { fr: string[]; en: string[] };
  question: { fr: string; en: string };
  answer: { fr: string; en: string };
}

export const KNOWLEDGE_BASE: KbEntry[] = [
  // ---- General / every role -------------------------------------------------------------
  {
    id: "login_help",
    keywords: {
      fr: ["connecter", "connexion", "identifiants", "se connecter"],
      en: ["log in", "login", "sign in", "connect"],
    },
    question: { fr: "Comment se connecter à l'application ?", en: "How do I log in to the app?" },
    answer: {
      fr: "Sur l'écran de connexion : choisissez votre école, l'année scolaire et la section (Francophone/Anglophone), puis entrez votre login et votre mot de passe. L'icône ⚙ Paramètres permet aussi de basculer entre serveur Distant et Local.",
      en: "On the login screen: pick your school, the school year and the section (Francophone/Anglophone), then enter your login and password. The ⚙ Settings icon also lets you switch between the Remote and Local server.",
    },
  },
  {
    id: "backend_target",
    keywords: {
      fr: ["serveur local", "serveur distant", "local", "distant"],
      en: ["local server", "remote server", "backend target"],
    },
    question: { fr: "Quelle est la différence entre serveur Local et Distant ?", en: "What's the difference between Local and Remote server?" },
    answer: {
      fr: "\"Distant\" utilise le serveur en ligne (dmsacad.com) - c'est le choix normal au quotidien. \"Local\" pointe vers un serveur installé sur cet ordinateur (XAMPP), utilisé surtout pour les tests/développement ; en Local, une seule base de données est disponible donc la liste des écoles est masquée.",
      en: "\"Remote\" uses the online server (dmsacad.com) - the normal day-to-day choice. \"Local\" points to a server installed on this computer (XAMPP), mostly used for testing/development; in Local mode only one database is available so the school picker is hidden.",
    },
  },
  {
    id: "server_unreachable",
    keywords: {
      fr: ["serveur injoignable", "hors ligne", "connexion perdue", "injoignable"],
      en: ["server unavailable", "offline", "unreachable", "connection lost"],
    },
    question: { fr: "Le serveur est injoignable, que faire ?", en: "The server is unreachable, what should I do?" },
    answer: {
      fr: "Vérifiez d'abord votre connexion internet. Si le message persiste alors que votre connexion fonctionne, le serveur distant est peut-être temporairement indisponible - réessayez dans quelques minutes, ou contactez votre administrateur si vous testez en local.",
      en: "First check your internet connection. If the message persists while your connection works, the remote server may be temporarily unavailable - try again in a few minutes, or contact your administrator if you're testing locally.",
    },
  },
  {
    id: "change_school_year_section",
    keywords: {
      fr: ["année scolaire", "changer année", "section", "francophone", "anglophone"],
      en: ["school year", "change year", "section", "francophone", "anglophone"],
    },
    question: { fr: "Comment changer l'année scolaire ou la section ?", en: "How do I change the school year or section?" },
    answer: {
      fr: "En haut de l'écran (bandeau), utilisez l'icône calendrier pour changer l'année scolaire, ou l'icône diplôme pour changer de section (Francophone/Anglophone). Le changement s'applique immédiatement aux écrans que vous ouvrez ensuite.",
      en: "At the top of the screen, use the calendar icon to change the school year, or the graduation-cap icon to change section (Francophone/Anglophone). The change applies immediately to screens you open next.",
    },
  },
  {
    id: "change_language",
    keywords: { fr: ["langue", "français", "anglais"], en: ["language", "french", "english"] },
    question: { fr: "Comment changer la langue de l'application ?", en: "How do I change the app's language?" },
    answer: {
      fr: "Cliquez sur le drapeau en haut à droite (FR/EN) pour basculer la langue de l'interface.",
      en: "Click the flag icon top-right (FR/EN) to switch the interface language.",
    },
  },
  {
    id: "manage_credentials",
    keywords: {
      fr: ["mot de passe", "changer mon mot de passe", "mes identifiants"],
      en: ["change my password", "my credentials", "my login"],
    },
    question: { fr: "Comment changer mon mot de passe ou mon login ?", en: "How do I change my password or login?" },
    answer: {
      fr: "Sur le tableau de bord, cliquez sur \"Gérer mes identifiants\" pour modifier votre login et/ou votre mot de passe.",
      en: "On the dashboard, click \"Manage my credentials\" to change your login and/or password.",
    },
  },
  {
    id: "logout",
    keywords: { fr: ["déconnecter", "quitter la session", "se déconnecter"], en: ["log out", "sign out", "logout"] },
    question: { fr: "Comment me déconnecter ?", en: "How do I log out?" },
    answer: {
      fr: "Utilisez le bouton de déconnexion sur le tableau de bord (icône en haut à droite du bandeau, ou bouton dédié sous votre nom).",
      en: "Use the logout button on the dashboard (top-right icon on the banner, or the dedicated button under your name).",
    },
  },
  {
    id: "export_data",
    keywords: { fr: ["exporter", "export pdf", "export excel", "imprimer liste"], en: ["export", "export pdf", "export excel", "print list"] },
    question: { fr: "Comment exporter une liste en PDF ou Excel ?", en: "How do I export a list to PDF or Excel?" },
    answer: {
      fr: "Au-dessus de chaque tableau, les boutons \"Exporter en Excel\" et \"Exporter en PDF\" génèrent un fichier avec les données actuellement affichées.",
      en: "Above every table, the \"Export to Excel\" and \"Export to PDF\" buttons generate a file with the data currently shown.",
    },
  },
  {
    id: "search_table",
    keywords: { fr: ["rechercher", "recherche", "filtrer une liste"], en: ["search", "filter list", "find in table"] },
    question: { fr: "Comment rechercher dans une liste ?", en: "How do I search within a list?" },
    answer: {
      fr: "Une barre de recherche est disponible au-dessus de chaque tableau ; tapez un nom, un matricule ou tout texte visible dans la ligne pour filtrer instantanément.",
      en: "A search box is available above every table; type a name, matricule, or any text visible in the row to filter instantly.",
    },
  },
  {
    id: "locked_marks",
    keywords: {
      fr: ["verrouillé", "verrouillage", "modifier une note", "note bloquée", "ne peux pas modifier"],
      en: ["locked", "cannot edit mark", "sequence locked"],
    },
    question: { fr: "Pourquoi je ne peux pas modifier une note ?", en: "Why can't I edit a mark?" },
    answer: {
      fr: "La séquence concernée est probablement verrouillée. Seul un administrateur peut verrouiller ou déverrouiller une séquence (bouton \"Verrouiller\"/\"Déverrouiller\" dans Saisie des notes) - demandez-lui de la déverrouiller si vous devez encore modifier des notes.",
      en: "The relevant sequence is likely locked. Only an administrator can lock or unlock a sequence (the \"Lock\"/\"Unlock\" button in Mark entry) - ask them to unlock it if you still need to edit marks.",
    },
  },
  {
    id: "no_access_error",
    keywords: {
      fr: ["accès refusé", "redirigé", "pas accès à cette page", "je n'ai pas accès"],
      en: ["access denied", "redirected", "no access", "unauthorized"],
    },
    question: { fr: "Pourquoi suis-je redirigé quand j'ouvre certaines pages ?", en: "Why am I redirected when opening some pages?" },
    answer: {
      fr: "Chaque page est réservée aux rôles qui en ont besoin. Si vous êtes redirigé vers le tableau de bord, votre rôle actuel n'a pas accès à cette fonctionnalité. Si vous pensez que c'est une erreur, contactez votre administrateur.",
      en: "Each page is restricted to the roles that need it. If you're redirected to the dashboard, your current role doesn't have access to that feature. If you think this is a mistake, contact your administrator.",
    },
  },

  // ---- ADMIN-only modules ----------------------------------------------------------------
  {
    id: "manage_school_info",
    roles: ["ADMIN"],
    keywords: { fr: ["information de base", "logo école", "informations de l'école"], en: ["school details", "school logo", "school info"] },
    question: { fr: "Comment modifier les informations de l'école (logo, adresse...) ?", en: "How do I edit the school's basic info (logo, address...)?" },
    answer: {
      fr: "Ouvrez \"Information de base\" depuis le tableau de bord : vous pouvez y modifier le nom, l'adresse, le type d'établissement et le logo pour l'année scolaire en cours.",
      en: "Open \"School details\" from the dashboard: you can edit the name, address, establishment type and logo for the current school year there.",
    },
  },
  {
    id: "manage_classes",
    roles: ["ADMIN"],
    keywords: { fr: ["créer une classe", "gérer les classes", "ajouter classe", "niveau apc"], en: ["create class", "manage classes", "add class", "apc level"] },
    question: { fr: "Comment créer ou gérer les classes ?", en: "How do I create or manage classes?" },
    answer: {
      fr: "Ouvrez \"Classes\" depuis le tableau de bord pour ajouter, modifier, importer des classes, et activer le mode APC (compétences) par niveau.",
      en: "Open \"Manage classes\" from the dashboard to add, edit, import classes, and toggle APC (competence-based) mode per level.",
    },
  },
  {
    id: "manage_subjects",
    roles: ["ADMIN"],
    keywords: { fr: ["gérer les matières", "ajouter matière", "compétences matière", "attribuer matière classe"], en: ["manage subjects", "add subject", "subject competences", "assign subject to class"] },
    question: { fr: "Comment gérer les matières ?", en: "How do I manage subjects?" },
    answer: {
      fr: "Ouvrez \"Gérer les Matières\" : \"Matières\" (liste des matières), \"Groupes\", \"Matières / Classes\" (attribution + coefficient par classe) et \"Compétences\" (pour les classes APC).",
      en: "Open \"Manage subjects\": \"Subjects\" (subject list), \"Groups\", \"Subjects / Classes\" (assignment + coefficient per class) and \"Competences\" (for APC classes).",
    },
  },
  {
    id: "manage_staff",
    roles: ["ADMIN"],
    keywords: { fr: ["gérer le personnel", "ajouter enseignant", "créer compte enseignant"], en: ["manage staff", "add teacher", "create staff account"] },
    question: { fr: "Comment ajouter ou gérer le personnel ?", en: "How do I add or manage staff?" },
    answer: {
      fr: "Ouvrez \"Personnel\" depuis le tableau de bord. Ajouter un membre du personnel crée aussi son compte de connexion (login/mot de passe) en même temps.",
      en: "Open \"Staff\" from the dashboard. Adding a staff member also creates their login account (login/password) at the same time.",
    },
  },
  {
    id: "add_student",
    roles: ["ADMIN"],
    keywords: { fr: ["ajouter élève", "nouvel élève", "importer élèves", "matricule"], en: ["add student", "new student", "import students", "matricule"] },
    question: { fr: "Comment ajouter ou importer des élèves ?", en: "How do I add or import students?" },
    answer: {
      fr: "Ouvrez \"Elèves\", sélectionnez la classe, puis utilisez le formulaire d'ajout en bas du tableau ou le bouton d'import pour charger un fichier Excel. Un matricule peut être généré automatiquement.",
      en: "Open \"Manage students\", pick the classe, then use the add-row form at the bottom of the table or the import button to load an Excel file. A matricule can be generated automatically.",
    },
  },
  {
    id: "assign_courses",
    roles: ["ADMIN"],
    keywords: { fr: ["attribution des cours", "assigner un cours", "attribuer une matière à un enseignant"], en: ["assign courses", "assign teacher subject", "course assignment"] },
    question: { fr: "Comment attribuer un cours à un enseignant ?", en: "How do I assign a course to a teacher?" },
    answer: {
      fr: "Ouvrez \"Attribution des cours\", choisissez l'enseignant et la matière, puis sélectionnez les classes concernées dans le panneau de gauche.",
      en: "Open \"Assign courses\", pick the teacher and subject, then select the relevant classes in the left panel.",
    },
  },
  {
    id: "enter_marks_nonapc",
    roles: ["ADMIN", "CENSEUR"],
    keywords: { fr: ["saisir des notes", "notes séquence", "saisie des notes classe normale"], en: ["enter marks", "sequence marks"] },
    question: { fr: "Comment saisir les notes d'une classe (non-APC) ?", en: "How do I enter marks for a non-APC class?" },
    answer: {
      fr: "Ouvrez \"Saisir les notes\", choisissez la classe, la matière et la séquence, puis remplissez le tableau et cliquez sur l'icône disquette pour enregistrer.",
      en: "Open \"Marks entry\", pick the classe, subject and sequence, fill in the table, then click the save (floppy disk) icon to save.",
    },
  },
  {
    id: "enter_marks_apc",
    roles: ["ADMIN", "CENSEUR"],
    keywords: { fr: ["notes compétences", "classe apc notes", "saisie notes apc"], en: ["apc marks", "competence marks"] },
    question: { fr: "Comment saisir les notes d'une classe APC (compétences) ?", en: "How do I enter marks for an APC (competence-based) class?" },
    answer: {
      fr: "Pour une classe de niveau APC, \"Saisir les notes\" affiche une liste de compétences au lieu des séquences : choisissez la compétence puis remplissez et enregistrez comme pour une classe normale.",
      en: "For an APC-level class, \"Marks entry\" shows a competence list instead of sequences: pick the competence, then fill in and save just like a regular class.",
    },
  },
  {
    id: "lock_sequence",
    roles: ["ADMIN"],
    keywords: { fr: ["verrouiller une séquence", "déverrouiller", "bouton verrouiller"], en: ["lock a sequence", "unlock sequence", "lock button"] },
    question: { fr: "Comment verrouiller ou déverrouiller une séquence de notes ?", en: "How do I lock or unlock a marks sequence?" },
    answer: {
      fr: "Dans \"Saisir les notes\", le bouton \"Verrouiller\"/\"Déverrouiller\" (visible uniquement pour les administrateurs) bloque ou débloque la saisie pour toutes les classes et matières de cette séquence.",
      en: "In \"Marks entry\", the \"Lock\"/\"Unlock\" button (only visible to administrators) blocks or allows entry for every class and subject of that sequence.",
    },
  },
  {
    id: "discipline_admin",
    roles: ["ADMIN"],
    keywords: { fr: ["gérer la discipline", "absences élève", "sanctions élève"], en: ["manage discipline", "student absences", "student sanctions"] },
    question: { fr: "Comment gérer la discipline d'une classe ?", en: "How do I manage a class's discipline?" },
    answer: {
      fr: "Ouvrez \"Discipline\", choisissez la classe, puis enregistrez absences, retards, avertissements ou exclusions pour chaque élève.",
      en: "Open \"Discipline\", pick the classe, then record absences, latenesses, warnings or exclusions for each student.",
    },
  },
  {
    id: "fill_rate_module",
    roles: ["ADMIN"],
    keywords: { fr: ["taux de remplissage", "notes manquantes"], en: ["fill rate", "missing marks"] },
    question: { fr: "Comment voir le taux de remplissage des notes ?", en: "How do I check the marks fill rate?" },
    answer: {
      fr: "Ouvrez \"Taux de remplissage\" pour une vue globale, ou consultez le panneau de remplissage directement dans \"Saisir les notes\" pour une classe précise.",
      en: "Open \"Fill rate\" for a school-wide view, or check the fill-rate panel directly inside \"Marks entry\" for one specific classe.",
    },
  },
  {
    id: "classified_param",
    roles: ["ADMIN"],
    keywords: { fr: ["classé non classé", "paramètre classification", "nc élève"], en: ["classified not classified", "nc parameter"] },
    question: { fr: "Qu'est-ce que le paramètre Classé/Non Classé (NC) ?", en: "What is the Classified/Not Classified (NC) parameter?" },
    answer: {
      fr: "Dans \"Paramètres\", ce réglage par année scolaire décide si un élève peut être déclaré \"Non Classé\" faute d'avoir assez de notes, ou si tous les élèves sont toujours classés.",
      en: "In \"Settings\", this per-school-year setting decides whether a student can be marked \"Not Classified\" for lacking enough marks, or whether every student is always classified.",
    },
  },
  {
    id: "report_cards",
    roles: ["ADMIN"],
    keywords: { fr: ["imprimer les bulletins", "bulletin de notes"], en: ["print report cards", "report card"] },
    question: { fr: "Comment imprimer les bulletins ?", en: "How do I print report cards?" },
    answer: {
      fr: "Ouvrez \"Imprimer les bulletins\", sélectionnez la classe et le trimestre, puis générez le PDF des bulletins des élèves.",
      en: "Open \"Print report cards\", pick the classe and term, then generate the students' report card PDF.",
    },
  },
  {
    id: "manage_account",
    roles: ["ADMIN"],
    keywords: { fr: ["gestion des comptes", "créer un compte utilisateur", "réinitialiser mot de passe utilisateur"], en: ["manage accounts", "create user account", "reset user password"] },
    question: { fr: "Comment gérer les comptes des utilisateurs ?", en: "How do I manage user accounts?" },
    answer: {
      fr: "Ouvrez \"Gestion du compte\" pour voir et modifier les identifiants de tous les comptes (personnel, administrateurs...) de l'école.",
      en: "Open \"Manage account\" to see and edit the credentials of every account (staff, administrators...) at the school.",
    },
  },
  {
    id: "promotions",
    roles: ["ADMIN"],
    keywords: { fr: ["promotion de fin d'année", "passer les élèves en classe supérieure"], en: ["end of year promotion", "promote students"] },
    question: { fr: "Comment gérer les promotions de fin d'année ?", en: "How do I manage end-of-year promotions?" },
    answer: {
      fr: "Ouvrez \"Promotions\" pour décider, classe par classe, quels élèves passent à la classe supérieure pour la prochaine année scolaire.",
      en: "Open \"Promotions\" to decide, classe by classe, which students move up to the next classe for the upcoming school year.",
    },
  },
  {
    id: "scholarship",
    roles: ["ADMIN"],
    keywords: { fr: ["bourse", "boursiers", "moyenne minimale bourse"], en: ["scholarship", "scholarship holders"] },
    question: { fr: "Comment gérer les boursiers ?", en: "How do I manage scholarship holders?" },
    answer: {
      fr: "Ouvrez \"Bourse\" : réglez la moyenne minimale, puis consultez la liste des élèves boursiers (ou uniquement les filles boursières via l'onglet dédié).",
      en: "Open \"Scholarship\": set the minimum average, then check the list of scholarship holders (or only female scholarship holders via the dedicated tab).",
    },
  },
  {
    id: "insolvables",
    roles: ["ADMIN"],
    keywords: { fr: ["insolvables", "élèves qui n'ont pas payé"], en: ["insolvent students", "unpaid fees"] },
    question: { fr: "Comment gérer les élèves insolvables ?", en: "How do I manage insolvent students?" },
    answer: {
      fr: "Ouvrez \"Insolvables\" pour marquer et consulter la liste des élèves n'étant pas à jour de leurs frais de scolarité.",
      en: "Open \"Insolvents\" to flag and view the list of students who are not up to date with their school fees.",
    },
  },
  {
    id: "vp_management",
    roles: ["ADMIN"],
    keywords: { fr: ["gérer les censeurs", "attribuer censeur classe"], en: ["manage censeurs", "manage deputy principals"] },
    question: { fr: "Comment gérer les censeurs (VP) ?", en: "How do I manage deputy principals (Censeur)?" },
    answer: {
      fr: "Ouvrez \"Gérer les censeurs\" pour attribuer un censeur à des classes.",
      en: "Open \"Manage vice principals\" to assign a Censeur to classes.",
    },
  },
  {
    id: "parents_module",
    roles: ["ADMIN"],
    keywords: { fr: ["lier un parent", "gérer les parents", "compte parent"], en: ["link a parent", "manage parents", "parent account"] },
    question: { fr: "Comment lier un parent à un élève ?", en: "How do I link a parent to a student?" },
    answer: {
      fr: "Ouvrez \"Parents\" pour créer un compte parent et le lier à un ou plusieurs élèves - le parent pourra ensuite consulter (en lecture seule) les résultats de ses enfants.",
      en: "Open \"Parents\" to create a parent account and link it to one or more students - the parent can then view (read-only) their children's results.",
    },
  },

  // ---- Role-scoped access explanations ---------------------------------------------------
  {
    id: "sg_discipline_scope",
    roles: ["SG"],
    keywords: { fr: ["classes discipline sg", "je ne vois pas toutes les classes"], en: ["classes I see discipline", "not all classes shown"] },
    question: { fr: "Pourquoi je ne vois que certaines classes dans Discipline ?", en: "Why do I only see some classes in Discipline?" },
    answer: {
      fr: "En tant que Surveillant Général (SG), vous ne voyez dans \"Discipline\" que les classes pour lesquelles vous êtes désigné SG. Contactez l'administrateur si une classe manque.",
      en: "As Senior Supervisor (SG), you only see, in \"Discipline\", the classes you've been assigned as SG for. Contact the administrator if a classe is missing.",
    },
  },
  {
    id: "sg_marks_scope",
    roles: ["SG", "TEACHER"],
    keywords: { fr: ["matières saisie des notes", "je ne vois pas toutes les matières"], en: ["subjects marks entry", "not all subjects shown"] },
    question: { fr: "Pourquoi je ne vois que certaines classes/matières dans Saisir les notes ?", en: "Why do I only see some classes/subjects in Marks entry?" },
    answer: {
      fr: "\"Saisir les notes\" ne montre que les classes et matières que l'administrateur vous a effectivement attribuées (via \"Attribution des cours\"). Contactez-le si une attribution manque.",
      en: "\"Marks entry\" only shows the classes and subjects the administrator has actually assigned to you (via \"Assign courses\"). Contact them if an assignment is missing.",
    },
  },
  {
    id: "censeur_access",
    roles: ["CENSEUR"],
    keywords: { fr: ["accès censeur", "que puis-je faire en tant que censeur"], en: ["censeur access", "what can I do as censeur"] },
    question: { fr: "Quel accès ai-je en tant que censeur ?", en: "What access do I have as Censeur?" },
    answer: {
      fr: "En tant que Censeur, vous avez accès complet à \"Saisir les notes\" pour toutes les classes et matières, comme un administrateur - à une exception près : vous ne pouvez pas verrouiller/déverrouiller une séquence.",
      en: "As Censeur, you have full access to \"Marks entry\" for every classe and subject, just like an administrator - with one exception: you cannot lock/unlock a sequence.",
    },
  },
  {
    id: "parent_view_child",
    roles: ["PARENT"],
    keywords: { fr: ["résultats de mon enfant", "voir les notes de mon enfant", "bulletin mon enfant"], en: ["my child's results", "see my child's marks"] },
    question: { fr: "Comment voir les résultats de mon enfant ?", en: "How do I see my child's results?" },
    answer: {
      fr: "Sur votre tableau de bord, cliquez sur la carte de votre enfant pour voir ses notes par trimestre ou son moyenne annuelle, ainsi que sa discipline.",
      en: "On your dashboard, click your child's card to view their marks by term or their annual average, as well as their discipline record.",
    },
  },
  {
    id: "parent_no_edit",
    roles: ["PARENT"],
    keywords: { fr: ["modifier note enfant", "changer information enfant"], en: ["edit child mark", "change child info"] },
    question: { fr: "Puis-je modifier les notes ou informations de mon enfant ?", en: "Can I edit my child's marks or information?" },
    answer: {
      fr: "Non, l'accès parent est en lecture seule : vous pouvez consulter les résultats et la discipline de votre enfant mais pas les modifier.",
      en: "No, parent access is read-only: you can view your child's results and discipline record, but not edit them.",
    },
  },
  {
    id: "no_module_yet",
    roles: ["BURSAR", "TOP_MANAGEMENT", "STUDENT"],
    keywords: { fr: ["mon module", "que puis-je faire", "aucune fonctionnalité"], en: ["my module", "what can I do", "no functionality"] },
    question: { fr: "Pourquoi je ne vois aucun module sur mon tableau de bord ?", en: "Why is there no module on my dashboard?" },
    answer: {
      fr: "Votre rôle n'a pas encore de module dédié dans l'application - seule la gestion de vos identifiants est disponible pour l'instant. Contactez votre administrateur pour plus d'informations.",
      en: "Your role doesn't have a dedicated module in the app yet - only managing your own credentials is available for now. Contact your administrator for more information.",
    },
  },
];
