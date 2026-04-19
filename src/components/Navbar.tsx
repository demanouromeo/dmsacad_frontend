import { BriefcaseBusiness } from "lucide-react";

const Navbar = () => {
  return (
    <div className="flex justify-center md:justify-between " id="Navbar">
     
        <a href="#" className="text-3xl md:text-xl flex items-center font-bold">
          <BriefcaseBusiness className="mr-0.5 text-primary md:w-6 md:h-6 w-8 h-8" />
          LUC<span className="text-accent">DMSACAD</span>
        </a>
       

    
        <ul className="hidden md:flex  space-x-4 ">
          <li>
            <a href="#Home" className="nav-btn">Accueil</a>
          </li>
          <li>
            <a href="#About" className="nav-btn">A propos</a>
          </li>
          <li>
            <a href="#Experiences" className="nav-btn">Mes expériences</a>
          </li>
          <li>
            <a href="#Projects" className="nav-btn">Mes projets</a>
          </li>
        </ul>
      
      
    </div>
  );
};

export default Navbar;
