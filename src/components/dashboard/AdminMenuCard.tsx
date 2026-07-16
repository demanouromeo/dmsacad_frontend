import { Link } from "react-router-dom";

interface AdminMenuCardProps {
  label: string;
  icon: string;
  to?: string;
}

const AdminMenuCard = ({ label, icon, to }: AdminMenuCardProps) => {
  const content = (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-2xl bg-base-100 shadow-md p-6 h-full text-center ${
        to
          ? "cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all"
          : "opacity-50 cursor-default"
      }`}
    >
      <img src={icon} alt="" className="w-16 h-16 object-contain" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );

  if (to) {
    return <Link to={to}>{content}</Link>;
  }

  return content;
};

export default AdminMenuCard;
