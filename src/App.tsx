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
import SchoolInfoManager from "./components/admin/schoolinfo/SchoolInfoManager";
import EffectifsManager from "./components/admin/effectifs/EffectifsManager";
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
                <Route path="/admin/classes" element={<ClasseManager />} />
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
                  path="/admin/subjects/matieres-classes"
                  element={<SubjectClasseManager />}
                />
                <Route
                  path="/admin/subjects/matieres-competences"
                  element={<SubjectCompetenceManager />}
                />
                <Route path="/admin/staffs" element={<StaffManager />} />
                <Route path="/admin/students" element={<StudentManager />} />
                <Route
                  path="/admin/course-assignment"
                  element={<CourseAssignmentManager />}
                />
                <Route
                  path="/admin/school-info"
                  element={<SchoolInfoManager />}
                />
                <Route path="/admin/effectifs" element={<EffectifsManager />} />
                <Route path="/admin/mark-entry" element={<MarkEntryManager />} />
                <Route path="/admin/mark-sheet" element={<MarkSheetManager />} />
                <Route path="/admin/fill-rate" element={<FillRateHub />} />
                <Route path="/admin/fill-rate/global" element={<FillRateGlobalManager />} />
                <Route path="/admin/fill-rate/class" element={<FillRateClassManager />} />
                <Route path="/admin/discipline" element={<DisciplineManager />} />
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
                <Route
                  path="/admin/promotion"
                  element={<PromotionManager />}
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
