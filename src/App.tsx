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
import FillRateManager from "./components/admin/fillrate/FillRateManager";
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
                <Route path="/admin/fill-rate" element={<FillRateManager />} />
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
