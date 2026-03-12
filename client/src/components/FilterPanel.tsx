import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FILTER_TOPICS } from "../../../shared/gutenberg";

interface FilterPanelProps {
  sortBy: "popular" | "ascending" | "descending";
  onSortChange: (v: "popular" | "ascending" | "descending") => void;
  selectedSubject: string;
  onSubjectChange: (s: string) => void;
  totalCount: number;
  isLoading: boolean;
}

const SUBJECTS = [
  { value: "", label: "Alle Themen" },
  ...FILTER_TOPICS,
];

export function FilterPanel({
  sortBy,
  onSortChange,
  selectedSubject,
  onSubjectChange,
  totalCount,
  isLoading,
}: FilterPanelProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-3 border-b border-border">
      {/* Count */}
      <span className="text-sm text-muted-foreground shrink-0">
        {isLoading ? (
          <span className="skeleton inline-block w-20 h-4 rounded" />
        ) : (
          <>{totalCount.toLocaleString("de-DE")} Bücher</>
        )}
      </span>

      <div className="flex items-center gap-2 flex-wrap flex-1">
        {/* Sort */}
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground shrink-0" />
          <Select value={sortBy} onValueChange={(v) => onSortChange(v as typeof sortBy)}>
            <SelectTrigger className="h-8 text-sm w-[140px] bg-muted/50 border-transparent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popular">Beliebtheit</SelectItem>
              <SelectItem value="ascending">Titel A–Z</SelectItem>
              <SelectItem value="descending">Titel Z–A</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Subject chips — scrollable on mobile */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 flex-1 min-w-0">
          {SUBJECTS.map((s) => (
            <button
              key={s.value}
              onClick={() => onSubjectChange(s.value === selectedSubject ? "" : s.value)}
              className={`shrink-0 text-xs px-2.5 py-1 rounded-full border transition-colors whitespace-nowrap ${
                s.value === selectedSubject
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Clear filter */}
        {selectedSubject && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs shrink-0"
            onClick={() => onSubjectChange("")}
          >
            <X className="w-3 h-3 mr-1" />
            Filter löschen
          </Button>
        )}
      </div>
    </div>
  );
}
