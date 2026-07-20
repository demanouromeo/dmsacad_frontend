import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { StaffReader } from "../../../dbmanger/StaffReader";

interface StaffPhotoCellProps {
  staffId: number;
  refreshVersion: number;
  onClick: () => void;
}

// One independent async load per row - a slow/missing photo never blocks the table itself or any
// other row. Mirrors StudentPhotoCell.tsx exactly.
const StaffPhotoCell = ({ staffId, refreshVersion, onClick }: StaffPhotoCellProps) => {
  const { connection, accessToken } = useAuth();
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    StaffReader.loadStaffPhotoImage(accessToken, connection, staffId).then((img) => {
      if (!cancelled && img) {
        setImgUrl(img.src);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [staffId, connection, accessToken, refreshVersion]);

  return (
    <button type="button" className="cursor-pointer" onClick={onClick}>
      {imgUrl ? (
        <img
          src={imgUrl}
          alt=""
          className="h-10 w-10 object-cover rounded-full"
        />
      ) : (
        <div className="avatar avatar-placeholder">
          <div className="bg-neutral text-neutral-content w-10 rounded-full">
            <UserRound className="w-5 h-5" />
          </div>
        </div>
      )}
    </button>
  );
};

export default StaffPhotoCell;
