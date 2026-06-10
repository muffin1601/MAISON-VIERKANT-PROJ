"use client";

import { useUI } from "@/store/ui";

/** Opens the catalogue request modal — replaces prototype `onclick="openModal()"`. */
export function CatalogueButton({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const openCat = useUI((s) => s.openCat);
  return (
    <button type="button" className={className} style={style} onClick={openCat}>
      {children}
    </button>
  );
}
