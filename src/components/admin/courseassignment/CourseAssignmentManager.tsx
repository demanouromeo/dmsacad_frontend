import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useConfirm } from "../../../confirm/useConfirm";
import { useLanguage } from "../../../i18n/useLanguage";
import {
  courseAssignmentTranslations,
  exportTranslations,
} from "../../../i18n/translations";
import { StaffReader } from "../../../dbmanger/StaffReader";
import { SubjectReader } from "../../../dbmanger/SubjectReader";
import { ClasseReader } from "../../../dbmanger/ClasseReader";
import type { Staff } from "../../../interfaces/Staff";
import type { Subject } from "../../../interfaces/Subject";
import type { ClasseOfSubject } from "../../../interfaces/ClasseOfSubject";
import type { CourseAssignment } from "../../../interfaces/CourseAssignment";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import { buildExportFilename, exportRowsToCsv } from "../../../utils/exportData";
import { drawPdfLetterhead, drawPdfFooters } from "../../../utils/exportHeader";
import { useSchoolHeader } from "../../../hooks/useSchoolHeader";

interface StaffLike {
  staff_id: number;
  name: string;
  surname: string | null;
}

// "Name Surname (staff_id)" everywhere a staff is picked/shown on screen - same disambiguation
// convention as ClasseManager's classe-master/SG pickers, needed here too since two different
// teachers with the same name can legitimately both teach the same subject/classe. `includeId`
// is turned off for the printed output, which has no room/need for it.
const formatStaffLabel = (staff: StaffLike, includeId = true): string =>
  `${staff.name}${staff.surname ? ` ${staff.surname}` : ""}${
    includeId ? ` (${staff.staff_id})` : ""
  }`;

const CourseAssignmentManager = () => {
  const { connection, schoolYear, section, accessToken } = useAuth();
  const showToast = useToast();
  const confirm = useConfirm();
  const [language] = useLanguage();
  const t = courseAssignmentTranslations[language];
  const et = exportTranslations[language];
  const schoolHeader = useSchoolHeader();

  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classesOfSubject, setClassesOfSubject] = useState<ClasseOfSubject[]>(
    [],
  );
  const [allAttributions, setAllAttributions] = useState<CourseAssignment[]>(
    [],
  );

  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(
    null,
  );

  const [leftSelectedClasseIds, setLeftSelectedClasseIds] = useState<
    Set<number>
  >(new Set());
  const [rightSelectedRowIds, setRightSelectedRowIds] = useState<Set<number>>(
    new Set(),
  );

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const sortedStaff = [...staffList].sort((a, b) =>
    formatStaffLabel(a, false).localeCompare(formatStaffLabel(b, false)),
  );
  const sortedSubjects = [...subjects].sort((a, b) =>
    a.subject_title.localeCompare(b.subject_title),
  );

  const loadBaseData = async () => {
    setIsLoading(true);
    const [staff, subjectList, attributions] = await Promise.all([
      StaffReader.fetchStaff(accessToken, connection, schoolYear),
      SubjectReader.fetchSubjects(accessToken, connection, schoolYear, section),
      StaffReader.fetchAllAttributionsOfSection(
        accessToken,
        connection,
        schoolYear,
        section,
      ),
    ]);
    setStaffList(staff);
    setSubjects(subjectList);
    setAllAttributions(attributions);
    const sStaff = [...staff].sort((a, b) =>
      formatStaffLabel(a, false).localeCompare(formatStaffLabel(b, false)),
    );
    const sSubjects = [...subjectList].sort((a, b) =>
      a.subject_title.localeCompare(b.subject_title),
    );
    setSelectedStaffId((prev) =>
      prev !== null && staff.some((s) => s.staff_id === prev)
        ? prev
        : (sStaff[0]?.staff_id ?? null),
    );
    setSelectedSubjectId((prev) =>
      prev !== null && subjectList.some((s) => s.subject_id === prev)
        ? prev
        : (sSubjects[0]?.subject_id ?? null),
    );
    setIsLoading(false);
  };

  useEffect(() => {
    loadBaseData();
    setLeftSelectedClasseIds(new Set());
    setRightSelectedRowIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear, section]);

  const reloadAttributions = async () => {
    const attributions = await StaffReader.fetchAllAttributionsOfSection(
      accessToken,
      connection,
      schoolYear,
      section,
    );
    setAllAttributions(attributions);
  };

  useEffect(() => {
    if (selectedSubjectId === null) {
      setClassesOfSubject([]);
      return;
    }
    let cancelled = false;
    ClasseReader.fetchClassesOfSubject(
      accessToken,
      connection,
      schoolYear,
      section,
      selectedSubjectId,
    ).then((list) => {
      if (!cancelled) {
        setClassesOfSubject(list);
        setLeftSelectedClasseIds(new Set());
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubjectId, connection, schoolYear, section]);

  useEffect(() => {
    setRightSelectedRowIds(new Set());
  }, [selectedStaffId]);

  const selectedStaff = staffList.find((s) => s.staff_id === selectedStaffId) ?? null;
  const selectedSubject =
    subjects.find((s) => s.subject_id === selectedSubjectId) ?? null;

  const leftPanelRows = classesOfSubject.map((c) => {
    const otherTeachers = allAttributions
      .filter(
        (a) =>
          a.subject_id === selectedSubjectId &&
          a.classe_id === c.classe_id &&
          a.staff_id !== selectedStaffId,
      )
      .map((a) => {
        const staff = staffList.find((s) => s.staff_id === a.staff_id);
        return staff ? formatStaffLabel(staff) : a.name;
      });
    return { ...c, otherTeachers };
  });

  const rightPanelRows = allAttributions.filter(
    (a) => a.staff_id === selectedStaffId,
  );

  const toggleLeftClasse = (classeId: number) => {
    setLeftSelectedClasseIds((prev) => {
      const next = new Set(prev);
      if (next.has(classeId)) {
        next.delete(classeId);
      } else {
        next.add(classeId);
      }
      return next;
    });
  };

  const toggleRightRow = (rowId: number) => {
    setRightSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const toggleSelectAllRight = () => {
    const filteredIds = rightPanelRows.map((r) => r.id);
    const allSelected =
      filteredIds.length > 0 &&
      filteredIds.every((id) => rightSelectedRowIds.has(id));
    setRightSelectedRowIds((prev) => {
      const next = new Set(prev);
      filteredIds.forEach((id) => {
        if (allSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      });
      return next;
    });
  };

  const handleSaveAssignments = async () => {
    if (selectedStaffId === null || selectedSubjectId === null) {
      return;
    }
    if (leftSelectedClasseIds.size === 0) {
      showToast(t.noClasseSelected, { type: "warning" });
      return;
    }
    setIsSaving(true);
    const rows = Array.from(leftSelectedClasseIds).map((classeId) => ({
      staff_id: selectedStaffId,
      subject_id: selectedSubjectId,
      classe_id: classeId,
    }));
    const result = await StaffReader.batchAssignCourses(
      accessToken,
      connection,
      schoolYear,
      section,
      rows,
    );
    setIsSaving(false);
    showToast(result.status ? t.saveSuccess : t.saveFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      setLeftSelectedClasseIds(new Set());
      await reloadAttributions();
    }
  };

  const handleRemoveRow = async (row: CourseAssignment) => {
    setIsSaving(true);
    const result = await StaffReader.removeCourse(
      accessToken,
      connection,
      schoolYear,
      section,
      row.subject_id,
      row.classe_id,
      row.staff_id,
    );
    setIsSaving(false);
    showToast(result.status ? t.removeSuccess : t.removeFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      await reloadAttributions();
    }
  };

  const handleBulkRemoveSelected = async () => {
    if (rightSelectedRowIds.size === 0) {
      return;
    }
    const confirmed = await confirm(t.removeConfirm(rightSelectedRowIds.size), {
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    const rowsToRemove = rightPanelRows.filter((r) =>
      rightSelectedRowIds.has(r.id),
    );
    setIsSaving(true);
    const result = await StaffReader.batchRemoveCourses(
      accessToken,
      connection,
      schoolYear,
      section,
      rowsToRemove.map((r) => ({
        staff_id: r.staff_id,
        subject_id: r.subject_id,
        classe_id: r.classe_id,
      })),
    );
    setIsSaving(false);
    showToast(result.status ? t.removeSuccess : t.removeFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      setRightSelectedRowIds(new Set());
      await reloadAttributions();
    }
  };

  const handleRemoveAllOfStaff = async () => {
    if (!selectedStaff || rightPanelRows.length === 0) {
      return;
    }
    const confirmed = await confirm(
      t.removeAllConfirm(formatStaffLabel(selectedStaff, false)),
      { danger: true },
    );
    if (!confirmed) {
      return;
    }
    setIsSaving(true);
    const result = await StaffReader.removeAllCoursesOfStaff(
      accessToken,
      connection,
      schoolYear,
      section,
      selectedStaff.staff_id,
    );
    setIsSaving(false);
    showToast(result.status ? t.removeAllSuccess : t.removeAllFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      setRightSelectedRowIds(new Set());
      await reloadAttributions();
    }
  };

  const handleDeleteAllSection = async () => {
    if (allAttributions.length === 0) {
      return;
    }
    const confirmed = await confirm(
      t.deleteAllSectionConfirm(schoolYear, section),
      { danger: true },
    );
    if (!confirmed) {
      return;
    }
    setIsSaving(true);
    const result = await StaffReader.batchRemoveCourses(
      accessToken,
      connection,
      schoolYear,
      section,
      allAttributions.map((a) => ({
        staff_id: a.staff_id,
        subject_id: a.subject_id,
        classe_id: a.classe_id,
      })),
    );
    setIsSaving(false);
    showToast(
      result.status ? t.deleteAllSectionSuccess : t.deleteAllSectionFailure,
      { type: result.status ? "info" : "danger" },
    );
    if (result.status) {
      setLeftSelectedClasseIds(new Set());
      setRightSelectedRowIds(new Set());
      await reloadAttributions();
    }
  };

  // Exports the right panel exactly as shown (the selected teacher's own courses) - a plain
  // header row + data rows, same exportRowsToCsv convention as every other admin screen. Separate
  // from Print, which is a different, whole-section document grouped by classe rather than staff.
  const handleExportExcel = () => {
    if (!selectedStaff) {
      return;
    }
    exportRowsToCsv(
      buildExportFilename(
        [t.title, formatStaffLabel(selectedStaff, false), connection, schoolYear, section],
        "csv",
      ),
      [
        {
          header: t.tableHeaderIndex,
          accessor: (_r: CourseAssignment, index: number) => index + 1,
        },
        {
          header: t.tableHeaderClasse,
          accessor: (r: CourseAssignment) => r.classe_name,
        },
        {
          header: t.tableHeaderSubject,
          accessor: (r: CourseAssignment) => r.subject_title,
        },
      ],
      rightPanelRows,
    );
  };

  const handlePrint = async () => {
    if (allAttributions.length === 0) {
      showToast(t.printEmpty, { type: "warning" });
      return;
    }
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const doc = new jsPDF();
    let y = schoolHeader ? drawPdfLetterhead(doc, schoolHeader) : 15;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(t.printTitle, 14, y);
    y += 8;

    // Groups preserve AllAttributionsOfSection's own ORDER BY level, classe_name, subject_title -
    // no client-side re-sort needed, first-seen order of classe_id already matches it.
    const grouped: { classe_name: string; rows: CourseAssignment[] }[] = [];
    const groupIndexByClasseId = new Map<number, number>();
    for (const row of allAttributions) {
      let index = groupIndexByClasseId.get(row.classe_id);
      if (index === undefined) {
        index = grouped.length;
        groupIndexByClasseId.set(row.classe_id, index);
        grouped.push({ classe_name: row.classe_name, rows: [] });
      }
      grouped[index].rows.push(row);
    }

    const pageHeight = doc.internal.pageSize.getHeight();
    for (const group of grouped) {
      if (y > pageHeight - 40) {
        doc.addPage();
        y = 15;
      }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(t.printClasseLabel(group.classe_name), 14, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        head: [
          [
            t.printTableHeaderIndex,
            t.printTableHeaderSubject,
            t.printTableHeaderStaff,
          ],
        ],
        body: group.rows.map((row, index) => [
          String(index + 1),
          row.subject_title,
          row.name,
        ]),
      });
      // jspdf-autotable patches the doc instance with `lastAutoTable` at runtime (see its own
      // source, jspdf.plugin.autotable.js) - its published types don't expose this on the plain
      // jsPDF type this project imports, hence the cast.
      y =
        (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
          .finalY + 10;
    }

    drawPdfFooters(doc);
    doc.save(
      buildExportFilename([t.printTitle, connection, schoolYear, section], "pdf"),
    );
  };

  return (
    <div className="p-10">
      {isSaving && <LoadingOverlay />}
      <h1 className="text-2xl font-bold mb-4">{t.title}</h1>
      <p className="mb-4 opacity-70 text-sm">
        {t.sectionHint(section, schoolYear)}
      </p>

      {isLoading ? (
        <Loading />
      ) : (
        <>
          <div className="flex flex-wrap gap-6 mb-6">
            <div className="flex items-center gap-2">
              <label className="font-medium">{t.staffLabel}</label>
              <select
                className="select w-64"
                value={selectedStaffId ?? ""}
                onChange={(e) => setSelectedStaffId(Number(e.target.value))}
                disabled={sortedStaff.length === 0}
              >
                {sortedStaff.length === 0 && (
                  <option value="">{t.noStaffOption}</option>
                )}
                {sortedStaff.map((staff) => (
                  <option key={staff.staff_id} value={staff.staff_id}>
                    {formatStaffLabel(staff, false)} ({staff.staff_id})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="font-medium">{t.subjectLabel}</label>
              <select
                className="select w-64"
                value={selectedSubjectId ?? ""}
                onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
                disabled={sortedSubjects.length === 0}
              >
                {sortedSubjects.length === 0 && (
                  <option value="">{t.noSubjectOption}</option>
                )}
                {sortedSubjects.map((subject) => (
                  <option key={subject.subject_id} value={subject.subject_id}>
                    {subject.subject_title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div>
              <h2 className="font-semibold mb-2">
                {selectedSubject
                  ? t.leftPanelTitle(selectedSubject.subject_title)
                  : ""}
              </h2>
              <div className="border rounded p-3 max-h-96 overflow-y-auto">
                {leftPanelRows.length === 0 && (
                  <p className="text-center opacity-60 py-4">{t.emptyLeft}</p>
                )}
                {leftPanelRows.map((row) => (
                  <label
                    key={row.classe_id}
                    className="flex items-center gap-2 py-1 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={leftSelectedClasseIds.has(row.classe_id)}
                      onChange={() => toggleLeftClasse(row.classe_id)}
                    />
                    <span>
                      {row.classe_name}
                      {row.otherTeachers.length > 0 &&
                        ` (${row.otherTeachers.join(", ")})`}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h2 className="font-semibold mb-2">
                {selectedStaff
                  ? t.rightPanelTitle(formatStaffLabel(selectedStaff, false))
                  : ""}
              </h2>
              <div className="overflow-x-auto border rounded max-h-96 overflow-y-auto">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={
                            rightPanelRows.length > 0 &&
                            rightPanelRows.every((r) =>
                              rightSelectedRowIds.has(r.id),
                            )
                          }
                          onChange={toggleSelectAllRight}
                        />
                      </th>
                      <th>{t.tableHeaderIndex}</th>
                      <th>{t.tableHeaderClasse}</th>
                      <th>{t.tableHeaderSubject}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rightPanelRows.map((row, index) => (
                      <tr key={row.id}>
                        <td>
                          <input
                            type="checkbox"
                            className="checkbox"
                            checked={rightSelectedRowIds.has(row.id)}
                            onChange={() => toggleRightRow(row.id)}
                          />
                        </td>
                        <td>{index + 1}</td>
                        <td>{row.classe_name}</td>
                        <td>{row.subject_title}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-error btn-xs btn-square"
                            onClick={() => handleRemoveRow(row)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {rightPanelRows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center opacity-60">
                          {t.emptyRight}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                className="btn btn-error btn-sm mt-2"
                disabled={rightSelectedRowIds.size === 0}
                onClick={handleBulkRemoveSelected}
              >
                {t.deleteSelectionBtn(rightSelectedRowIds.size)}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={leftSelectedClasseIds.size === 0}
              onClick={handleSaveAssignments}
            >
              {t.saveBtn}
            </button>
            <button
              type="button"
              className="btn btn-error"
              disabled={rightPanelRows.length === 0}
              onClick={handleRemoveAllOfStaff}
            >
              {t.removeAllBtn}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={rightPanelRows.length === 0}
              onClick={handleExportExcel}
            >
              {et.excelBtn}
            </button>
            <button
              type="button"
              className="btn btn-neutral"
              disabled={allAttributions.length === 0}
              onClick={handlePrint}
            >
              {t.printBtn}
            </button>
            <button
              type="button"
              className="btn btn-error ml-auto"
              disabled={allAttributions.length === 0}
              onClick={handleDeleteAllSection}
            >
              {t.deleteAllSectionBtn(schoolYear, section)}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default CourseAssignmentManager;
