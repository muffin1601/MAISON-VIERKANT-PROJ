"use client";

interface Props {
  categories: string[];
  active: string;
  count: number;
  onChange: (category: string) => void;
}

/**
 * Category filter row. Categories are derived from the data upstream — when the
 * images live in a single flat folder this renders just "All", so we never
 * invent fake categories.
 */
export function GalleryFilters({ categories, active, count, onChange }: Props) {
  return (
    <div className="gal-filterbar">
      <div className="filter-row" role="group" aria-label="Filter projects by category">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`fb${cat === active ? " active" : ""}`}
            aria-pressed={cat === active}
            onClick={() => onChange(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
      <p className="gal-count" aria-live="polite">
        {count} {count === 1 ? "project" : "projects"}
      </p>
    </div>
  );
}
