import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Per-screen "close" control for sub-module screens reached from a hub landing page - the Bilan
// sub-modules (EffectifsManager, PvManager, StatGroupeesManager, SyntheseGlobaleManager,
// SyntheseResultatsManager, StatMatiereManager, ClassementManager, StatParClasseManager, from
// EffectifsHub) and the Settings sub-modules (ClassifiedParamManager, AnnualRcAvgManager,
// ThParamManager, PromotionSettingsManager, from SettingsHub). Navigates back one entry in browser
// history (mirroring a modal's own X button) rather than a hardcoded route, so it lands wherever
// the user actually came from.
const CloseButton = () => {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="btn btn-ghost btn-circle"
      onClick={() => navigate(-1)}
      aria-label="Fermer"
      title="Fermer"
    >
      <X className="w-5 h-5" />
    </button>
  );
};

export default CloseButton;
