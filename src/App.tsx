import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./App.css";
import Footer from "./components/Footer";
import LoginForm from "./components/logincomps/LoginForm";
import Dashboard from "./components/dashboard/Dashboard";
import RequireAuth from "./components/routing/RequireAuth";
import { useCookies } from "react-cookie";

function App() {
  //const [count, setCount] = useState(0)
  const [cookies] = useCookies(["schoolName"]);
  return (
    <BrowserRouter>
      <div className=" ">
        <Routes>
          <Route path="/" element={<LoginForm />} />
          <Route element={<RequireAuth />}>
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>
        </Routes>
        {cookies.schoolName ? <Footer /> : null}
      </div>
    </BrowserRouter>
  );
}

export default App;
