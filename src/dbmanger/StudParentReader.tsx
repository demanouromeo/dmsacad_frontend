import { MyConstants } from "./MyConstants";
import type { StudParent, ParentChild, AssignableStudent } from "../interfaces/StudParent";
import type { ApiResult } from "../interfaces/ApiResult";

const NETWORK_ERROR_RESULT: ApiResult = {
  status: false,
  message: "Network error. Please try again later.",
};

// Same fetch-as-Blob -> URL.createObjectURL -> Image() pattern as
// StudentReader.loadStudentPhotoImage - the photo is always loaded from a same-origin blob: URL,
// never directly from the API URL.
const loadImageElement = (url: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });

export class StudParentReader {
  // Not year-scoped - stud_parent has no sy_id/year-link table.
  public static fetchParents = async (
    accessToken: string | null,
    connection: string,
  ): Promise<StudParent[]> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/parents/allParents` +
      `?connection=${encodeURIComponent(connection)}`;
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
      console.error(`StudParentReader.fetchParents(): Error fetching parents: ${error}`);
      return [];
    }
  };

  public static saveParent = async (
    accessToken: string | null,
    connection: string,
    p_name: string,
    p_surname: string,
    p_phone1: string,
    login: string,
    pwd: string,
    email: string,
  ): Promise<ApiResult> => {
    return StudParentReader.postJson(
      "api/parents/saveParent",
      accessToken,
      { connection, p_name, p_surname, p_phone1, login, pwd, email },
      "saveParent",
    );
  };

  // `pwd` is optional - omit/empty to leave the account password unchanged, same convention as
  // StaffReader.updateStaff's optional pwd.
  public static updateParent = async (
    accessToken: string | null,
    connection: string,
    p_id: number,
    p_name: string,
    p_surname: string,
    p_phone1: string,
    login: string,
    email: string,
    pwd?: string,
  ): Promise<ApiResult> => {
    return StudParentReader.postJson(
      "api/parents/updateParent",
      accessToken,
      {
        connection,
        p_id,
        p_name,
        p_surname,
        p_phone1,
        login,
        email,
        ...(pwd ? { pwd } : {}),
      },
      "updateParent",
    );
  };

  public static deleteParents = async (
    accessToken: string | null,
    connection: string,
    parentIds: number[],
  ): Promise<ApiResult> => {
    const data = parentIds.map((p_id) => ({ p_id }));
    return StudParentReader.postJson(
      "api/parents/deleteManyParents",
      accessToken,
      { connection, data: JSON.stringify(data), data_size: data.length },
      "deleteParents",
    );
  };

  public static loadParentPhotoImage = async (
    accessToken: string | null,
    connection: string,
    pId: number,
  ): Promise<HTMLImageElement | null> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/parents/parentPhoto` +
      `?connection=${encodeURIComponent(connection)}` +
      `&p_id=${pId}`;
    try {
      const response = await fetch(targetUrl, {
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });
      if (!response.ok) {
        return null;
      }
      const blob = await response.blob();
      return loadImageElement(URL.createObjectURL(blob));
    } catch (error) {
      console.error(`StudParentReader.loadParentPhotoImage(): Error: ${error}`);
      return null;
    }
  };

  // Multipart FormData (uploaded file) - bypasses postJson, same as StudentReader.uploadStudentPhoto.
  public static uploadParentPhoto = async (
    accessToken: string | null,
    connection: string,
    pId: number,
    photo: Blob,
  ): Promise<ApiResult> => {
    const targetUrl = `${MyConstants.getBaseUrl()}api/parents/uploadParentPhoto`;
    const formData = new FormData();
    formData.append("connection", connection);
    formData.append("p_id", String(pId));
    formData.append("photo", photo, "photo.jpg");
    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: formData,
      });
      return await response.json();
    } catch (error) {
      console.error(`StudParentReader.uploadParentPhoto(): Error: ${error}`);
      return NETWORK_ERROR_RESULT;
    }
  };

  // Backs both ParentManager's "children of selected parent" panel and the parent portal's own
  // "my children" list.
  public static fetchChildrenOfParent = async (
    accessToken: string | null,
    connection: string,
    year: string,
    pId: number,
  ): Promise<ParentChild[]> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/parents/childrenOfParent` +
      `?connection=${encodeURIComponent(connection)}` +
      `&year=${encodeURIComponent(year)}` +
      `&p_id=${pId}`;
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
      console.error(`StudParentReader.fetchChildrenOfParent(): Error fetching children: ${error}`);
      return [];
    }
  };

  public static fetchStudentsOfClasseForAssignment = async (
    accessToken: string | null,
    connection: string,
    year: string,
    classeId: number,
  ): Promise<AssignableStudent[]> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/parents/studentsOfClasseForAssignment` +
      `?connection=${encodeURIComponent(connection)}` +
      `&year=${encodeURIComponent(year)}` +
      `&classe_id=${classeId}`;
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
        `StudParentReader.fetchStudentsOfClasseForAssignment(): Error fetching roster: ${error}`,
      );
      return [];
    }
  };

  public static assignStudentsToParent = async (
    accessToken: string | null,
    connection: string,
    pId: number,
    studIds: number[],
  ): Promise<ApiResult> => {
    const data = studIds.map((stud_id) => ({ stud_id }));
    return StudParentReader.postJson(
      "api/parents/assignStudentsToParent",
      accessToken,
      { connection, p_id: pId, data: JSON.stringify(data), data_size: data.length },
      "assignStudentsToParent",
    );
  };

  public static removeStudentsFromParent = async (
    accessToken: string | null,
    connection: string,
    studIds: number[],
  ): Promise<ApiResult> => {
    const data = studIds.map((stud_id) => ({ stud_id }));
    return StudParentReader.postJson(
      "api/parents/removeStudentsFromParent",
      accessToken,
      { connection, data: JSON.stringify(data), data_size: data.length },
      "removeStudentsFromParent",
    );
  };

  private static postJson = async (
    path: string,
    accessToken: string | null,
    body: object,
    callerName: string,
  ): Promise<ApiResult> => {
    const targetUrl = `${MyConstants.getBaseUrl()}${path}`;
    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(body),
      });
      return await response.json();
    } catch (error) {
      console.error(`StudParentReader.${callerName}(): Error: ${error}`);
      return NETWORK_ERROR_RESULT;
    }
  };
}
