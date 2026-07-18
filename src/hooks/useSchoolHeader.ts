import { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { SchoolInfoReader } from "../dbmanger/SchoolInfoReader";
import type { SchoolHeader } from "../utils/exportHeader";

const EMPTY_HEADER: SchoolHeader = { config: null, logoImage: null };

// Shared by every export-capable admin screen (Filiere/Speciality/Classe/Staff/Subject) to back
// the PDF/Excel export letterhead - resolves the current year's school identity fields and the
// logo (already loaded as an <img>, ready to embed) together, re-fetching whenever the connected
// school or school year changes.
export const useSchoolHeader = (): SchoolHeader => {
  const { connection, schoolYear, accessToken } = useAuth();
  const [header, setHeader] = useState<SchoolHeader>(EMPTY_HEADER);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!connection || !schoolYear) {
        if (!cancelled) {
          setHeader(EMPTY_HEADER);
        }
        return;
      }
      const config = await SchoolInfoReader.fetchSchoolConfigOfYear(
        accessToken,
        connection,
        schoolYear,
      );
      // Goes through the API proxy (loadLogoImageForExport), not the static-file loadLogoImage
      // the school-info preview uses - this logo gets embedded into a PDF via canvas (see
      // exportHeader.ts), which needs CORS headers the remote static-file host doesn't send.
      const logoImage = await SchoolInfoReader.loadLogoImageForExport(
        accessToken,
        connection,
      );
      if (!cancelled) {
        setHeader({ config, logoImage });
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [connection, schoolYear, accessToken]);

  return header;
};
