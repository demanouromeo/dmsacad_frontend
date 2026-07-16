import { useEffect, useState } from "react";
import { useAuth } from "../../../auth/useAuth";
import { FiliereReader } from "../../../dbmanger/FiliereReader";
import { SpecialityReader } from "../../../dbmanger/SpecialityReader";
import type { Filiere } from "../../../interfaces/Filiere";
import type { Speciality } from "../../../interfaces/Speciality";
import Loading from "../../sharedcomp/Loading";

type FeedbackMessage = { type: "error" | "success"; text: string };

const SpecialityManager = () => {
  const { connection, schoolYear, section, accessToken } = useAuth();

  const [filieres, setFilieres] = useState<Filiere[]>([]);
  const [selectedFiliere, setSelectedFiliere] = useState("");
  const [specialities, setSpecialities] = useState<Speciality[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<FeedbackMessage | null>(null);

  const [newSpecialityName, setNewSpecialityName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [editingFiliere, setEditingFiliere] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const loadSpecialities = async () => {
    setIsLoading(true);
    const list = await SpecialityReader.fetchSpecialities(
      accessToken,
      connection,
      schoolYear,
      section,
    );
    setSpecialities(list);
    setSelectedIds(new Set());
    setIsLoading(false);
  };

  const loadFilieresForSection = async () => {
    const list = await FiliereReader.fetchFilieres(
      accessToken,
      connection,
      schoolYear,
      section,
    );
    setFilieres(list);
    setSelectedFiliere(list.length > 0 ? list[0].nom_filiere : "");
  };

  useEffect(() => {
    setMessage(null);
    loadSpecialities();
    loadFilieresForSection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear, section]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpecialityName.trim() || !selectedFiliere) {
      return;
    }
    setMessage(null);
    const result = await SpecialityReader.saveSpeciality(
      accessToken,
      connection,
      schoolYear,
      section,
      selectedFiliere,
      newSpecialityName.trim(),
      newDescription.trim(),
    );
    setMessage({
      type: result.status ? "success" : "error",
      text: result.message,
    });
    if (result.status) {
      setNewSpecialityName("");
      setNewDescription("");
      loadSpecialities();
    }
  };

  const startEdit = (speciality: Speciality) => {
    setEditingId(speciality.speciality_id);
    setEditingName(speciality.speciality_name);
    setEditingDescription(speciality.description ?? "");
    setEditingFiliere(speciality.nom_filiere);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
    setEditingDescription("");
    setEditingFiliere("");
  };

  const saveEdit = async (speciality: Speciality) => {
    if (!editingName.trim() || !editingFiliere) {
      cancelEdit();
      return;
    }
    if (
      editingName.trim() === speciality.speciality_name &&
      editingDescription.trim() === (speciality.description ?? "") &&
      editingFiliere === speciality.nom_filiere
    ) {
      cancelEdit();
      return;
    }
    setMessage(null);
    const result = await SpecialityReader.updateManySpecialities(
      accessToken,
      connection,
      schoolYear,
      section,
      [
        {
          speciality_id: speciality.speciality_id,
          speciality_name: editingName.trim(),
          description: editingDescription.trim(),
          nom_filiere: editingFiliere,
        },
      ],
    );
    setMessage({
      type: result.status ? "success" : "error",
      text: result.message,
    });
    cancelEdit();
    if (result.status) {
      loadSpecialities();
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
    setSelectedIds((prev) =>
      prev.size === specialities.length
        ? new Set()
        : new Set(specialities.map((s) => s.speciality_id)),
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) {
      return;
    }
    if (!window.confirm(`Supprimer ${selectedIds.size} spécialité(s) ?`)) {
      return;
    }
    setMessage(null);
    const result = await SpecialityReader.deleteSpecialities(
      accessToken,
      connection,
      schoolYear,
      Array.from(selectedIds),
    );
    setMessage({
      type: result.status ? "success" : "error",
      text: result.message,
    });
    if (result.status) {
      loadSpecialities();
    }
  };

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold mb-4">Spécialités</h1>
      <p className="mb-6 opacity-70 text-sm">
        Section : <span className="font-semibold">{section}</span> — utilisez
        l'icône section dans la barre du haut pour changer de section.
      </p>

      {message && (
        <p
          className={`mb-4 ${message.type === "error" ? "text-error" : "text-success"}`}
        >
          {message.text}
        </p>
      )}

      {isLoading ? (
        <Loading />
      ) : (
        <>
          <table className="table w-full max-w-3xl mb-4">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={
                      specialities.length > 0 &&
                      selectedIds.size === specialities.length
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>N°</th>
                <th>Nom de la spécialité</th>
                <th>Filière</th>
                <th>Description</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {specialities.map((speciality, index) => (
                <tr key={speciality.speciality_id}>
                  <td>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={selectedIds.has(speciality.speciality_id)}
                      onChange={() => toggleSelect(speciality.speciality_id)}
                    />
                  </td>
                  <td>{index + 1}</td>
                  <td>
                    {editingId === speciality.speciality_id ? (
                      <input
                        type="text"
                        className="input input-sm w-full"
                        value={editingName}
                        autoFocus
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(speciality);
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                    ) : (
                      speciality.speciality_name
                    )}
                  </td>
                  <td>
                    {editingId === speciality.speciality_id ? (
                      <select
                        className="select select-sm w-full"
                        value={editingFiliere}
                        onChange={(e) => setEditingFiliere(e.target.value)}
                      >
                        {filieres.map((filiere) => (
                          <option
                            key={filiere.filiere_id}
                            value={filiere.nom_filiere}
                          >
                            {filiere.nom_filiere}
                          </option>
                        ))}
                      </select>
                    ) : (
                      speciality.nom_filiere
                    )}
                  </td>
                  <td>
                    {editingId === speciality.speciality_id ? (
                      <input
                        type="text"
                        className="input input-sm w-full"
                        value={editingDescription}
                        onChange={(e) =>
                          setEditingDescription(e.target.value)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(speciality);
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                    ) : (
                      speciality.description || ""
                    )}
                  </td>
                  <td>
                    {editingId === speciality.speciality_id ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-xs btn-primary mr-2"
                          onClick={() => saveEdit(speciality)}
                        >
                          Enregistrer
                        </button>
                        <button
                          type="button"
                          className="btn btn-xs btn-ghost"
                          onClick={cancelEdit}
                        >
                          Annuler
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-xs btn-ghost"
                        onClick={() => startEdit(speciality)}
                      >
                        Modifier
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {specialities.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center opacity-60">
                    Aucune spécialité pour cette section.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <button
            type="button"
            className="btn btn-error btn-sm mb-6"
            disabled={selectedIds.size === 0}
            onClick={handleDeleteSelected}
          >
            Supprimer la sélection ({selectedIds.size})
          </button>
        </>
      )}

      <form
        onSubmit={handleAdd}
        className="flex flex-wrap gap-2 max-w-2xl items-start"
      >
        <select
          className="select"
          value={selectedFiliere}
          onChange={(e) => setSelectedFiliere(e.target.value)}
          disabled={filieres.length === 0}
        >
          {filieres.length === 0 && <option value="">Aucune filière</option>}
          {filieres.map((filiere) => (
            <option key={filiere.filiere_id} value={filiere.nom_filiere}>
              {filiere.nom_filiere}
            </option>
          ))}
        </select>
        <input
          type="text"
          className="input"
          placeholder="Nouvelle spécialité"
          value={newSpecialityName}
          onChange={(e) => setNewSpecialityName(e.target.value)}
        />
        <input
          type="text"
          className="input"
          placeholder="Description (optionnel)"
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
        />
        <button
          type="submit"
          className="btn btn-neutral"
          disabled={filieres.length === 0}
        >
          Ajouter
        </button>
      </form>
      {filieres.length === 0 && (
        <p className="text-sm opacity-60 mt-2">
          Créez d'abord une filière pour cette section.
        </p>
      )}
    </div>
  );
};

export default SpecialityManager;
