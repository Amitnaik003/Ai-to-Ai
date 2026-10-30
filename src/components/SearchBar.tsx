import React from "react";
import { Search, X, Pin, ShieldAlert, MessagesSquare, MessageSquare } from "lucide-react";
import type { CapsuleFilter, PlatformType } from "../types";

interface SearchBarProps {
  filter: CapsuleFilter;
  onFilterChange: (updated: Partial<CapsuleFilter>) => void;
  searchInputRef?: React.RefObject<HTMLInputElement>;
}

const PLATFORM_OPTIONS: {
  id: "all" | PlatformType;
  label: string;
  dot: string;
  activeBg: string;
  activeText: string;
}[] = [
  { id: "all",        label: "All",        dot: "bg-slate-400",   activeBg: "bg-indigo-600",  activeText: "text-white" },
  { id: "chatgpt",    label: "ChatGPT",    dot: "bg-emerald-500", activeBg: "bg-emerald-600", activeText: "text-white" },
  { id: "claude",     label: "Claude",     dot: "bg-amber-500",   activeBg: "bg-amber-500",   activeText: "text-white" },
  { id: "gemini",     label: "Gemini",     dot: "bg-indigo-500",  activeBg: "bg-indigo-600",  activeText: "text-white" },
  { id: "perplexity", label: "Perplexity", dot: "bg-cyan-600",    activeBg: "bg-cyan-600",    activeText: "text-white" },
  { id: "deepseek",   label: "DeepSeek",   dot: "bg-blue-600",    activeBg: "bg-blue-600",    activeText: "text-white" },
  { id: "gmail",      label: "Gmail",      dot: "bg-rose-500",    activeBg: "bg-rose-600",    activeText: "text-white" },
  { id: "manual",     label: "Custom",     dot: "bg-slate-400",   activeBg: "bg-slate-600",   activeText: "text-white" },
];

export const SearchBar: React.FC<SearchBarProps> = ({
  filter,
  onFilterChange,
  searchInputRef
}) => {
  return (
    <div className="bg-white border-b border-slate-200/80 px-3 pt-2.5 pb-2 space-y-2">
      {/* Search Input with Keyboard Shortcut Indicator */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={searchInputRef}
          type="text"
          value={filter.search}
          onChange={(e) => onFilterChange({ search: e.target.value })}
          placeholder="DeepSearch across turns, code, prompts…"
          className="w-full pl-8 pr-12 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg
                     hover:bg-white focus:bg-white
                     focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400
                     placeholder:text-slate-400 text-slate-800 transition-all"
        />
        {filter.search ? (
          <button
            onClick={() => onFilterChange({ search: "" })}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <span
            title="Press '/' anytime to search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded pointer-events-none"
          >
            /
          </span>
        )}
      </div>

      {/* Row 2: Turn Type Pills (All / Dialogues / Prompts) + Security & Pinned */}
      <div className="flex items-center justify-between gap-1 text-[11px]">
        {/* Turn Type Filter */}
        <div className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200/60">
          <button
            type="button"
            onClick={() => onFilterChange({ turnType: "all" })}
            className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
              !filter.turnType || filter.turnType === "all"
                ? "bg-white text-indigo-700 font-bold shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => onFilterChange({ turnType: "dialogues" })}
            title="Show multi-turn conversations only"
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
              filter.turnType === "dialogues"
                ? "bg-white text-indigo-700 font-bold shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <MessagesSquare className="w-3 h-3" />
            <span>Threads</span>
          </button>
          <button
            type="button"
            onClick={() => onFilterChange({ turnType: "prompts" })}
            title="Show single-prompt directives only"
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
              filter.turnType === "prompts"
                ? "bg-white text-indigo-700 font-bold shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <MessageSquare className="w-3 h-3" />
            <span>Prompts</span>
          </button>
        </div>

        {/* Security & Pinned Filter */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Security Alert Filter */}
          <button
            type="button"
            onClick={() => onFilterChange({ securityAlertsOnly: !filter.securityAlertsOnly })}
            title={filter.securityAlertsOnly ? "Showing contexts with detected secrets" : "Filter contexts with exposed secrets / API keys"}
            className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg transition-all cursor-pointer font-medium border ${
              filter.securityAlertsOnly
                ? "bg-rose-50 text-rose-700 border-rose-300 font-bold"
                : "text-slate-500 hover:text-rose-700 hover:bg-rose-50 border-slate-200"
            }`}
          >
            <ShieldAlert className={`w-3 h-3 ${filter.securityAlertsOnly ? "text-rose-600" : "text-slate-400"}`} />
            <span className="hidden sm:inline">Security</span>
          </button>

          {/* Pinned toggle */}
          <button
            type="button"
            onClick={() => onFilterChange({ pinnedOnly: !filter.pinnedOnly })}
            title="Show pinned conversations only"
            className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg transition-all cursor-pointer font-medium border ${
              filter.pinnedOnly
                ? "bg-amber-50 text-amber-700 border-amber-200 font-bold"
                : "text-slate-500 hover:text-amber-700 hover:bg-amber-50 border-slate-200"
            }`}
          >
            <Pin className={`w-3 h-3 ${filter.pinnedOnly ? "fill-amber-500 text-amber-500" : "text-slate-400"}`} />
            <span className="hidden sm:inline">Pinned</span>
          </button>
        </div>
      </div>

      {/* Row 3: Platform Filter Pills */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5">
        {PLATFORM_OPTIONS.map((item) => {
          const isSelected = filter.platform === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onFilterChange({ platform: item.id })}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all border cursor-pointer shrink-0 ${
                isSelected
                  ? `${item.activeBg} ${item.activeText} border-transparent shadow-sm`
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-800"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? "bg-white/80" : item.dot}`} />
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
