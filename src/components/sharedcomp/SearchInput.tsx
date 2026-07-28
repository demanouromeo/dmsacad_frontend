import { Search } from "lucide-react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  title?: string;
}

// Same icon+input daisyUI shape as AdminMenuGrid's own search box - shared here so every module's
// search/filter field looks and behaves identically instead of each screen reimplementing it.
// `title` is optional and only set by callers that want a hover tooltip beyond the placeholder text.
const SearchInput = ({ value, onChange, placeholder, className = "", title }: SearchInputProps) => (
  <label className={`input flex items-center gap-2 ${className}`}>
    <Search className="w-4 h-4 opacity-50 shrink-0" />
    <input
      type="text"
      className="grow"
      placeholder={placeholder}
      title={title}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </label>
);

export default SearchInput;
