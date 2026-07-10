import { StrictMode, useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const imageUrl = fileName => `${import.meta.env.BASE_URL}images/${fileName}`

const projects = [
  { slug: 'house-of-light', number: '01', name: 'House of Light', type: 'Residential · Yerevan', image: imageUrl('project-house-of-light.jpg') },
  { slug: 'monumental-quiet', number: '02', name: 'Monumental Quiet', type: 'Cultural · Tbilisi', image: imageUrl('project-monumental-quiet.jpg') },
  { slug: 'the-archive', number: '03', name: 'The Archive', type: 'Hospitality · Berlin', image: imageUrl('project-the-archive.jpg') },
  { slug: 'horizon-house', number: '04', name: 'Horizon House', type: 'Residential · Puglia', image: imageUrl('project-horizon-house.jpg') },
]

function Arrow() { return <span aria-hidden="true">↗</span> }

function Logo() {
  return <a className="logo" href="#top" aria-label="ASPECT home"><img src={imageUrl('aspect-logo.svg')} alt="ASPECT — Architecture and Design" width="112" height="103" /></a>
}

function Header({ menuOpen, setMenuOpen }) {
  return <header>
    <Logo />
    <button className="menu" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="site-nav"><span>{menuOpen ? 'Close' : 'Menu'}</span><b /></button>
    <nav id="site-nav" className={menuOpen ? 'open' : ''} aria-label="Primary">
      <a href="#top">Home</a><a href="#studio">About</a><a href="#services">Services</a><a href="#work">Portfolio</a>
    </nav>
    <a className="header-cta" href="#contact">Start a project</a>
  </header>
}

function ProjectImage({ project, className = '', priority = false, render = true }) {
  return render ? <img className={`project-image ${className}`} src={project.image} alt={`${project.name} project`} loading={priority ? 'eager' : 'lazy'} /> : <div className={`project-image project-placeholder ${className}`} aria-hidden="true" />
}

function ProjectShowcase() {
  const [activeIndex, setActiveIndex] = useState(0)
  const scrollerRef = useRef(null)
  const galleryRef = useRef(null)
  const scrollTarget = useRef(0)
  const scrollFrame = useRef(null)
  const galleryCaptured = useRef(false)
  const goToProject = useCallback(index => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const boundedIndex = Math.max(0, Math.min(projects.length - 1, index))
    scrollTarget.current = scroller.clientWidth * boundedIndex
    scroller.scrollTo({ left: scroller.clientWidth * boundedIndex, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return undefined
    const updateIndex = () => {
      if (!scrollFrame.current) scrollTarget.current = scroller.scrollLeft
      setActiveIndex(Math.round(scroller.scrollLeft / scroller.clientWidth))
    }
    scroller.addEventListener('scroll', updateIndex, { passive: true })
    return () => scroller.removeEventListener('scroll', updateIndex)
  }, [])

  useEffect(() => {
    const handleWheel = event => {
      const gallery = galleryRef.current
      const scroller = scrollerRef.current
      if (!gallery || !scroller) return
      const movement = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
      if (Math.abs(movement) < 2) return
      const rect = gallery.getBoundingClientRect()
      const galleryIsNear = rect.top < window.innerHeight * 0.25 && rect.bottom > window.innerHeight * 0.75
      const maximumScroll = scroller.scrollWidth - scroller.clientWidth
      const atStart = scrollTarget.current <= 1 && scroller.scrollLeft <= 1
      const atEnd = scrollTarget.current >= maximumScroll - 1 && scroller.scrollLeft >= maximumScroll - 1

      if (!galleryCaptured.current) {
        if (!galleryIsNear || (movement < 0 && atStart) || (movement > 0 && atEnd)) return
        galleryCaptured.current = true
        event.preventDefault()
        if (Math.abs(rect.top) > 2) {
          window.scrollTo({ top: window.scrollY + rect.top, behavior: 'auto' })
          return
        }
      }

      if ((movement < 0 && atStart) || (movement > 0 && atEnd)) {
        galleryCaptured.current = false
        return
      }

      event.preventDefault()
      scrollTarget.current = Math.max(0, Math.min(maximumScroll, scrollTarget.current + movement * 1.15))
      if (scrollFrame.current) return
      const easeScroll = () => {
        const distance = scrollTarget.current - scroller.scrollLeft
        if (Math.abs(distance) < 0.5) {
          scroller.scrollLeft = scrollTarget.current
          scrollFrame.current = null
          return
        }
        scroller.scrollLeft += distance * 0.16
        scrollFrame.current = window.requestAnimationFrame(easeScroll)
      }
      scrollFrame.current = window.requestAnimationFrame(easeScroll)
    }
    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.cancelAnimationFrame(scrollFrame.current)
      galleryCaptured.current = false
    }
  }, [])

  const onKeyDown = event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); goToProject(activeIndex + 1) }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); goToProject(activeIndex - 1) }
  }

  return <section id="work" className="showcase" aria-label="Selected projects" ref={galleryRef}>
    <div className="showcase-stage" onKeyDown={onKeyDown} tabIndex="0">
      <div className="showcase-top"><p>Selected work</p><p>{String(activeIndex + 1).padStart(2, '0')} / {String(projects.length).padStart(2, '0')}</p></div>
      <div className="showcase-track" ref={scrollerRef}>
        {projects.map((project, index) => <article className="showcase-slide" aria-hidden={index !== activeIndex} key={project.slug}>
          <ProjectImage project={project} priority={index === 0} />
          <div className="slide-shade" />
          <div className="showcase-content"><p className="eyebrow">{project.type}</p><h2>{project.name}</h2><a href={`#project/${project.slug}`} tabIndex={index === activeIndex ? 0 : -1}>Explore project <Arrow /></a></div>
        </article>)}
      </div>
      <div className="showcase-controls"><button onClick={() => goToProject(activeIndex - 1)} disabled={activeIndex === 0} aria-label="Previous project">←</button><button onClick={() => goToProject(activeIndex + 1)} disabled={activeIndex === projects.length - 1} aria-label="Next project">→</button></div>
    </div>
  </section>
}

function ProjectDetail({ project, onBack }) {
  return <main className="detail">
    <button className="back" onClick={onBack}>← All projects</button>
    <div className="detail-intro"><p className="eyebrow">{project.type}</p><h1>{project.name}</h1><p>Architecture shaped by atmosphere, material honesty, and the rituals of everyday life.</p></div>
    <ProjectImage project={project} className="detail-image" priority />
    <section className="detail-grid"><p className="eyebrow">The brief</p><p>Designed as a sequence of moments rather than a singular object, this project balances a clear architectural idea with the slow texture of its surroundings. Every threshold is considered; every view is framed.</p><dl><div><dt>Completion</dt><dd>2025</dd></div><div><dt>Scope</dt><dd>Architecture · Interiors</dd></div><div><dt>Status</dt><dd>Built</dd></div></dl></section>
  </main>
}

function Home() {
  return <main id="top">
    <section className="hero" aria-labelledby="hero-title">
      <img className="hero-image" src={imageUrl('project-house-of-light-hero.jpg')} alt="" fetchPriority="high" />
      <div className="hero-shade" />
      <div className="hero-copy"><div className="hero-overline"><i /> <span>Architecture and design</span> <i /></div><h1 id="hero-title">Spaces with<br /><em>lasting presence.</em></h1><p>We create considered environments that are rooted in place and made to endure.</p></div>
      <a className="scroll-cue" href="#work">Scroll to explore <span aria-hidden="true" /></a>
    </section>
    <ProjectShowcase />
    <section id="studio" className="studio section"><p className="eyebrow">The studio</p><div><h2>We design places that <em>belong.</em></h2><p>ASPECT is an architecture and design studio working across homes, hospitality, and cultural spaces. We believe the most resonant work begins with careful observation — of a site, a material, a way of living.</p><a className="text-link" href="#contact">Meet the studio <Arrow /></a></div></section>
    <section id="services" className="services section"><p className="eyebrow">What we do</p><div className="service-list">{['Architecture', 'Interior design', 'Creative direction'].map((name, index) => <div className="service" key={name}><span>{String(index + 1).padStart(2, '0')}</span><h3>{name}</h3><Arrow /></div>)}</div></section>
    <section id="contact" className="contact"><p className="eyebrow">Start a conversation</p><h2>Let’s shape something lasting.</h2><a href="mailto:studio@aspect.am">studio@aspect.am <Arrow /></a><div><p>Yerevan, Armenia</p><p>© 2026 ASPECT</p><a href="#top">Back to top ↑</a></div></section>
  </main>
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [route, setRoute] = useState(() => window.location.hash.slice(1))
  const slug = route.startsWith('project/') ? route.split('/')[1] : null
  const project = projects.find(item => item.slug === slug)

  useEffect(() => {
    const updateRoute = () => setRoute(window.location.hash.slice(1))
    window.addEventListener('hashchange', updateRoute)
    return () => window.removeEventListener('hashchange', updateRoute)
  }, [])
  useEffect(() => {
    document.title = project ? `${project.name} — ASPECT` : 'ASPECT — Architecture and Design'
    if (project) window.scrollTo(0, 0)
  }, [project])

  return <><Header menuOpen={menuOpen} setMenuOpen={setMenuOpen} />{project ? <ProjectDetail project={project} onBack={() => { window.location.hash = 'work' }} /> : <Home />}</>
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
