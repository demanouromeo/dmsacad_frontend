import { useRef } from "react";
import { Search, X } from "lucide-react";
import { useLanguage } from "../../i18n/useLanguage";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  title?: string;
}

const CLEAR_LABEL = { fr: "Effacer la recherche", en: "Clear search" };

// Same icon+input daisyUI shape as AdminMenuGrid's own search box - shared here so every module's
// search/filter field looks and behaves identically instead of each screen reimplementing it.
// `title` is optional and only set by callers that want a hover tooltip beyond the placeholder text.
// An "x" button appears at the right end once there is text, clearing it and refocusing the field.
const SearchInput = ({ value, onChange, placeholder, className = "", title }: SearchInputProps) => {
  const [language] = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const clearLabel = CLEAR_LABEL[language];

  return (
    <label className={`input flex items-center gap-2 ${className}`}>
      <Search className="w-4 h-4 opacity-50 shrink-0" />
      <input
        ref={inputRef}
        type="text"
        className="grow"
        placeholder={placeholder}
        title={title}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value !== "" && (
        <button
          type="button"
          className="btn btn-ghost btn-xs btn-circle shrink-0"
          title={clearLabel}
          aria-label={clearLabel}
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </label>
  );
};

export default SearchInput;
