export default function AboutPage() {
  return (
    <div id="page-about" className="page active">
      <div className="about-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://wsrv.nl/?url=http%3A%2F%2Fvierkant.pixeo.be%2Fengine%2Fhandlers%2Fimage.asp%3Ft%3Dprojectslides%26i%3D725%26w%3D1680%26c%3Dfalse"
          alt=""
        />
        <div style={{ position: "relative", maxWidth: 740, margin: "0 auto" }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: ".28em",
              textTransform: "uppercase",
              color: "var(--gold2)",
              marginBottom: 16,
            }}
          >
            Ostend, Belgium · Est. 1987
          </div>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "clamp(36px,5vw,64px)",
              fontWeight: 300,
              color: "white",
              lineHeight: 1.1,
              marginBottom: 18,
            }}
          >
            The <em style={{ color: "var(--gold2)" }}>Atelier</em>
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "rgba(248,245,240,.6)",
              lineHeight: 1.9,
              maxWidth: 520,
              margin: "0 auto",
            }}
          >
            Willy and Annette Janssens shape 70 tonnes of Belgian clay every week in Ostend. Each
            vessel is unique — made by hand, slowly and meticulously.
          </p>
        </div>
      </div>
      <div className="about-section">
        <div className="ab-block">
          <h2 className="ab-h">Clay is our foundation</h2>
          <p className="ab-p">
            From Western European clay beds, every piece begins as raw earth. The team at Atelier
            Vierkant shapes, fires, and finishes each vessel in their Ostend studio — ensuring no two
            pieces are ever exactly alike. The clay body carries the fingerprint of its maker. The
            Atelier produces more than 70 tonnes of clay work every week, yet each piece retains its
            individual character.
          </p>
        </div>
        <div className="ab-block">
          <h2 className="ab-h">The 2025 Collection</h2>
          <p className="ab-p">
            Inspired by nature, the 2025 collection was presented at Salone del Mobile Milano and
            features LEDA, KORIL, KALIS, SEMINA, ARON and IRIS — sculptural vessels that explore
            dynamic shapes, textures, and natural elegance. Each piece in the collection can be
            positioned upright or tilted, inviting interaction and creating new spatial conversations
            in the landscape.
          </p>
        </div>
        <div className="ab-block">
          <h2 className="ab-h">38 Series · Over 200 Models</h2>
          <p className="ab-p">
            From the compact CL35 disc to the monumental AU180, Atelier Vierkant&apos;s catalogue
            spans 38 distinct series — including planters, bowls, columns, pebbles, seating, benches,
            and tables. Every form is available in 8 fully coloured clay bodies and 22 engobe surface
            finishes, all applied by hand. Custom sizes are available across most series.
          </p>
        </div>
        <div className="ab-block">
          <h2 className="ab-h">India Chapter</h2>
          <p className="ab-p">
            Maison Vierkant India was established as the authorised representative of Atelier Vierkant
            in India — bringing Flemish craft to the country&apos;s most distinguished gardens,
            terraces, and courtyards. Watcon&apos;s deep roots in the premium outdoor sector make this
            partnership a natural one. We serve HNI homeowners, landscape architects, and India&apos;s
            finest hospitality properties.
          </p>
        </div>
      </div>
    </div>
  );
}
