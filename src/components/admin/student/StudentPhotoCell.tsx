import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { StudentReader } from "../../../dbmanger/StudentReader";

interface StudentPhotoCellProps {
  studId: number;
  refreshVersion: number;
  onClick: () => void;
}

// One independent async load per row - a slow/missing photo never blocks the table itself or any
// other row, which is what keeps the list from being delayed by image loading. The placeholder
// (same avatar-placeholder/UserRound treatment TopBanner uses) covers "still loading", "no photo
// yet" and "failed to load" identically, since loadStudentPhotoImage already collapses all three
// into a single null result.
const StudentPhotoCell = ({ studId, refreshVersion, onClick }: StudentPhotoCellProps) => {
  const { connection, accessToken } = useAuth();
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    StudentReader.loadStudentPhotoImage(accessToken, connection, studId).then((img) => {
      if (!cancelled && img) {
        setImgUrl(img.src);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [studId, connection, accessToken, refreshVersion]);

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

export default StudentPhotoCell;
