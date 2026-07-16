import { MyConstants } from "./MyConstants";
import type { Section } from "../interfaces/Section";

export class SectionReader {
  // /api/section/getSections requires jwt.auth (any connected user) - the Authorization
  // header is mandatory here, unlike MyReader's unauthenticated allSchools/getSchoolYears.
  public static fetchSections = async (
    accessToken: string | null,
    connection: string,
    year: string,
  ): Promise<Section[]> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/section/getSections` +
      `?connection=${encodeURIComponent(connection)}` +
      `&year=${encodeURIComponent(year)}`;
    try {
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: {
          accept: "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(
        `SectionReader.fetchSections(): Error fetching sections: ${error}`,
      );
      return [];
    }
  };
}
