import { useEffect, useMemo, useRef, useState } from "react";
import { GROUPS, SITE_URL, archetypes, groupDescription, pageMeta, type Archetype, type Group, type PageKind } from "./data";


function Icon({
  name,
  size = 20,
}: {
  name: "search" | "menu" | "close" | "arrow" | "copy" | "check";
  size?: number;
}) {
  const paths = {
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    menu: (
      <>
        <path d="M3 7h18M3 12h18M3 17h18" />
      </>
    ),
    close: (
      <>
        <path d="m5 5 14 14M19 5 5 19" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14M14 7l5 5-5 5" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="11" height="11" rx="2" />
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function navigate(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([key, value]) => element?.setAttribute(key, value));
}

function Seo({ archetype, page }: { archetype?: Archetype; page: PageKind }) {
  useEffect(() => {
    const isAbout = page === "about";
    const { title, description, canonical } = pageMeta(archetype, page);

    document.title = title;
    document.documentElement.lang = "en";
    upsertMeta('meta[name="description"]', { name: "description", content: description });
    upsertMeta('meta[name="robots"]', {
      name: "robots",
      content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
    });
    upsertMeta('meta[name="googlebot"]', {
      name: "googlebot",
      content: "index, follow, max-image-preview:large, max-snippet:-1",
    });
    upsertMeta('meta[property="og:title"]', { property: "og:title", content: title });
    upsertMeta('meta[property="og:description"]', {
      property: "og:description",
      content: description,
    });
    upsertMeta('meta[property="og:type"]', {
      property: "og:type",
      content: archetype ? "article" : "website",
    });
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: canonical });
    upsertMeta('meta[property="og:site_name"]', {
      property: "og:site_name",
      content: "Branding Saga",
    });
    upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary" });
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
    upsertMeta('meta[name="twitter:description"]', {
      name: "twitter:description",
      content: description,
    });

    let canonicalLink = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.rel = "canonical";
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = canonical;

    let jsonLd = document.head.querySelector<HTMLScriptElement>("#branding-saga-structured-data");
    if (!jsonLd) {
      jsonLd = document.createElement("script");
      jsonLd.id = "branding-saga-structured-data";
      jsonLd.type = "application/ld+json";
      document.head.appendChild(jsonLd);
    }

    const baseGraph = [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: `${SITE_URL}/`,
        name: "Branding Saga",
        description: "The visual and verbal playbook for the 12 brand archetypes.",
        inLanguage: "en",
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "Branding Saga",
        url: `${SITE_URL}/`,
      },
    ];
    const pageNode = archetype
      ? {
          "@type": "Article",
          "@id": `${canonical}#article`,
          headline: `${archetype.name} Brand Archetype`,
          description,
          url: canonical,
          inLanguage: "en",
          keywords: [
            `${archetype.name} archetype`,
            "brand archetypes",
            ...archetype.adjectives,
            ...archetype.words,
          ].join(", "),
          articleSection: archetype.group,
          isPartOf: { "@id": `${SITE_URL}/#website` },
          publisher: { "@id": `${SITE_URL}/#organization` },
          about: {
            "@type": "DefinedTerm",
            name: `${archetype.name} brand archetype`,
            description: `${archetype.desire}. ${archetype.promise}.`,
          },
        }
      : {
          "@type": isAbout ? "AboutPage" : "CollectionPage",
          "@id": `${canonical}#webpage`,
          name: title,
          description,
          url: canonical,
          inLanguage: "en",
          isPartOf: { "@id": `${SITE_URL}/#website` },
          ...(isAbout
            ? {}
            : {
                mainEntity: {
                  "@type": "ItemList",
                  numberOfItems: archetypes.length,
                  itemListElement: archetypes.map((item, index) => ({
                    "@type": "ListItem",
                    position: index + 1,
                    name: item.name,
                    url: `${SITE_URL}/${item.slug}`,
                  })),
                },
              }),
        };
    const breadcrumbs = {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
        ...(archetype
          ? [
              {
                "@type": "ListItem",
                position: 2,
                name: archetype.group,
              },
              {
                "@type": "ListItem",
                position: 3,
                name: archetype.name,
                item: canonical,
              },
            ]
          : isAbout
            ? [{ "@type": "ListItem", position: 2, name: "About", item: canonical }]
            : []),
      ],
    };

    jsonLd.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [...baseGraph, pageNode, breadcrumbs],
    });
  }, [archetype, page]);

  return null;
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };
  return (
    <button className="copy-button" onClick={copy} aria-label={`Copy ${text}`}>
      <Icon name={copied ? "check" : "copy"} size={15} />
      <span>{copied ? "Copied" : label}</span>
    </button>
  );
}

function Header({ current }: { current?: Archetype }) {
  const [open, setOpen] = useState(false);
  const [mega, setMega] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const results = useMemo(
    () =>
      query.trim()
        ? archetypes.filter((a) =>
            [a.name, a.mantra, ...a.adjectives, ...a.words]
              .join(" ")
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
        : archetypes,
    [query],
  );

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setMega(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    setMega(false);
    setSearch(false);
    navigate(path);
  };
  return (
    <>
      <header className="site-header">
        <button className="wordmark" onClick={() => go("/")}>
          Branding <i>Saga</i>
        </button>
        <nav className="desktop-nav" ref={panelRef}>
          <button className={`nav-link ${mega ? "active" : ""}`} onClick={() => setMega(!mega)}>
            Archetypes <span className="nav-plus">{mega ? "−" : "+"}</span>
          </button>
          <button className="icon-button" onClick={() => setSearch(true)} aria-label="Search">
            <Icon name="search" />
          </button>
          <button className="nav-link" onClick={() => go("/about")}>
            About
          </button>
          {mega && <MegaMenu current={current} go={go} />}
        </nav>
        <button className="mobile-trigger" onClick={() => setOpen(true)} aria-label="Open menu">
          <Icon name="menu" />
        </button>
      </header>
      {open && (
        <div className="mobile-menu">
          <div className="mobile-top">
            <span className="wordmark">
              Branding <i>Saga</i>
            </span>
            <button className="icon-button" onClick={() => setOpen(false)}>
              <Icon name="close" />
            </button>
          </div>
          <p className="eyebrow">The 12 archetypes</p>
          <div className="mobile-groups">
            {GROUPS.map((group) => (
              <div key={group}>
                <p className="mobile-group-title">{group}</p>
                {archetypes
                  .filter((a) => a.group === group)
                  .map((a) => (
                    <button
                      key={a.slug}
                      className={current?.slug === a.slug ? "current" : ""}
                      onClick={() => go(`/${a.slug}`)}
                    >
                      <span style={{ background: a.colors[1][1] }} />
                      {a.name}
                    </button>
                  ))}
              </div>
            ))}
          </div>
          <div className="mobile-footer">
            <button
              onClick={() => {
                setOpen(false);
                setSearch(true);
              }}
            >
              <Icon name="search" /> Search the playbook
            </button>
            <button onClick={() => go("/about")}>About</button>
          </div>
        </div>
      )}
      {search && (
        <div className="search-overlay">
          <div className="search-shell">
            <div className="search-top">
              <span className="eyebrow">Search the playbook</span>
              <button className="icon-button" onClick={() => setSearch(false)}>
                <Icon name="close" />
              </button>
            </div>
            <div className="search-input">
              <Icon name="search" size={28} />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Try “bold”, “wonder” or “belonging”"
              />
            </div>
            <div className="search-results">
              {results.map((a) => (
                <button key={a.slug} onClick={() => go(`/${a.slug}`)}>
                  <span className="result-number">{a.number}</span>
                  <span>
                    <b>{a.name}</b>
                    <small>
                      {a.group} · {a.mantra}
                    </small>
                  </span>
                  <Icon name="arrow" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MegaMenu({ current, go }: { current?: Archetype; go: (path: string) => void }) {
  return (
    <div className="mega-menu">
      <div className="mega-intro">
        <span className="eyebrow">Explore the system</span>
        <h3>
          Twelve ways
          <br />
          to make meaning.
        </h3>
        <p>Find the character your brand naturally plays.</p>
      </div>
      <div className="mega-columns">
        {GROUPS.map((group) => (
          <div key={group}>
            <p className="mega-group">{group}</p>
            {archetypes
              .filter((a) => a.group === group)
              .map((a) => (
                <button
                  key={a.slug}
                  className={current?.slug === a.slug ? "current" : ""}
                  onClick={() => go(`/${a.slug}`)}
                >
                  <span className="color-dot" style={{ background: a.colors[1][1] }} />
                  {a.name}
                  <span>↗</span>
                </button>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Home() {
  const [filter, setFilter] = useState<Group | "All">("All");
  const visible = filter === "All" ? archetypes : archetypes.filter((a) => a.group === filter);
  return (
    <div className="shell-page">
      <Seo page="home" />
      <Header />
      <main>
        <section className="home-hero">
          <div className="hero-kicker">
            <span>Brand strategy</span>
            <span>Visual direction</span>
            <span>Verbal identity</span>
          </div>
          <h1>
            Find the character
            <br />
            behind your <em>brand.</em>
          </h1>
          <div className="hero-bottom">
            <p>The visual + verbal playbook for the 12 timeless brand archetypes.</p>
            <button
              className="round-arrow"
              onClick={() =>
                document.getElementById("archetypes")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              <Icon name="arrow" size={25} />
            </button>
          </div>
          <div className="orbit orbit-one">12</div>
          <div className="orbit orbit-two">Aa</div>
          <div className="orbit orbit-three">✦</div>
        </section>
        <section className="intro-strip">
          <p>
            <span>Archetypes turn brands into characters</span> people recognise, remember and
            choose. This field guide translates each one into a practical world of colour, type,
            imagery and language.
          </p>
        </section>
        <section className="archetype-index" id="archetypes">
          <div className="section-heading">
            <div>
              <p className="eyebrow">The complete cast</p>
              <h2>Choose your character.</h2>
            </div>
            <p>
              12 archetypes
              <br />4 human motivations
            </p>
          </div>
          <div className="filters">
            <button className={filter === "All" ? "active" : ""} onClick={() => setFilter("All")}>
              All <sup>12</sup>
            </button>
            {GROUPS.map((group) => (
              <button
                key={group}
                className={filter === group ? "active" : ""}
                onClick={() => setFilter(group)}
              >
                {group} <sup>03</sup>
              </button>
            ))}
          </div>
          <div className="card-grid">
            {visible.map((a) => (
              <ArchetypeCard key={a.slug} archetype={a} />
            ))}
          </div>
        </section>
        <section className="group-theory">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Four motivations</p>
              <h2>What drives the story?</h2>
            </div>
          </div>
          <div className="group-list">
            {GROUPS.map((group, i) => (
              <div key={group}>
                <span>0{i + 1}</span>
                <h3>{group}</h3>
                <p>{groupDescription[group]}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function ArchetypeCard({ archetype: a }: { archetype: Archetype }) {
  return (
    <button
      className={`archetype-card card-${a.slug}`}
      style={
        {
          "--card-bg": a.colors[0][1],
          "--card-ink":
            a.slug === "magician" || a.slug === "outlaw" || a.slug === "ruler" || a.slug === "hero"
              ? "#fff"
              : "#171714",
          "--accent": a.colors[1][1],
        } as React.CSSProperties
      }
      onClick={() => navigate(`/${a.slug}`)}
    >
      <div className="card-top">
        <span>{a.number}</span>
        <span>{a.group}</span>
      </div>
      <div className="card-art">
        <i></i>
        <b>{a.name.slice(0, 1)}</b>
        <span></span>
      </div>
      <div className="card-copy">
        <p>{a.desire}</p>
        <h3>{a.name}</h3>
        <q>{a.taglines[0]}</q>
      </div>
      <span className="card-arrow">
        <Icon name="arrow" />
      </span>
    </button>
  );
}

function Breadcrumb({ a }: { a: Archetype }) {
  return (
    <div className="breadcrumb">
      <button onClick={() => navigate("/")}>Home</button>
      <span>/</span>
      <span>{a.group}</span>
      <span>/</span>
      <b>{a.name}</b>
    </div>
  );
}

function ArchetypePage({ archetype: a }: { archetype: Archetype }) {
  const [tab, setTab] = useState<"visual" | "verbal">("visual");
  const index = archetypes.findIndex((x) => x.slug === a.slug);
  const previous = archetypes[(index - 1 + archetypes.length) % archetypes.length];
  const next = archetypes[(index + 1) % archetypes.length];
  const theme = {
    "--theme-bg": a.colors[0][1],
    "--theme-primary": a.colors[1][1],
    "--theme-secondary": a.colors[2][1],
    "--theme-accent": a.colors[3][1],
    "--theme-highlight": a.colors[4][1],
    "--theme-display": `"${a.display}", Georgia, serif`,
    "--theme-body": `"${a.body}", Arial, sans-serif`,
  } as React.CSSProperties;

  return (
    <div className={`archetype-page theme-${a.slug}`} style={theme}>
      <Seo page="archetype" archetype={a} />
      <Header current={a} />
      <Breadcrumb a={a} />
      <section className="archetype-hero">
        <div className="theme-art">
          <div className="art-shape art-a"></div>
          <div className="art-shape art-b"></div>
          <div className="art-lines"></div>
          <span>{a.number}</span>
        </div>
        <div className="archetype-title">
          <p className="theme-eyebrow">
            {a.group} archetype · {a.number}
          </p>
          <h1>{a.name}</h1>
          <p className="mantra">“{a.mantra}”</p>
        </div>
        <p className="hero-promise">{a.promise}</p>
      </section>
      <div className="tab-bar">
        <div>
          <button className={tab === "visual" ? "active" : ""} onClick={() => setTab("visual")}>
            Visual identity
          </button>
          <button className={tab === "verbal" ? "active" : ""} onClick={() => setTab("verbal")}>
            Verbal identity
          </button>
        </div>
        <span>
          {tab === "visual" ? "Colour · Type · Shape · Motion" : "Voice · Words · Ideas · Copy"}
        </span>
      </div>
      {tab === "visual" ? <VisualTab a={a} /> : <VerbalTab a={a} />}
      <section className="next-archetypes">
        <button onClick={() => navigate(`/${previous.slug}`)}>
          <small>Previous archetype</small>
          <span>← {previous.name}</span>
        </button>
        <button className="back-all" onClick={() => navigate("/")}>
          Back to all archetypes
        </button>
        <button onClick={() => navigate(`/${next.slug}`)}>
          <small>Next archetype</small>
          <span>{next.name} →</span>
        </button>
      </section>
      <Footer />
    </div>
  );
}

function SectionLabel({ number, children }: { number: string; children: React.ReactNode }) {
  return (
    <div className="theme-section-label">
      <span>{number}</span>
      <p>{children}</p>
    </div>
  );
}

function VisualTab({ a }: { a: Archetype }) {
  return (
    <main className="tab-content visual-content">
      <section className="key-visual-section">
        <SectionLabel number="01">Key visual</SectionLabel>
        <div className="key-visual">
          <div className="visual-stage">
            <div className="stage-orb"></div>
            <div className="stage-grid"></div>
            <p>{a.mantra}</p>
          </div>
          <div className="visual-note">
            <span>Creative direction</span>
            <h2>{a.keyVisual}</h2>
            <p>The signature device: {a.superGraphic.toLowerCase()}</p>
            <CopyButton text={`${a.keyVisual} ${a.superGraphic}`} label="Copy direction" />
          </div>
        </div>
      </section>
      <section className="palette-section">
        <SectionLabel number="02">Colour palette</SectionLabel>
        <div className="palette-grid">
          {a.colors.map(([name, hex, role]) => (
            <div className="swatch" key={hex}>
              <div style={{ background: hex }}></div>
              <p>
                <b>{name}</b>
                <span>{role}</span>
              </p>
              <span>{hex}</span>
              <CopyButton text={hex} label="" />
            </div>
          ))}
        </div>
      </section>
      <section className="type-section">
        <SectionLabel number="03">Typography</SectionLabel>
        <div className="type-specimen">
          <div className="display-spec">
            <span>Display · {a.display}</span>
            <p>Aa</p>
            <h2>{a.mantra}</h2>
          </div>
          <div className="body-spec">
            <span>Body · {a.body}</span>
            <h3>Build a world people can feel.</h3>
            <p>
              Great brands are not only seen. They are recognised by the ideas they repeat, the
              choices they make, and the way they make people feel.
            </p>
            <div>
              <span>Aa Bb Cc Dd Ee Ff</span>
              <span>0123456789</span>
            </div>
          </div>
        </div>
      </section>
      <section className="motif-section">
        <SectionLabel number="04">Shapes & motifs</SectionLabel>
        <div className="motif-grid">
          {a.shapes.map((shape, i) => (
            <div key={shape}>
              <div className={`motif motif-${i + 1}`}>
                <span></span>
              </div>
              <p>{shape}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="texture-motion-grid">
        <div>
          <SectionLabel number="05">Textures</SectionLabel>
          <div className="texture-grid">
            {a.textures.map((texture, i) => (
              <div className={`texture texture-${i + 1}`} key={texture}>
                <span>{texture}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <SectionLabel number="06">Motion signature</SectionLabel>
          <div className="motion-card">
            <div className="motion-demo">
              <i></i>
              <i></i>
              <i></i>
            </div>
            <h3>{a.motion}</h3>
            <p>Movement should reinforce the archetype's emotional pace—not decorate it.</p>
          </div>
        </div>
      </section>
      <Dos title="Visual principles" yes={a.visualDo} no={a.visualDont} />
    </main>
  );
}

function VerbalTab({ a }: { a: Archetype }) {
  return (
    <main className="tab-content verbal-content">
      <section className="personality-section">
        <SectionLabel number="01">Personality</SectionLabel>
        <div className="personality-grid">
          <div>
            <span>Core desire</span>
            <h2>{a.desire}</h2>
          </div>
          <div>
            <span>Deepest fear</span>
            <h2>{a.fear}</h2>
          </div>
          <div>
            <span>The promise</span>
            <h2>“{a.promise}”</h2>
          </div>
        </div>
        <div className="adjective-row">
          {a.adjectives.map((word) => (
            <CopyPill text={word} key={word} />
          ))}
        </div>
      </section>
      <section className="voice-section">
        <SectionLabel number="02">Brand language</SectionLabel>
        <div className="voice-lead">
          <p>Voice</p>
          <h2>{a.voice}</h2>
          <CopyButton text={a.voice} label="Copy voice note" />
        </div>
        <div className="say-table">
          <div>
            <p>
              <span>+</span> We say
            </p>
            {a.say.map((x) => (
              <div key={x}>
                <b>“{x}”</b>
                <CopyButton text={x} label="" />
              </div>
            ))}
          </div>
          <div>
            <p>
              <span>−</span> We never say
            </p>
            {a.never.map((x) => (
              <div key={x}>
                <b>“{x}”</b>
                <CopyButton text={x} label="" />
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="word-section">
        <SectionLabel number="03">Word bank</SectionLabel>
        <div className="word-cloud">
          {a.words.map((word) => (
            <CopyPill text={word} key={word} large />
          ))}
        </div>
      </section>
      <section className="examples-section">
        <div>
          <SectionLabel number="04">Sample taglines</SectionLabel>
          {a.taglines.map((line, i) => (
            <CopyLine key={line} number={`0${i + 1}`} text={line} />
          ))}
        </div>
        <div>
          <SectionLabel number="05">Hooks that open doors</SectionLabel>
          {a.hooks.map((line, i) => (
            <CopyLine key={line} number={`0${i + 1}`} text={line} />
          ))}
        </div>
      </section>
      <section className="ideas-section">
        <SectionLabel number="06">Content pillars & post ideas</SectionLabel>
        <div className="idea-list">
          {a.posts.map((post, i) => (
            <div key={post}>
              <span>{["REEL", "CAROUSEL", "THREAD", "STATIC", "STORY"][i % 5]}</span>
              <h3>{post}</h3>
              <CopyButton text={post} label="" />
            </div>
          ))}
        </div>
      </section>
      <section className="humour-example-grid">
        <div className="humour-card">
          <SectionLabel number="07">Humour style</SectionLabel>
          <h2>{a.humour}</h2>
          <blockquote>“{a.joke}”</blockquote>
          <CopyButton text={a.joke} label="Copy joke" />
        </div>
        <div className="example-card">
          <SectionLabel number="08">In the real world</SectionLabel>
          <span>Brand to study</span>
          <h2>{a.example}</h2>
          <p>{a.exampleNote}</p>
        </div>
      </section>
      <Dos title="Copy principles" yes={a.copyDo} no={a.copyDont} />
    </main>
  );
}

function CopyPill({ text, large }: { text: string; large?: boolean }) {
  const [done, setDone] = useState(false);
  const click = async () => {
    await navigator.clipboard.writeText(text);
    setDone(true);
    setTimeout(() => setDone(false), 900);
  };
  return (
    <button className={`copy-pill ${large ? "large" : ""}`} onClick={click}>
      {done ? "Copied" : text}
      <span>+</span>
    </button>
  );
}

function CopyLine({ number, text }: { number: string; text: string }) {
  return (
    <div className="copy-line">
      <span>{number}</span>
      <h3>{text}</h3>
      <CopyButton text={text} label="" />
    </div>
  );
}

function Dos({ title, yes, no }: { title: string; yes: string; no: string }) {
  return (
    <section className="dos-section">
      <SectionLabel number="09">{title}</SectionLabel>
      <div>
        <article>
          <span>Do</span>
          <h2>{yes}</h2>
        </article>
        <article>
          <span>Don't</span>
          <h2>{no}</h2>
        </article>
      </div>
    </section>
  );
}

function About() {
  return (
    <div className="shell-page">
      <Seo page="about" />
      <Header />
      <main className="about-page">
        <section className="about-hero">
          <p className="eyebrow">About the playbook</p>
          <h1>
            Strategy is easier
            <br />
            when it has a <em>character.</em>
          </h1>
          <p>
            Branding Saga is a field guide for building brands that feel coherent, memorable and
            deeply human.
          </p>
        </section>
        <section className="about-definition">
          <span>01 / The idea</span>
          <div>
            <h2>Archetypes are familiar patterns of human motivation.</h2>
            <p>
              We recognise the Hero's courage, the Caregiver's warmth and the Outlaw's defiance
              before anyone explains them. In branding, these patterns give teams a shared creative
              compass—not a costume.
            </p>
          </div>
        </section>
        <section className="about-steps">
          <p className="eyebrow">How to use this site</p>
          <div>
            {[
              [
                "01",
                "Find the motivation",
                "Start with what your audience wants to feel—not which page looks coolest.",
              ],
              [
                "02",
                "Study both halves",
                "Visual identity sets the scene. Verbal identity gives the character a voice.",
              ],
              [
                "03",
                "Make it your own",
                "Borrow principles, never a personality wholesale. Your story should still be unmistakably yours.",
              ],
            ].map(([n, title, copy]) => (
              <article key={n}>
                <span>{n}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="about-cta">
          <p>Ready to meet the cast?</p>
          <h2>
            12 ways to make a<br />
            brand mean more.
          </h2>
          <button onClick={() => navigate("/")}>
            Explore all archetypes <Icon name="arrow" />
          </button>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer>
      <div>
        <span className="wordmark">
          Branding <i>Saga</i>
        </span>
        <p>
          A visual + verbal playbook
          <br />
          for brands with character.
        </p>
      </div>
      <div>
        <p className="eyebrow">Explore</p>
        <button onClick={() => navigate("/")}>All archetypes</button>
        <button onClick={() => navigate("/about")}>About the playbook</button>
      </div>
      <div>
        <p className="eyebrow">Made for</p>
        <span>Designers</span>
        <span>Copywriters</span>
        <span>Brand builders</span>
      </div>
      <small>© 2025 Branding Saga</small>
    </footer>
  );
}

export default function App() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  const slug = path.replace(/^\/|\/$/g, "");
  const archetype = archetypes.find((a) => a.slug === slug);
  if (archetype) return <ArchetypePage archetype={archetype} />;
  if (slug === "about") return <About />;
  return <Home />;
}
