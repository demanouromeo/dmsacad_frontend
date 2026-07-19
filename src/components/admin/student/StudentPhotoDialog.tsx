import { useEffect, useRef, useState } from "react";
import { RotateCcw, RotateCw, Upload, UserRound } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useLanguage } from "../../../i18n/useLanguage";
import { studentManagerTranslations } from "../../../i18n/translations";
import { StudentReader } from "../../../dbmanger/StudentReader";
import type { Student } from "../../../interfaces/Student";
import Loading from "../../sharedcomp/Loading";

interface StudentPhotoDialogProps {
  student: Student | null;
  onClose: () => void;
  onSaved: (studId: number) => void;
}

// Real pixel resolution the photo is edited/saved at vs. the on-screen CSS size the canvas is
// displayed at - kept separate so pointer-drag deltas (measured in CSS px) can be scaled back up to
// canvas space.
const CANVAS_SIZE = 480;
const DISPLAY_SIZE = 260;
const MAX_PHOTO_BYTES = 500 * 1024;
// Tried in order until the encoded JPEG fits under MAX_PHOTO_BYTES - at a fixed 480x480 output this
// essentially always succeeds well before the last step.
const JPEG_QUALITY_STEPS = [0.85, 0.7, 0.55, 0.4, 0.25];

const canvasToJpegBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));

// View/edit(rotate+resize)/save dialog for one student's photo - a single shared instance rendered
// once by StudentManager (native <dialog>, same modal/modal-box/modal-action/modal-backdrop pattern
// as TopBanner's year/section dialogs), opened/closed by whether `student` is set.
const StudentPhotoDialog = ({ student, onClose, onSaved }: StudentPhotoDialogProps) => {
  const { connection, accessToken } = useAuth();
  const showToast = useToast();
  const [language] = useLanguage();
  const t = studentManagerTranslations[language];

  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);

  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  useEffect(() => {
    if (!student) {
      dialogRef.current?.close();
      return;
    }
    dialogRef.current?.showModal();
    setSourceImage(null);
    setRotation(0);
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
    setIsDirty(false);
    setIsLoadingPhoto(true);
    let cancelled = false;
    StudentReader.loadStudentPhotoImage(accessToken, connection, student.stud_id).then((img) => {
      if (!cancelled) {
        setSourceImage(img);
        setIsLoadingPhoto(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      return;
    }
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.fillStyle = "#e5e7eb";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    if (!sourceImage) {
      return;
    }
    ctx.save();
    ctx.translate(CANVAS_SIZE / 2 + offsetX, CANVAS_SIZE / 2 + offsetY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);
    ctx.drawImage(sourceImage, -sourceImage.width / 2, -sourceImage.height / 2);
    ctx.restore();
  }, [sourceImage, rotation, zoom, offsetX, offsetY]);

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) {
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      setSourceImage(img);
      setRotation(0);
      setZoom(1);
      setOffsetX(0);
      setOffsetY(0);
      setIsDirty(true);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const rotateLeft = () => {
    setRotation((r) => (r - 90 + 360) % 360);
    setIsDirty(true);
  };
  const rotateRight = () => {
    setRotation((r) => (r + 90) % 360);
    setIsDirty(true);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!sourceImage) {
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: offsetX,
      startOffsetY: offsetY,
    };
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragStateRef.current;
    if (!drag) {
      return;
    }
    const scaleFactor = CANVAS_SIZE / DISPLAY_SIZE;
    setOffsetX(drag.startOffsetX + (e.clientX - drag.startX) * scaleFactor);
    setOffsetY(drag.startOffsetY + (e.clientY - drag.startY) * scaleFactor);
    setIsDirty(true);
  };
  const handlePointerUp = () => {
    dragStateRef.current = null;
  };

  const handleSave = async () => {
    if (!student || !sourceImage || !canvasRef.current) {
      return;
    }
    let blob: Blob | null = null;
    for (const quality of JPEG_QUALITY_STEPS) {
      blob = await canvasToJpegBlob(canvasRef.current, quality);
      if (blob && blob.size <= MAX_PHOTO_BYTES) {
        break;
      }
    }
    if (!blob || blob.size > MAX_PHOTO_BYTES) {
      showToast(t.photoTooLarge, { type: "warning" });
      return;
    }
    setIsSaving(true);
    const result = await StudentReader.uploadStudentPhoto(
      accessToken,
      connection,
      student.stud_id,
      blob,
    );
    setIsSaving(false);
    showToast(result.status ? t.photoUploadSuccess : t.photoUploadFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      onSaved(student.stud_id);
      dialogRef.current?.close();
    }
  };

  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose}>
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">
          {student ? t.photoDialogTitle(`${student.name} ${student.surname ?? ""}`.trim()) : ""}
        </h3>

        <div
          className="relative mx-auto"
          style={{ width: DISPLAY_SIZE, height: DISPLAY_SIZE }}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            style={{ width: DISPLAY_SIZE, height: DISPLAY_SIZE }}
            className="rounded border border-base-300 touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
          {isLoadingPhoto && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loading />
            </div>
          )}
          {!isLoadingPhoto && !sourceImage && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <UserRound className="w-16 h-16 opacity-40" />
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFilePick}
        />
        <div className="flex justify-center mt-3">
          <button
            type="button"
            className="btn btn-neutral btn-sm gap-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4" />
            {t.choosePhotoBtn}
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 mt-4">
          <div className="tooltip" data-tip={t.rotateLeftHint}>
            <button
              type="button"
              className="btn btn-sm btn-circle btn-ghost"
              disabled={!sourceImage}
              onClick={rotateLeft}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
          <div className="tooltip flex-1 max-w-52" data-tip={t.zoomHint}>
            <input
              type="range"
              min={0.5}
              max={3}
              step={0.05}
              value={zoom}
              disabled={!sourceImage}
              className="range range-sm w-full"
              onChange={(e) => {
                setZoom(Number(e.target.value));
                setIsDirty(true);
              }}
            />
          </div>
          <div className="tooltip" data-tip={t.rotateRightHint}>
            <button
              type="button"
              className="btn btn-sm btn-circle btn-ghost"
              disabled={!sourceImage}
              onClick={rotateRight}
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="modal-action">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => dialogRef.current?.close()}
          >
            {t.cancelBtn}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!isDirty || !sourceImage || isSaving}
            onClick={handleSave}
          >
            {t.saveBtn}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>{t.cancelBtn}</button>
      </form>
    </dialog>
  );
};

export default StudentPhotoDialog;
