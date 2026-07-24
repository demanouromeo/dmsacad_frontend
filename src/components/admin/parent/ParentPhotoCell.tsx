import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { StudParentReader } from "../../../dbmanger/StudParentReader";

interface ParentPhotoCellProps {
  pId: number;
  refreshVersion: number;
  onClick: () => void;
}

// One independent async load per row - verbatim adaptation of StudentPhotoCell.tsx, swapped to
// StudParentReader/p_id.
const ParentPhotoCell = ({ pId, refreshVersion, onClick }: ParentPhotoCellProps) => {
  const { connection, accessToken } = useAuth();
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    StudParentReader.loadParentPhotoImage(accessToken, connection, pId).then((img) => {
      if (!cancelled && img) {
        setImgUrl(img.src);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pId, connection, accessToken, refreshVersion]);

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

export default ParentPhotoCell;
