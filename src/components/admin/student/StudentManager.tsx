import { useEffect, useRef, useState } from "react";
import { RefreshCw, Upload, Wand2 } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useConfirm } from "../../../confirm/useConfirm";
import { useLanguage } from "../../../i18n/useLanguage";
import {
  studentManagerTranslations,
  exportTranslations,
} from "../../../i18n/translations";
import { ClasseReader } from "../../../dbmanger/ClasseReader";
import { StudentReader } from "../../../dbmanger/StudentReader";
import type { Classe } from "../../../interfaces/Classe";
import type { Student } from "../../../interfaces/Student";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import ExportButtons from "../../sharedcomp/ExportButtons";
import StudentPhotoCell from "./StudentPhotoCell";
import StudentPhotoDialog from "./StudentPhotoDialog";
import { useSchoolHeader } from "../../../hooks/useSchoolHeader";
import { sanitizeStudentName, parseStudentImportFile } from "../../../utils/studentImport";
import { generateUniqueMatricule } from "../../../utils/matricule";
import { stripHtmlTags } from "../../../utils/apiErrors";
import {
  buildTimestampedFilename,
  capitalizeSectionName,
  exportRowsToCsv,
} from "../../../utils/exportData";
import {
  drawPdfLetterhead,
  drawPdfFooters,
  drawPdfSignature,
} from "../../../utils/exportHeader";

const MIN_NAME_LENGTH = 2;

interface EditableFields {
  name: string;
  surname: string;
  bday: string;
  bplace: string;
  sexe: "M" | "F";
  repeating: boolean;
  handicape: boolean;
}

// One-shot "Manage students" screen scoped to a single classe at a time (like SubjectClasseManager/
// SubjectCompetenceManager) - allStudentsOfClasse hardcodes repeating/cas_social to 0, so the real
// values are merged in from allStudClassOfAClasse (the student_classe pivot) by stud_id. Phone/parent
// linkage is deliberately out of scope - there's no backend parent module yet (no StudParentController/
// routes), so unlike the reference mockup this screen has no Phone filter/column.
const StudentManager = () => {
  const { connection, schoolYear, section, accessToken } = useAuth();
  const showToast = useToast();
  const confirm = useConfirm();
  const [language] = useLanguage();
  const t = studentManagerTranslations[language];
  const et = exportTranslations[language];
  const schoolHeader = useSchoolHeader();

  const [classes, setClasses] = useState<Classe[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [selectedClasseId, setSelectedClasseId] = useState<number | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [newFields, setNewFields] = useState<EditableFields>({
    name: "",
    surname: "",
    bday: "",
    bplace: "",
    sexe: "M",
    repeating: false,
    handicape: false,
  });
  const [newMatricule, setNewMatricule] = useState("");
  const [isGeneratingMatricule, setIsGeneratingMatricule] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingFields, setEditingFields] = useState<EditableFields | null>(null);
  const [editingMatricule, setEditingMatricule] = useState("");

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const [photoDialogStudent, setPhotoDialogStudent] = useState<Student | null>(null);
  const [photoVersions, setPhotoVersions] = useState<Record<number, number>>({});
  const bumpPhotoVersion = (studId: number) => {
    setPhotoVersions((prev) => ({ ...prev, [studId]: (prev[studId] ?? 0) + 1 }));
  };

  const selectedClasse = classes.find((c) => c.classe_id === selectedClasseId) ?? null;

  useEffect(() => {
    const load = async () => {
      setIsLoadingClasses(true);
      const list = await ClasseReader.fetchClasses(accessToken, connection, schoolYear, section);
      setClasses(list);
      setSelectedClasseId((prev) => {
        if (prev !== null && list.some((c) => c.classe_id === prev)) {
          return prev;
        }
        return list.length > 0 ? list[0].classe_id : null;
      });
      setIsLoadingClasses(false);
    };
    load();
    setSearchQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear, section]);

  const loadStudents = async (classeId: number) => {
    setIsLoadingStudents(true);
    const [studentRows, pivotRows] = await Promise.all([
      StudentReader.fetchStudentsOfClasse(accessToken, connection, schoolYear, classeId),
      StudentReader.fetchStudentClasseOfClasse(accessToken, connection, schoolYear, classeId),
    ]);
    const pivotByStudId = new Map(pivotRows.map((p) => [p.stud_id, p]));
    const merged = studentRows
      .map((s) => {
        const pivot = pivotByStudId.get(s.stud_id);
        return {
          ...s,
          repeating: pivot?.repeating ? 1 : 0,
          cas_social: pivot?.cas_social ? 1 : 0,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    setStudents(merged);
    setSelectedIds(new Set());
    setIsLoadingStudents(false);
  };

  useEffect(() => {
    if (selectedClasseId !== null) {
      loadStudents(selectedClasseId);
    } else {
      setStudents([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClasseId]);

  const resetAddForm = () => {
    setNewFields({
      name: "",
      surname: "",
      bday: "",
      bplace: "",
      sexe: "M",
      repeating: false,
      handicape: false,
    });
    setNewMatricule("");
  };

  const handleGenerateMatricule = async () => {
    if (!selectedClasse) {
      return;
    }
    setIsGeneratingMatricule(true);
    const all = await StudentReader.fetchAllStudentsOfYear(accessToken, connection, schoolYear);
    const existing = new Set(
      all.map((s) => s.matricule).filter((m): m is string => Boolean(m)),
    );
    setIsGeneratingMatricule(false);
    setNewMatricule(
      generateUniqueMatricule(schoolYear, selectedClasse.classe_name, section, existing),
    );
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedClasseId === null) {
      return;
    }
    const trimmedName = newFields.name.trim();
    if (trimmedName.length < MIN_NAME_LENGTH) {
      showToast(t.nameRequired, { type: "warning" });
      return;
    }
    setIsSaving(true);
    const result = await StudentReader.saveAStudent(accessToken, connection, schoolYear, selectedClasseId, {
      name: trimmedName,
      surname: newFields.surname.trim(),
      bday: newFields.bday,
      bplace: newFields.bplace.trim(),
      sexe: newFields.sexe,
      repeating: newFields.repeating,
      handicape: newFields.handicape,
      cas_social: false,
      matricule: newMatricule.trim(),
    });
    setIsSaving(false);
    showToast(result.status ? t.addSuccess : t.addFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      resetAddForm();
      loadStudents(selectedClasseId);
    }
  };

  const startEdit = (student: Student) => {
    setEditingId(student.stud_id);
    setEditingFields({
      name: student.name,
      surname: student.surname ?? "",
      bday: student.bday ?? "",
      bplace: student.bplace ?? "",
      sexe: student.sexe === "F" ? "F" : "M",
      repeating: student.repeating === 1,
      handicape: student.handicape === 1,
    });
    setEditingMatricule(student.matricule ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingFields(null);
    setEditingMatricule("");
  };

  const saveEdit = async (student: Student) => {
    if (!editingFields) {
      return;
    }
    const trimmedName = editingFields.name.trim();
    if (trimmedName.length < MIN_NAME_LENGTH) {
      showToast(t.nameRequired, { type: "warning" });
      return;
    }
    setIsSaving(true);
    const result = await StudentReader.updateStudents(accessToken, connection, schoolYear, [
      {
        stud_id: student.stud_id,
        name: trimmedName,
        surname: editingFields.surname.trim(),
        bday: editingFields.bday,
        bplace: editingFields.bplace.trim(),
        sexe: editingFields.sexe,
        repeating: editingFields.repeating,
        handicape: editingFields.handicape,
        cas_social: student.cas_social === 1,
        matricule: editingMatricule.trim(),
      },
    ]);
    setIsSaving(false);
    showToast(result.status ? t.updateSuccess : t.updateFailure, {
      type: result.status ? "info" : "danger",
    });
    cancelEdit();
    if (result.status && selectedClasseId !== null) {
      loadStudents(selectedClasseId);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    const filteredIds = filteredStudents.map((s) => s.stud_id);
    const allFilteredSelected =
      filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredIds.forEach((id) => {
        if (allFilteredSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      });
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) {
      return;
    }
    const confirmed = await confirm(t.deleteConfirm(selectedIds.size), { danger: true });
    if (!confirmed) {
      return;
    }
    setIsSaving(true);
    const result = await StudentReader.deleteStudents(
      accessToken,
      connection,
      schoolYear,
      Array.from(selectedIds),
    );
    setIsSaving(false);
    showToast(result.status ? t.deleteSuccess : t.deleteFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status && selectedClasseId !== null) {
      loadStudents(selectedClasseId);
    }
  };

  const persistImportedStudents = async (
    rows: { name: string; surname: string; matricule: string; sexe: "M" | "F"; bday: string; bplace: string; repeating: boolean }[],
    override: boolean,
  ) => {
    if (selectedClasseId === null) {
      return;
    }
    setIsSaving(true);
    const result = await StudentReader.saveManyStudents(
      accessToken,
      connection,
      schoolYear,
      selectedClasseId,
      override,
      rows.map((row) => ({
        name: row.name,
        surname: row.surname,
        bday: row.bday,
        bplace: row.bplace,
        sexe: row.sexe,
        repeating: row.repeating,
        handicape: false,
        cas_social: false,
        matricule: row.matricule,
      })),
    );
    setIsSaving(false);
    if (result.status) {
      showToast(t.importSuccess(rows.length), { type: "info" });
      loadStudents(selectedClasseId);
    } else {
      const detail = stripHtmlTags(result.message);
      showToast(detail ? t.importFailureDetail(detail) : t.importFailure, {
        type: "danger",
      });
    }
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || selectedClasseId === null) {
      return;
    }

    setIsSaving(true);
    const parsed = await parseStudentImportFile(file);
    setIsSaving(false);
    if (!parsed.status) {
      switch (parsed.error.type) {
        case "unsupportedExtension":
          showToast(t.importUnsupportedExtension, { type: "danger" });
          break;
        case "emptyFile":
          showToast(t.importEmptyFile, { type: "danger" });
          break;
        case "badHeader":
          showToast(t.importBadHeader, { type: "danger" });
          break;
        case "emptyName":
          showToast(t.importEmptyName(parsed.error.row), { type: "danger" });
          break;
      }
      return;
    }

    const wantsDelete = await confirm(t.importDeleteExistingQuestion, {
      confirmLabel: t.importDeleteBtn,
      cancelLabel: t.importAddWithoutDeleteBtn,
    });

    if (wantsDelete) {
      const reallyDelete = await confirm(t.importDeleteConfirmAgain, {
        danger: true,
        confirmLabel: t.importDeleteFinalBtn,
      });
      if (!reallyDelete) {
        return;
      }
      await persistImportedStudents(parsed.students, true);
      return;
    }

    await persistImportedStudents(parsed.students, false);
  };

  const filteredStudents = students.filter((s) => {
    const q = searchQuery.trim().toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.surname ?? "").toLowerCase().includes(q) ||
      (s.matricule ?? "").toLowerCase().includes(q) ||
      (s.bplace ?? "").toLowerCase().includes(q)
    );
  });

  const stats = {
    filles: students.filter((s) => s.sexe === "F").length,
    garcons: students.filter((s) => s.sexe === "M").length,
    total: students.length,
    redoublants: students.filter((s) => s.repeating === 1).length,
    handicapes: students.filter((s) => s.handicape === 1).length,
    casSocial: students.filter((s) => s.cas_social === 1).length,
  };
  const nouveaux = stats.total - stats.redoublants;

  const exportColumns = [
    { header: t.tableHeaderMatricule, accessor: (s: Student) => s.matricule ?? "" },
    { header: t.tableHeaderName, accessor: (s: Student) => s.name },
    { header: t.tableHeaderSurname, accessor: (s: Student) => s.surname ?? "" },
    { header: t.tableHeaderBday, accessor: (s: Student) => s.bday ?? "" },
    { header: t.tableHeaderBplace, accessor: (s: Student) => s.bplace ?? "" },
    { header: t.tableHeaderSexe, accessor: (s: Student) => s.sexe },
    {
      header: t.tableHeaderRepeating,
      accessor: (s: Student) => (s.repeating === 1 ? t.repeatingYes : t.repeatingNo),
    },
  ];

  // Same columns as exportColumns, with the row index prepended - only the printed PDF needs a
  // visible Nº column, CSV/Excel already has an implicit row number via the spreadsheet itself.
  const pdfExportColumns = [
    { header: t.tableHeaderIndex, accessor: (_s: Student, index: number) => index + 1 },
    ...exportColumns,
  ];

  const handleExportExcel = () => {
    if (!selectedClasse) {
      return;
    }
    exportRowsToCsv(
      buildTimestampedFilename(
        "Liste des élèves",
        [
          `Classe ${selectedClasse.classe_name}`,
          `Section ${capitalizeSectionName(section)}`,
        ],
        "csv",
      ),
      exportColumns,
      students,
    );
  };

  // Custom layout instead of the generic exportRowsToPdf: this document needs a title block
  // (title left, "Année Scolaire"/"Classe" labels, a small G/F/T stats grid on the right) inserted
  // right after the letterhead, which the generic single-line title exporter can't produce.
  const handleExportPdf = async () => {
    if (!selectedClasse) {
      return;
    }
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const blockTop = schoolHeader ? drawPdfLetterhead(doc, schoolHeader) : 15;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(t.printTitle, 14, blockTop + 6);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(t.printYearLabel, 14, blockTop + 14);
    doc.setFont("helvetica", "bold");
    doc.text(
      schoolYear,
      14 + doc.getTextWidth(`${t.printYearLabel} `),
      blockTop + 14,
    );

    const classeBlockX = pageWidth * 0.42;
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(t.printClasseLabel, classeBlockX, blockTop + 10);
    doc.setFont("helvetica", "bold");
    doc.text(
      selectedClasse.classe_name,
      classeBlockX + doc.getTextWidth(`${t.printClasseLabel} `),
      blockTop + 10,
    );

    autoTable(doc, {
      startY: blockTop,
      margin: { left: pageWidth - 60 },
      tableWidth: 46,
      theme: "grid",
      styles: {
        halign: "center",
        fontSize: 10,
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
      },
      headStyles: { fontStyle: "bold" },
      head: [["G", "F", "T"]],
      body: [[String(stats.garcons), String(stats.filles), String(stats.total)]],
    });
    // jspdf-autotable patches the doc instance with `lastAutoTable` at runtime - its published
    // types don't expose this on the plain jsPDF type this project imports, hence the cast.
    const statsTableFinalY = (
      doc as unknown as { lastAutoTable: { finalY: number } }
    ).lastAutoTable.finalY;

    const listStartY = Math.max(blockTop + 18, statsTableFinalY) + 6;
    autoTable(doc, {
      startY: listStartY,
      head: [pdfExportColumns.map((c) => c.header)],
      body: students.map((row, index) =>
        pdfExportColumns.map((c) => String(c.accessor(row, index))),
      ),
    });
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } })
      .lastAutoTable.finalY;

    if (schoolHeader) {
      drawPdfSignature(doc, schoolHeader, finalY);
    }
    drawPdfFooters(doc, schoolHeader);

    doc.save(
      buildTimestampedFilename(
        "Liste des élèves",
        [
          `Classe ${selectedClasse.classe_name}`,
          `Section ${capitalizeSectionName(section)}`,
        ],
        "pdf",
      ),
    );
  };

  return (
    <div className="p-10">
      {isSaving && <LoadingOverlay />}
      <h1 className="text-2xl font-bold mb-4">{t.title}</h1>
      <p className="mb-4 opacity-70 text-sm">{t.sectionHint(section)}</p>

      {isLoadingClasses ? (
        <Loading />
      ) : classes.length === 0 ? (
        <p className="opacity-60">{t.emptyClasses}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <label className="font-medium">{t.classeLabel}</label>
            <select
              className="select w-56"
              value={selectedClasseId ?? ""}
              onChange={(e) => setSelectedClasseId(Number(e.target.value))}
            >
              {classes.map((c) => (
                <option key={c.classe_id} value={c.classe_id}>
                  {c.classe_name}
                </option>
              ))}
            </select>

            <input
              ref={importFileInputRef}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={handleImportFileChange}
            />
            <button
              type="button"
              className="btn btn-neutral btn-sm gap-2"
              disabled={isLoadingStudents}
              onClick={() => importFileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4" />
              {t.importBtn}
            </button>
            <ExportButtons
              onExportExcel={handleExportExcel}
              onExportPdf={handleExportPdf}
              excelLabel={et.excelBtn}
              pdfLabel={et.pdfBtn}
              disabled={isLoadingStudents || students.length === 0}
            />
            <button
              type="button"
              className="btn btn-neutral btn-sm gap-2"
              disabled={isLoadingStudents || selectedClasseId === null}
              onClick={() => selectedClasseId && loadStudents(selectedClasseId)}
            >
              <RefreshCw className="w-4 h-4" />
              {t.refreshBtn}
            </button>
          </div>

          <div className="flex flex-wrap gap-4 mb-4 text-sm bg-base-200 rounded px-4 py-2">
            <span>
              {t.statFilles}: <b>{stats.filles}</b>
            </span>
            <span>
              {t.statGarcons}: <b>{stats.garcons}</b>
            </span>
            <span>
              {t.statTotal}: <b>{stats.total}</b>
            </span>
            <span>
              {t.statRedoublants}: <b>{stats.redoublants}</b>
            </span>
            <span>
              {t.statNouveaux}: <b>{nouveaux}</b>
            </span>
            <span>
              {t.statHandicapes}: <b>{stats.handicapes}</b>
            </span>
            <span>
              {t.statCasSocial}: <b>{stats.casSocial}</b>
            </span>
          </div>

          {isLoadingStudents ? (
            <Loading />
          ) : (
            <>
              <input
                type="text"
                className="input w-full max-w-2xl mb-4"
                placeholder={t.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="overflow-x-auto w-full mb-4">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={
                            filteredStudents.length > 0 &&
                            filteredStudents.every((s) => selectedIds.has(s.stud_id))
                          }
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th>{t.tableHeaderIndex}</th>
                      <th>{t.tableHeaderPhoto}</th>
                      <th>{t.tableHeaderMatricule}</th>
                      <th>{t.tableHeaderName}</th>
                      <th>{t.tableHeaderSurname}</th>
                      <th>{t.tableHeaderBday}</th>
                      <th>{t.tableHeaderBplace}</th>
                      <th>{t.tableHeaderSexe}</th>
                      <th>{t.tableHeaderRepeating}</th>
                      <th>{t.tableHeaderHandicape}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student, index) => {
                      const isEditing = editingId === student.stud_id;
                      return (
                        <tr key={student.stud_id}>
                          <td>
                            <input
                              type="checkbox"
                              className="checkbox"
                              checked={selectedIds.has(student.stud_id)}
                              onChange={() => toggleSelect(student.stud_id)}
                            />
                          </td>
                          <td>{index + 1}</td>
                          <td>
                            <StudentPhotoCell
                              studId={student.stud_id}
                              refreshVersion={photoVersions[student.stud_id] ?? 0}
                              onClick={() => setPhotoDialogStudent(student)}
                            />
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                type="text"
                                className="input input-sm w-full"
                                value={editingMatricule}
                                onChange={(e) => setEditingMatricule(e.target.value)}
                              />
                            ) : (
                              student.matricule || ""
                            )}
                          </td>
                          <td>
                            {isEditing && editingFields ? (
                              <input
                                type="text"
                                className="input input-sm w-full"
                                value={editingFields.name}
                                autoFocus
                                onChange={(e) =>
                                  setEditingFields({
                                    ...editingFields,
                                    name: sanitizeStudentName(e.target.value),
                                  })
                                }
                              />
                            ) : (
                              student.name
                            )}
                          </td>
                          <td>
                            {isEditing && editingFields ? (
                              <input
                                type="text"
                                className="input input-sm w-full"
                                value={editingFields.surname}
                                onChange={(e) =>
                                  setEditingFields({
                                    ...editingFields,
                                    surname: sanitizeStudentName(e.target.value),
                                  })
                                }
                              />
                            ) : (
                              student.surname || ""
                            )}
                          </td>
                          <td>
                            {isEditing && editingFields ? (
                              <input
                                type="date"
                                className="input input-sm w-full"
                                value={editingFields.bday}
                                onChange={(e) =>
                                  setEditingFields({ ...editingFields, bday: e.target.value })
                                }
                              />
                            ) : (
                              student.bday || ""
                            )}
                          </td>
                          <td>
                            {isEditing && editingFields ? (
                              <input
                                type="text"
                                className="input input-sm w-full"
                                value={editingFields.bplace}
                                onChange={(e) =>
                                  setEditingFields({
                                    ...editingFields,
                                    bplace: sanitizeStudentName(e.target.value),
                                  })
                                }
                              />
                            ) : (
                              student.bplace || ""
                            )}
                          </td>
                          <td>
                            {isEditing && editingFields ? (
                              <select
                                className="select select-sm"
                                value={editingFields.sexe}
                                onChange={(e) =>
                                  setEditingFields({
                                    ...editingFields,
                                    sexe: e.target.value === "F" ? "F" : "M",
                                  })
                                }
                              >
                                <option value="M">{t.sexeMale}</option>
                                <option value="F">{t.sexeFemale}</option>
                              </select>
                            ) : (
                              student.sexe
                            )}
                          </td>
                          <td>
                            {isEditing && editingFields ? (
                              <select
                                className="select select-sm"
                                value={editingFields.repeating ? "1" : "0"}
                                onChange={(e) =>
                                  setEditingFields({
                                    ...editingFields,
                                    repeating: e.target.value === "1",
                                  })
                                }
                              >
                                <option value="0">{t.repeatingNo}</option>
                                <option value="1">{t.repeatingYes}</option>
                              </select>
                            ) : student.repeating === 1 ? (
                              t.repeatingYes
                            ) : (
                              t.repeatingNo
                            )}
                          </td>
                          <td>
                            {isEditing && editingFields ? (
                              <input
                                type="checkbox"
                                className="checkbox"
                                checked={editingFields.handicape}
                                onChange={(e) =>
                                  setEditingFields({
                                    ...editingFields,
                                    handicape: e.target.checked,
                                  })
                                }
                              />
                            ) : (
                              <input type="checkbox" className="checkbox" checked={student.handicape === 1} disabled />
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-xs btn-primary mr-2"
                                  onClick={() => saveEdit(student)}
                                >
                                  {t.saveBtn}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-xs btn-ghost"
                                  onClick={cancelEdit}
                                >
                                  {t.cancelBtn}
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-xs btn-ghost"
                                onClick={() => startEdit(student)}
                              >
                                {t.editBtn}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {students.length === 0 && (
                      <tr>
                        <td colSpan={12} className="text-center opacity-60">
                          {t.emptyList}
                        </td>
                      </tr>
                    )}
                    {students.length > 0 && filteredStudents.length === 0 && (
                      <tr>
                        <td colSpan={12} className="text-center opacity-60">
                          {t.noSearchResults}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                className="btn btn-error btn-sm mb-6"
                disabled={selectedIds.size === 0}
                onClick={handleDeleteSelected}
              >
                {t.deleteSelectionBtn(selectedIds.size)}
              </button>
            </>
          )}

          <form onSubmit={handleAdd} className="flex flex-wrap gap-2 max-w-4xl items-start">
            <div className="tooltip" data-tip={t.nameHint}>
              <input
                type="text"
                className="input"
                placeholder={t.addPlaceholderName}
                value={newFields.name}
                onChange={(e) =>
                  setNewFields({ ...newFields, name: sanitizeStudentName(e.target.value) })
                }
              />
            </div>
            <div className="tooltip" data-tip={t.surnameHint}>
              <input
                type="text"
                className="input"
                placeholder={t.addPlaceholderSurname}
                value={newFields.surname}
                onChange={(e) =>
                  setNewFields({ ...newFields, surname: sanitizeStudentName(e.target.value) })
                }
              />
            </div>
            <div className="tooltip" data-tip={t.bdayHint}>
              <input
                type="date"
                className="input"
                value={newFields.bday}
                onChange={(e) => setNewFields({ ...newFields, bday: e.target.value })}
              />
            </div>
            <div className="tooltip" data-tip={t.bplaceHint}>
              <input
                type="text"
                className="input"
                placeholder={t.addPlaceholderBplace}
                value={newFields.bplace}
                onChange={(e) =>
                  setNewFields({ ...newFields, bplace: sanitizeStudentName(e.target.value) })
                }
              />
            </div>
            <div className="tooltip" data-tip={t.sexeHint}>
              <select
                className="select"
                value={newFields.sexe}
                onChange={(e) =>
                  setNewFields({ ...newFields, sexe: e.target.value === "F" ? "F" : "M" })
                }
              >
                <option value="M">{t.sexeMale}</option>
                <option value="F">{t.sexeFemale}</option>
              </select>
            </div>
            <div className="tooltip" data-tip={t.repeatingHint}>
              <select
                className="select"
                value={newFields.repeating ? "1" : "0"}
                onChange={(e) =>
                  setNewFields({ ...newFields, repeating: e.target.value === "1" })
                }
              >
                <option value="0">{t.repeatingNo}</option>
                <option value="1">{t.repeatingYes}</option>
              </select>
            </div>
            <div className="tooltip" data-tip={t.handicapeHint}>
              <label className="flex items-center gap-2">
                {t.tableHeaderHandicape}
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={newFields.handicape}
                  onChange={(e) => setNewFields({ ...newFields, handicape: e.target.checked })}
                />
              </label>
            </div>
            <div className="tooltip" data-tip={t.matriculeHint}>
              <input
                type="text"
                className="input"
                placeholder={t.addPlaceholderMatricule}
                value={newMatricule}
                onChange={(e) => setNewMatricule(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn btn-neutral gap-2"
              disabled={!selectedClasse || isGeneratingMatricule}
              onClick={handleGenerateMatricule}
            >
              <Wand2 className="w-4 h-4" />
              {t.generateMatriculeBtn}
            </button>
            <button type="submit" className="btn btn-neutral">
              {t.addBtn}
            </button>
          </form>
        </>
      )}

      <StudentPhotoDialog
        student={photoDialogStudent}
        onClose={() => setPhotoDialogStudent(null)}
        onSaved={bumpPhotoVersion}
      />
    </div>
  );
};

export default StudentManager;
