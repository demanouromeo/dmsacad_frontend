import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./App.css";
import Footer from "./components/Footer";
import LoginForm from "./components/logincomps/LoginForm";
import TeacherIndex from "./components/dashboard/TeacherIndex";
import { useCookies } from "react-cookie";

function App() {
  //const [count, setCount] = useState(0)
  const [cookies] = useCookies(["schoolName"]);
  return (
    <BrowserRouter>
      <div className=" ">
        <Routes>
          <Route path="/" element={<LoginForm />} />
          <Route path="/dashboard-teacher" element={<TeacherIndex />} />
        </Routes>
        { cookies.schoolName
        ?<Footer />
        :null}
      </div>
    </BrowserRouter>
  );
}

export default App;
