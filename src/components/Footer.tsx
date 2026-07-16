import { Container, Facebook, X, Youtube } from "lucide-react";

const Footer = () => {
  return (
    <footer className="footer footer-center  p-10">
      <aside>
        <Container className="w-10 h-10" />
        <p className="font-bold">
          DMS
          <span className="text-accent">DEV</span>
        </p>
        <p>Copyright © {new Date().getFullYear()} - Tous droits réservés</p>
      </aside>
      <nav>
        <div className="grid grid-flow-col gap-4">
          <a href="https://x.com" target="_blank" rel="noopener noreferrer">
            <X className="w-6 h-6 text-current" />
          </a>
          <a
            href="https://youtube.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Youtube className="w-6 h-6 text-current" />
          </a>
          <a
            href="https://facebook.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Facebook className="w-6 h-6 text-current" />
          </a>
        </div>
      </nav>
    </footer>
  );
};

export default Footer;
