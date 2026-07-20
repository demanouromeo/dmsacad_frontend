import { Link } from "react-router-dom";

interface AdminMenuCardProps {
  label: string;
  icon: string;
  to?: string;
}

const AdminMenuCard = ({ label, icon, to }: AdminMenuCardProps) => {
  const content = (
    <div
      className={`group flex flex-col items-center justify-center gap-3 rounded-2xl bg-base-100 border border-base-content/5 shadow-md p-6 h-full text-center ${
        to
          ? "cursor-pointer hover:shadow-xl hover:shadow-primary/10 hover:border-primary/30 hover:-translate-y-1 transition-all duration-200"
          : "opacity-40 cursor-default"
      }`}
    >
      <div
        className={`flex items-center justify-center w-16 h-16 rounded-2xl bg-base-200 ${
          to ? "group-hover:bg-primary/10 transition-colors duration-200" : ""
        }`}
      >
        <img src={icon} alt="" className="w-10 h-10 object-contain" />
      </div>
      <span className="text-sm font-medium leading-tight">{label}</span>
    </div>
  );

  if (to) {
    return <Link to={to}>{content}</Link>;
  }

  return content;
};

export default AdminMenuCard;
