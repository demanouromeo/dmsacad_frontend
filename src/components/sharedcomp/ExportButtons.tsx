interface ExportButtonsProps {
  onExportExcel: () => void;
  onExportPdf: () => void;
  excelLabel: string;
  pdfLabel: string;
  disabled?: boolean;
}

const ExportButtons = ({
  onExportExcel,
  onExportPdf,
  excelLabel,
  pdfLabel,
  disabled,
}: ExportButtonsProps) => (
  <div className="flex gap-2">
    <button
      type="button"
      className="btn btn-outline btn-success btn-sm"
      onClick={onExportExcel}
      disabled={disabled}
    >
      {excelLabel}
    </button>
    <button
      type="button"
      className="btn btn-outline btn-error btn-sm"
      onClick={onExportPdf}
      disabled={disabled}
    >
      {pdfLabel}
    </button>
  </div>
);

export default ExportButtons;
