import { StrictMode, useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  PROJECT_STORAGE_KEY,
  defaultProjects,
  emptyProject,
  imageSource,
  loadProjects,
  normaliseProjectDocument,
  persistProjects,
  slugify,
} from './projects'
import './styles.css'

const imageUrl = fileName => `${import.meta.env.BASE_URL}images/${fileName}`

function Arrow() { return <span aria-hidden="true">↗</span> }

function MailIcon() {
  return <svg className="mail-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="18" height="14" rx="1" /><path d="m4 7 8 6 8-6" /></svg>
}

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

function useManagedProjects() {
  const [projects, setProjects] = useState(loadProjects)

  const replaceProjects = useCallback(nextProjects => {
    const normalised = normaliseProjectDocument(nextProjects).projects
    const persisted = persistProjects(normalised)
    setProjects(normalised)
    return persisted
  }, [])

  useEffect(() => {
    const syncProjects = event => {
      if (event.key !== PROJECT_STORAGE_KEY) return
      try {
        setProjects(event.newValue ? normaliseProjectDocument(JSON.parse(event.newValue)).projects : defaultProjects)
      } catch {
        setProjects(defaultProjects)
      }
    }
    window.addEventListener('storage', syncProjects)
    return () => window.removeEventListener('storage', syncProjects)
  }, [])

  return [projects, replaceProjects]
}

function ProjectImage({ project, image, className = '', priority = false, render = true }) {
  const source = image || project.images[0]
  return render ? <img className={`project-image ${className}`} src={imageSource(source)} alt={`${project.name} project`} loading={priority ? 'eager' : 'lazy'} /> : <div className={`project-image project-placeholder ${className}`} aria-hidden="true" />
}

function ProjectShowcase({ projects }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const scrollerRef = useRef(null)
  const galleryRef = useRef(null)
  const scrollTarget = useRef(0)
  const scrollFrame = useRef(null)
  const galleryCaptured = useRef(false)
  const safeActiveIndex = Math.min(activeIndex, Math.max(projects.length - 1, 0))

  const goToProject = useCallback(index => {
    const scroller = scrollerRef.current
    if (!scroller || !projects.length) return
    const boundedIndex = Math.max(0, Math.min(projects.length - 1, index))
    scrollTarget.current = scroller.clientWidth * boundedIndex
    scroller.scrollTo({ left: scroller.clientWidth * boundedIndex, behavior: 'smooth' })
  }, [projects.length])

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
      if (!gallery || !scroller || !projects.length) return
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
  }, [projects.length])

  const onKeyDown = event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); goToProject(safeActiveIndex + 1) }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); goToProject(safeActiveIndex - 1) }
  }

  if (!projects.length) {
    return <section id="work" className="showcase showcase-empty" aria-label="Selected projects"><p className="eyebrow">No projects have been added yet.</p></section>
  }

  return <section id="work" className="showcase" aria-label="Selected projects" ref={galleryRef}>
    <div className="showcase-stage" onKeyDown={onKeyDown} tabIndex="0">
      <div className="showcase-top"><p>Selected work</p><p>{String(safeActiveIndex + 1).padStart(2, '0')} / {String(projects.length).padStart(2, '0')}</p></div>
      <div className="showcase-track" ref={scrollerRef}>
        {projects.map((project, index) => <article className="showcase-slide" aria-hidden={index !== safeActiveIndex} key={project.slug}>
          <ProjectImage project={project} priority={index === 0} />
          <div className="slide-shade" />
          <div className="showcase-content"><p className="eyebrow">{project.type}</p><h2>{project.name}</h2><a href={`#project/${project.slug}`} tabIndex={index === safeActiveIndex ? 0 : -1}>Explore project <Arrow /></a></div>
        </article>)}
      </div>
      <div className="showcase-controls"><button onClick={() => goToProject(safeActiveIndex - 1)} disabled={safeActiveIndex === 0} aria-label="Previous project">←</button><button onClick={() => goToProject(safeActiveIndex + 1)} disabled={safeActiveIndex === projects.length - 1} aria-label="Next project">→</button></div>
    </div>
  </section>
}

function ProjectDetail({ project, onBack }) {
  return <main className="detail">
    <button className="back" onClick={onBack}>← All projects</button>
    <div className="detail-intro"><p className="eyebrow">{project.type}</p><h1>{project.name}</h1><p>Architecture shaped by atmosphere, material honesty, and the rituals of everyday life.</p></div>
    <ProjectImage project={project} className="detail-image" priority />
    {project.images.length > 1 && <div className="detail-gallery" aria-label={`${project.name} additional images`}>{project.images.slice(1).map((image, index) => <ProjectImage project={project} image={image} className="detail-gallery-image" key={`${image}-${index}`} />)}</div>}
    <section className="detail-grid"><p className="eyebrow">The brief</p><p>{project.description}</p><dl><div><dt>Completion</dt><dd>{project.completion}</dd></div><div><dt>Scope</dt><dd>{project.scope}</dd></div><div><dt>Status</dt><dd>{project.status}</dd></div></dl></section>
  </main>
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`))
    reader.readAsDataURL(file)
  })
}

function AdminPage({ projects, onProjectsChange }) {
  const [editingSlug, setEditingSlug] = useState(null)
  const [draft, setDraft] = useState(emptyProject)
  const [notice, setNotice] = useState('Select a project to edit it, or add a new one.')
  const [error, setError] = useState('')

  const isEditing = editingSlug !== null
  const selectProject = project => {
    setEditingSlug(project.slug)
    setDraft({ ...project, images: [...project.images] })
    setError('')
    setNotice(`Editing ${project.name}.`)
  }
  const startNewProject = () => {
    setEditingSlug(null)
    setDraft(emptyProject())
    setError('')
    setNotice('Add the project details, then save to publish it to the portfolio in this browser.')
  }
  const updateField = event => {
    const { name, value } = event.target
    setDraft(current => ({ ...current, [name]: value }))
  }
  const updateImage = (index, value) => setDraft(current => ({ ...current, images: current.images.map((image, imageIndex) => imageIndex === index ? value : image) }))
  const addImageReference = () => setDraft(current => ({ ...current, images: [...current.images, ''] }))
  const removeImage = index => setDraft(current => ({ ...current, images: current.images.filter((_, imageIndex) => imageIndex !== index) }))

  const addUploadedImages = async event => {
    const input = event.target
    const files = [...input.files]
    if (!files.length) return
    try {
      const images = await Promise.all(files.map(readImage))
      setDraft(current => ({ ...current, images: [...current.images.filter(Boolean), ...images] }))
      setError('')
      setNotice(`${images.length} image${images.length === 1 ? '' : 's'} added to this project.`)
    } catch (uploadError) {
      setError(uploadError.message)
    } finally {
      input.value = ''
    }
  }

  const saveProject = event => {
    event.preventDefault()
    const nextDraft = { ...draft, slug: slugify(draft.slug || draft.name), images: draft.images.filter(Boolean) }
    const nextProjects = isEditing ? projects.map(project => project.slug === editingSlug ? nextDraft : project) : [...projects, nextDraft]
    try {
      const normalised = normaliseProjectDocument(nextProjects).projects
      const savedProject = normalised.find(project => project.slug === nextDraft.slug)
      const persisted = onProjectsChange(normalised)
      setEditingSlug(savedProject.slug)
      setDraft(savedProject)
      setError('')
      setNotice(persisted ? `${savedProject.name} is saved and live in this browser.` : `${savedProject.name} is visible, but browser storage is full. Export it before reloading.`)
    } catch (validationError) {
      setError(validationError.message)
    }
  }

  const removeProject = () => {
    const project = projects.find(item => item.slug === editingSlug)
    if (!project || !window.confirm(`Remove “${project.name}” from the portfolio?`)) return
    const persisted = onProjectsChange(projects.filter(item => item.slug !== editingSlug))
    setEditingSlug(null)
    setDraft(emptyProject())
    setError('')
    setNotice(persisted ? `${project.name} was removed.` : `${project.name} was removed for this session, but browser storage is unavailable.`)
  }

  const exportProjects = () => {
    const blob = new Blob([JSON.stringify(normaliseProjectDocument(projects), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const download = document.createElement('a')
    download.href = url
    download.download = 'projects.json'
    document.body.append(download)
    download.click()
    download.remove()
    URL.revokeObjectURL(url)
    setNotice('projects.json downloaded. Import it later or replace src/projects.json before committing to publish it for everyone.')
  }

  const importProjects = async event => {
    const input = event.target
    const [file] = input.files
    if (!file) return
    try {
      const imported = normaliseProjectDocument(JSON.parse(await file.text())).projects
      const persisted = onProjectsChange(imported)
      setEditingSlug(null)
      setDraft(emptyProject())
      setError('')
      setNotice(persisted ? `Imported ${imported.length} project${imported.length === 1 ? '' : 's'} and saved them locally.` : `Imported ${imported.length} project${imported.length === 1 ? '' : 's'}, but browser storage is unavailable.`)
    } catch (importError) {
      setError(importError.message || 'Could not import that projects.json file.')
    } finally {
      input.value = ''
    }
  }

  return <main className="admin" id="top">
    <section className="admin-intro"><p className="eyebrow">Portfolio editor</p><h1>Project <em>admin.</em></h1><p>Create and update portfolio projects in this browser. The public showcase and project pages reflect every saved edit immediately.</p></section>
    <section className="admin-toolbar" aria-label="Project administration actions"><button className="admin-primary" onClick={startNewProject}>Add project <Arrow /></button><button className="admin-button" onClick={exportProjects}>Export projects.json</button><label className="admin-button upload-button">Import projects.json<input type="file" accept="application/json,.json" onChange={importProjects} /></label></section>
    <p className="admin-persistence">Edits are saved in this browser with localStorage. Export to make a portable <code>projects.json</code> backup; replace <code>src/projects.json</code> with that file and deploy to publish it for all visitors.</p>
    <div className="admin-layout">
      <aside className="admin-project-list" aria-label="Projects"><div><p className="eyebrow">Projects</p><span>{projects.length}</span></div>{projects.length ? projects.map(project => <button className={project.slug === editingSlug ? 'active' : ''} onClick={() => selectProject(project)} aria-pressed={project.slug === editingSlug} key={project.slug}><small>{project.number}</small><strong>{project.name}</strong><em>{project.type}</em></button>) : <p className="admin-empty">No projects yet. Add one to begin.</p>}</aside>
      <section className="admin-editor" aria-live="polite">
        <div className="admin-editor-heading"><div><p className="eyebrow">{isEditing ? 'Editing project' : 'New project'}</p><h2>{isEditing ? draft.name || 'Untitled project' : 'Add a project'}</h2></div>{isEditing && <button className="admin-delete" onClick={removeProject}>Remove project</button>}</div>
        <p className="admin-message" role={error ? 'alert' : 'status'}>{error || notice}</p>
        <form onSubmit={saveProject}>
          <div className="admin-fields"><label>Project header<input name="name" value={draft.name} onChange={updateField} placeholder="House of Light" required /></label><label>Slug<input name="slug" value={draft.slug} onChange={updateField} placeholder="house-of-light" pattern="[a-z0-9\-]+" aria-describedby="slug-help" required={Boolean(draft.slug)} /></label><p className="field-help" id="slug-help">Leave blank to create a slug from the header. Slugs must be unique.</p><label>Type / eyebrow<input name="type" value={draft.type} onChange={updateField} placeholder="Residential · Yerevan" required /></label><label className="admin-field-wide">Project brief<textarea name="description" value={draft.description} onChange={updateField} rows="5" placeholder="Describe the project, its material, and intent." required /></label><label>Completion<input name="completion" value={draft.completion} onChange={updateField} placeholder="2025" required /></label><label>Scope<input name="scope" value={draft.scope} onChange={updateField} placeholder="Architecture · Interiors" required /></label><label>Status<input name="status" value={draft.status} onChange={updateField} placeholder="Built" required /></label></div>
          <fieldset className="admin-images"><legend>Project images</legend><p>Use a filename from <code>public/images</code>, a full image URL, or upload an image to store it in the exported JSON.</p>{draft.images.map((image, index) => <div className="admin-image-row" key={`${index}-${image.slice(0, 24)}`}><label>Image {index + 1}<input value={image} onChange={event => updateImage(index, event.target.value)} placeholder="project-house-of-light.jpg" required={index === 0} /></label>{image && <img src={imageSource(image)} alt={`Preview ${index + 1}`} />}{draft.images.length > 1 && <button type="button" className="admin-image-remove" onClick={() => removeImage(index)} aria-label={`Remove image ${index + 1}`}>Remove</button>}</div>)}<div className="admin-image-actions"><button type="button" className="admin-button" onClick={addImageReference}>Add image reference</button><label className="admin-button upload-button">Upload image<input type="file" accept="image/*" multiple onChange={addUploadedImages} /></label></div></fieldset>
          <div className="admin-form-actions"><button className="admin-primary" type="submit">{isEditing ? 'Save changes' : 'Create project'} <Arrow /></button><button className="admin-button" type="button" onClick={startNewProject}>Clear form</button></div>
        </form>
      </section>
    </div>
  </main>
}

function Home({ projects }) {
  return <main id="top">
    <section className="hero" aria-labelledby="hero-title">
      <img className="hero-image" src={imageUrl('project-house-of-light-hero.jpg')} alt="" fetchPriority="high" />
      <div className="hero-shade" />
      <div className="hero-copy"><div className="hero-overline"><i /> <span>Architecture and design</span> <i /></div><h1 id="hero-title">Spaces with<br /><em>lasting presence.</em></h1><p>We create considered environments that are rooted in place and made to endure.</p></div>
      <a className="scroll-cue" href="#work">Scroll to explore <span aria-hidden="true" /></a>
    </section>
    <ProjectShowcase projects={projects} />
    <section id="studio" className="studio section"><p className="eyebrow">The studio</p><div><h2>We design places that <em>belong.</em></h2><p>ASPECT is an architecture and design studio working across homes, hospitality, and cultural spaces. We believe the most resonant work begins with careful observation — of a site, a material, a way of living.</p><a className="text-link" href="#contact">Meet the studio <Arrow /></a></div></section>
    <section id="services" className="services section"><p className="eyebrow">What we do</p><div className="service-list">{['Architecture', 'Interior design', 'Creative direction'].map((name, index) => <div className="service" key={name}><span>{String(index + 1).padStart(2, '0')}</span><h3>{name}</h3><Arrow /></div>)}</div></section>
    <section id="contact" className="contact"><p className="eyebrow">Start a conversation</p><h2>What will we shape together?</h2><a className="contact-email" href="mailto:studio@aspect.am"><MailIcon /><span>studio@aspect.am <Arrow /></span></a><div><p>Yerevan, Armenia</p><p>© 2026 ASPECT</p><a href="#top">Back to top ↑</a></div></section>
  </main>
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [projects, replaceProjects] = useManagedProjects()
  const [route, setRoute] = useState(() => window.location.hash.slice(1))
  const isAdmin = route === 'admin'
  const slug = route.startsWith('project/') ? route.split('/')[1] : null
  const project = projects.find(item => item.slug === slug)

  useEffect(() => {
    const updateRoute = () => setRoute(window.location.hash.slice(1))
    window.addEventListener('hashchange', updateRoute)
    return () => window.removeEventListener('hashchange', updateRoute)
  }, [])
  useEffect(() => {
    document.title = isAdmin ? 'Project admin — ASPECT' : project ? `${project.name} — ASPECT` : 'ASPECT — Architecture and Design'
    if (project || isAdmin) window.scrollTo(0, 0)
  }, [isAdmin, project])

  return <><Header menuOpen={menuOpen} setMenuOpen={setMenuOpen} />{isAdmin ? <AdminPage projects={projects} onProjectsChange={replaceProjects} /> : project ? <ProjectDetail project={project} onBack={() => { window.location.hash = 'work' }} /> : <Home projects={projects} />}</>
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
