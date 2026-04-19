import "./App.css";
import About from "./components/About";
import Experiences from "./components/Experiences";
import Footer from "./components/Footer";
import Home from "./components/Home";
import LoginForm from "./components/logincomps/LoginForm";
import Navbar from "./components/Navbar";
import Projects from "./components/Projects";

function App() {
  //const [count, setCount] = useState(0)
  return (
    <div className=" ">
      <div className="">
        <LoginForm />
      </div>
      {/* <div className="paddingx-1">
        <Navbar />
      </div>
      <div className="paddingx-1">
        <Home />
      </div>

      <div className="">
        <About />
      </div>
      <div className="paddingx-1 min-h-screen">
        <Experiences />
      </div>

      <div className="paddingx-1">
        <Projects />
      </div> */}
      <Footer />
    </div>
  );
}

export default App;
