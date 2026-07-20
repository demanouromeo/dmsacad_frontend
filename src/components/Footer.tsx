import { Facebook, Mail, Phone, X, Youtube } from "lucide-react";
import brandLogo from "../assets/brand.ico";

const Footer = () => {
  return (
    <footer className="footer footer-center p-10 border-t border-base-content/10 bg-base-100">
      <aside className="flex flex-col items-center gap-1">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-1">
          <img src={brandLogo} alt="" className="w-7 h-7 object-contain" />
        </div>
        <p className="font-bold tracking-wide">
          DMS
          <span className="text-primary">DEV</span>
        </p>
        <p className="opacity-60 text-sm">
          Copyright © {new Date().getFullYear()} - Tous droits réservés
        </p>
      </aside>
      <nav className="flex flex-col items-center gap-2">
        <span className="footer-title">Contact</span>
        <a
          href="mailto:dmsschoolmanager@gmail.com"
          className="flex items-center gap-2 text-sm opacity-80 hover:opacity-100 hover:text-primary"
        >
          <Mail className="w-4 h-4 shrink-0" />
          dmsschoolmanager@gmail.com
        </a>
        <a
          href="tel:+237698640670"
          className="flex items-center gap-2 text-sm opacity-80 hover:opacity-100 hover:text-primary"
        >
          <Phone className="w-4 h-4 shrink-0" />
          698 64 06 70
        </a>
      </nav>
      <nav>
        <div className="grid grid-flow-col gap-2">
          <a
            href="https://x.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-circle btn-sm opacity-70 hover:opacity-100 hover:text-primary"
          >
            <X className="w-5 h-5 text-current" />
          </a>
          <a
            href="https://youtube.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-circle btn-sm opacity-70 hover:opacity-100 hover:text-primary"
          >
            <Youtube className="w-5 h-5 text-current" />
          </a>
          <a
            href="https://facebook.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-circle btn-sm opacity-70 hover:opacity-100 hover:text-primary"
          >
            <Facebook className="w-5 h-5 text-current" />
          </a>
        </div>
      </nav>
    </footer>
  );
};

export default Footer;
