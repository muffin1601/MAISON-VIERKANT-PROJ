import type { Metadata } from "next";
import { getProjects } from "@/services/catalogue/catalogue";

export const metadata: Metadata = {
  title: "Projects",
  description:
    "Selected installations of Atelier Vierkant clay vessels across India — residences, hospitality and landscape projects, 2024–2026.",
  alternates: { canonical: "/projects" },
};

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await getProjects();
  return (
    <div id="page-projects" className="page active">
      <div className="sw">
        <div style={{ marginBottom: 40 }}>
          <div className="ey">India · 2024–2026</div>
          <h1 className="st">
            Featured <em>Projects</em>
          </h1>
        </div>
        <div className="proj-grid" id="projects-grid">
          {projects.map((p, i) => (
            <div className="proj-card" key={i}>
              <div className="proj-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imageUrl} alt={p.name} loading="lazy" />
              </div>
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: ".18em",
                  textTransform: "uppercase",
                  color: "var(--gold)",
                  marginBottom: 3,
                }}
              >
                {p.location}
              </div>
              <div
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: 23,
                  fontWeight: 400,
                  color: "var(--ink)",
                  marginBottom: 6,
                }}
              >
                {p.name}
              </div>
              <p style={{ fontSize: 13, color: "var(--ink3)", lineHeight: 1.7 }}>{p.summary}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
