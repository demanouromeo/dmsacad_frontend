import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./App.css";
import Footer from "./components/Footer";
import LoginForm from "./components/logincomps/LoginForm";
import Dashboard from "./components/dashboard/Dashboard";
import RequireAuth from "./components/routing/RequireAuth";
import RequireRole from "./components/routing/RequireRole";
import FiliereManager from "./components/admin/filiere/FiliereManager";
import SpecialityManager from "./components/admin/speciality/SpecialityManager";
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
