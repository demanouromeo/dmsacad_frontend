import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./App.css";
import Footer from "./components/Footer";
import LoginForm from "./components/logincomps/LoginForm";
import Dashboard from "./components/dashboard/Dashboard";
import RequireAuth from "./components/routing/RequireAuth";
import RequireRole from "./components/routing/RequireRole";
import FiliereManager from "./components/admin/filiere/FiliereManager";
import SpecialityManager from "./components/admin/speciality/SpecialityManager";
import ClasseManager from "./components/admin/classe/ClasseManager";
import SubjectManager from "./components/admin/subject/SubjectManager";
import SubjectsHub from "./components/admin/subject/SubjectsHub";
import GroupeManager from "./components/admin/groupe/GroupeManager";
import SubjectClasseManager from "./components/admin/subjectclasse/SubjectClasseManager";
import SubjectCompetenceManager from "./components/admin/subjectcompetence/SubjectCompetenceManager";
import StaffManager from "./components/admin/staff/StaffManager";
import StudentManager from "./components/admin/student/StudentManager";
import CourseAssignmentManager from "./components/admin/courseassignment/CourseAssignmentManager";
import VpManager from "./components/admin/vp/VpManager";
import SchoolInfoManager from "./components/admin/schoolinfo/SchoolInfoManager";
import EffectifsHub from "./components/admin/effectifs/EffectifsHub";
import EffectifsManager from "./components/admin/effectifs/EffectifsManager";
import PvManager from "./components/admin/effectifs/PvManager";
import StatGroupeesManager from "./components/admin/effectifs/StatGroupeesManager";
import SyntheseGlobaleManager from "./components/admin/effectifs/SyntheseGlobaleManager";
import SyntheseResultatsManager from "./components/admin/effectifs/SyntheseResultatsManager";
import StatMatiereManager from "./components/admin/effectifs/StatMatiereManager";
import ClassementManager from "./components/admin/effectifs/ClassementManager";
import StatParClasseManager from "./components/admin/effectifs/StatParClasseManager";
import MarkEntryManager from "./components/admin/marks/MarkEntryManager";
import MarkSheetManager from "./components/admin/marksheet/MarkSheetManager";
import FillRateHub from "./components/admin/fillrate/FillRateHub";
import FillRateGlobalManager from "./components/admin/fillrate/FillRateGlobalManager";
import FillRateClassManager from "./components/admin/fillrate/FillRateClassManager";
import DisciplineManager from "./components/admin/discipline/DisciplineManager";
import AccountManager from "./components/admin/account/AccountManager";
import AccountHub from "./components/admin/account/AccountHub";
import SelfCredentialsManager from "./components/admin/account/SelfCredentialsManager";
import SettingsHub from "./components/admin/settings/SettingsHub";
import ClassifiedParamManager from "./components/admin/settings/ClassifiedParamManager";
import AnnualRcAvgManager from "./components/admin/settings/AnnualRcAvgManager";
import ThParamManager from "./components/admin/settings/ThParamManager";
import PromotionSettingsManager from "./components/admin/settings/PromotionSettingsManager";
import ReportCardManager from "./components/admin/reportcard/ReportCardManager";
import InsolvableManager from "./components/admin/insolvable/InsolvableManager";
import PromotionManager from "./components/admin/promotion/PromotionManager";
import BasculementManager from "./components/admin/basculement/BasculementManager";
import ScholarshipManager from "./components/admin/scholarship/ScholarshipManager";
import ParentManager from "./components/admin/parent/ParentManager";
import ParentDashboard from "./components/parent/ParentDashboard";
import ParentChildDetailManager from "./components/parent/ParentChildDetailManager";
import { useCookies } from "react-cookie";

function App() {
  //const [count, setCount] = useState(0)
  const [cookies] = useCookies(["schoolName"]);
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<LoginForm />} />
            <Route element={<RequireAuth />}>
              <Route path="/dashboard" element={<Dashboard />} />
              {/* Any authenticated role, not ADMIN-gated - see SelfCredentialsManager's own comment
                  and Dashboard.tsx's new button, the only entry point non-ADMIN roles have. */}
              <Route
                path="/account/credentials"
                element={<SelfCredentialsManager />}
              />
              <Route element={<RequireRole allow={["ADMIN"]} />}>
                <Route path="/admin/filieres" element={<FiliereManager />} />
                <Route
                  path="/admin/specialities"
                  element={<SpecialityManager />}
                />
                <Route path="/admin/subjects" element={<SubjectsHub />} />
                <Route
                  path="/admin/subjects/matieres"
                  element={<SubjectManager />}
                />
                <Route
                  path="/admin/subjects/groupes"
                  element={<GroupeManager />}
                />
                <Route
                  path="/admin/subjects/matieres-competences"
                  element={<SubjectCompetenceManager />}
                />
                <Route path="/admin/staffs" element={<StaffManager />} />
                <Route
                  path="/admin/course-assignment"
                  element={<CourseAssignmentManager />}
                />
                <Route path="/admin/vp-management" element={<VpManager />} />
                <Route
                  path="/admin/school-info"
                  element={<SchoolInfoManager />}
                />
                <Route path="/admin/effectifs" element={<EffectifsHub />} />
                <Route
                  path="/admin/effectifs/par-classe"
                  element={<EffectifsManager />}
                />
                <Route path="/admin/effectifs/pv" element={<PvManager />} />
                <Route
                  path="/admin/effectifs/stat-groupees"
                  element={<StatGroupeesManager />}
                />
                <Route
                  path="/admin/effectifs/synthese-globale"
                  element={<SyntheseGlobaleManager />}
                />
                <Route
                  path="/admin/effectifs/synthese-resultats"
                  element={<SyntheseResultatsManager />}
                />
                <Route
                  path="/admin/effectifs/stats-matiere"
                  element={<StatMatiereManager />}
                />
                <Route
                  path="/admin/effectifs/classement"
                  element={<ClassementManager />}
                />
                <Route
                  path="/admin/effectifs/stat-par-classe"
                  element={<StatParClasseManager />}
                />
                <Route
                  path="/admin/mark-sheet"
                  element={<MarkSheetManager />}
                />
                <Route path="/admin/fill-rate" element={<FillRateHub />} />
                <Route
                  path="/admin/fill-rate/global"
                  element={<FillRateGlobalManager />}
                />
                <Route
                  path="/admin/fill-rate/class"
                  element={<FillRateClassManager />}
                />
                <Route path="/admin/manage-accounts" element={<AccountHub />} />
                <Route
                  path="/admin/manage-accounts/all"
                  element={<AccountManager />}
                />
                <Route path="/admin/settings" element={<SettingsHub />} />
                <Route
                  path="/admin/settings/classified-param"
                  element={<ClassifiedParamManager />}
                />
                <Route
                  path="/admin/settings/annual-rc-avg"
                  element={<AnnualRcAvgManager />}
                />
                <Route
                  path="/admin/settings/th-param"
                  element={<ThParamManager />}
                />
                <Route
                  path="/admin/settings/promotion"
                  element={<PromotionSettingsManager />}
                />
                <Route
                  path="/admin/report-cards"
                  element={<ReportCardManager />}
                />
                <Route
                  path="/admin/insolvables"
                  element={<InsolvableManager />}
                />
                <Route path="/admin/promotion" element={<PromotionManager />} />
                <Route
                  path="/admin/basculement"
                  element={<BasculementManager />}
                />
                <Route
                  path="/admin/scholarship"
                  element={<ScholarshipManager />}
                />
                <Route path="/admin/parents" element={<ParentManager />} />
              </Route>
              {/* Discipline: ADMIN plus SG and CENSEUR, who can only manage discipline for classes
                  assigned to them as SG (Classe.sg_id) / CENSEUR (Classe.vp_id) - filtered
                  client-side in DisciplineManager itself. */}
              <Route element={<RequireRole allow={["ADMIN", "SG", "CENSEUR"]} />}>
                <Route
                  path="/admin/discipline"
                  element={<DisciplineManager />}
                />
              </Route>
              {/* Classes / Subject-of-classe / Students: ADMIN plus CENSEUR, who can only manage the
                  classes assigned to them as VP (Classe.vp_id) - filtered client-side in each of
                  these three managers. CENSEUR keeps full add/delete/modify on students and on
                  subject-of-classe assignments, but only row-level rename on classes themselves -
                  see ClasseManager's own isAdmin-gated sections for the structural actions (add,
                  import, bulk delete, APC toggle) that stay ADMIN-only. */}
              <Route element={<RequireRole allow={["ADMIN", "CENSEUR"]} />}>
                <Route path="/admin/classes" element={<ClasseManager />} />
                <Route
                  path="/admin/subjects/matieres-classes"
                  element={<SubjectClasseManager />}
                />
                <Route path="/admin/students" element={<StudentManager />} />
              </Route>
              {/* Mark entry: ADMIN (full access), SG/TEACHER (restricted to their own course
                  assignments - see MarkEntryManager's isRestrictedToAssignments), and CENSEUR (full
                  read/write access like ADMIN but never allowed to lock/unlock a sequence). */}
              <Route element={<RequireRole allow={["ADMIN", "SG", "CENSEUR", "TEACHER"]} />}>
                <Route
                  path="/admin/mark-entry"
                  element={<MarkEntryManager />}
                />
              </Route>
              <Route element={<RequireRole allow={["PARENT"]} />}>
                <Route path="/parent/dashboard" element={<ParentDashboard />} />
                <Route
                  path="/parent/child/:studId"
                  element={<ParentChildDetailManager />}
                />
              </Route>
            </Route>
          </Routes>
        </div>
        {cookies.schoolName ? <Footer /> : null}
      </div>
    </BrowserRouter>
  );
}

export default App;
