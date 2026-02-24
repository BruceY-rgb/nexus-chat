'use client';

import { useGlobalSearch } from '@/hooks/GlobalSearchContext';
import { Search } from 'lucide-react';

interface SearchBoxProps {
  className?: string;
}

export default function SearchBox({ className = '' }: SearchBoxProps) {
  const { open: openSearch } = useGlobalSearch();

  return (
    <div className={`relative ${className}`}>
      <div
        onClick={() => openSearch()}
        className="relative cursor-pointer group"
      >
        <Search
          size={15}
          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 group-hover:text-white/70 transition-colors"
        />
        <div
          className="w-full pl-9 pr-16 py-[5px] bg-white/10 hover:bg-white/15 border border-white/20 rounded-md text-[13px] text-white/50 transition-all cursor-pointer select-none"
        >
          Search
        </div>
        <kbd className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-[11px] text-white/40 bg-white/10 px-1.5 py-0.5 rounded border border-white/15 font-sans">
          ⌘K
        </kbd>
      </div>
    </div>
  );
}
