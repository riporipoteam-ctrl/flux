"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
export function RailSearch() {
  const [query, setQuery] = useState("");
  const router = useRouter();
  return (
    <form
      role="search"
      className="flux-rail-search"
      onSubmit={(event) => {
        event.preventDefault();
        if (query.trim())
          router.push(`/explore?q=${encodeURIComponent(query.trim())}`);
      }}
    >
      <Search size={20} />
      <input
        type="search"
        aria-label="Search Flux"
        placeholder="Search Flux"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
    </form>
  );
}
