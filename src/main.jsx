import { StrictMode, useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider } from './firebase'
import {
  defaultProjects,
  emptyProject,
  imageSource,
  normaliseProjectDocument,
  slugify,
} from './projects'
import {
  deleteProjectFromFirestore,
  deleteProjectImages,
  firebaseErrorMessage,
  replaceProjectsInFirestore,
  subscribeToProjects,
  uploadProjectImages,
} from './project-store'
import './styles.css'

const repositoryPath = '/aspect-architecture-portfolio/'
const imageUrl = fileName => `${import.meta.env.BASE_URL}images/${fileName}`

function homePath() {
  return window.location.pathname.startsWith(repositoryPath) ? repositoryPath : '/'
}

function homeLink(hash = '') {
  return `${homePath()}${hash}`
}

function currentPageRoute() {
  const recoveredRoute = new URLSearchParams(window.location.search).get('route')
  const path = (recoveredRoute || window.location.pathname).replace(/\/+$/, '') || '/'
  return path === '/admin' || path.endsWith('/admin') || window.location.hash === '#admin' ? 'admin' : 'home'
}

function Arrow() { return <span aria-hidden="true">↗</span> }

function MailIcon() {
  return <svg className="mail-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="18" height="14" rx="1" /><path d="m4 7 8 6 8-6" /></svg>
}

function GoogleIcon() {
  return <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285f4" d="M21.8 12.23c0-.73-.07-1.43-.2-2.1H12v3.98h5.5a4.71 4.71 0 0 1-2.04 3.1v2.58h3.32c1.94-1.78 3.02-4.4 3.02-7.56Z" /><path fill="#34a853" d="M12 22c2.75 0 5.06-.91 6.75-2.47l-3.32-2.58c-.92.62-2.1.99-3.43.99-2.64 0-4.88-1.78-5.68-4.18H2.9v2.66A10.19 10.19 0 0 0 12 22Z" /><path fill="#fbbc05" d="M6.32 13.76a6.13 6.13 0 0 1 0-3.52V7.58H2.9a10.02 10.02 0 0 0 0 8.84l3.42-2.66Z" /><path fill="#ea4335" d="M12 6.06c1.5 0 2.85.52 3.91 1.53l2.94-2.94C17.05 2.97 14.75 2 12 2a10.19 10.19 0 0 0-9.1 5.58l3.42 2.66C7.12 7.84 9.36 6.06 12 6.06Z" /></svg>
}

function Logo() {
  return <a className="logo" href={homeLink()} aria-label="ASPECT home"><img src={imageUrl('aspect-logo.svg')} alt="ASPECT — Architecture and Design" width="112" height="103" /></a>
}

function Header({ menuOpen, setMenuOpen }) {
  const closeMenu = () => setMenuOpen(false)

  return <header>
    <Logo />
    <button className="menu" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="site-nav"><span>{menuOpen ? 'Close' : 'Menu'}</span><b /></button>
    <nav id="site-nav" className={menuOpen ? 'open' : ''} aria-label="Primary">
      <a href={homeLink()} onClick={closeMenu}>Home</a><a href={homeLink('#studio')} onClick={closeMenu}>About</a><a href={homeLink('#services')} onClick={closeMenu}>Services</a><a href={homeLink('#work')} onClick={closeMenu}>Portfolio</a>
    </nav>
    <a className="header-cta" href={homeLink('#contact')}>Start a project</a>
  </header>
}

function useFirestoreProjects() {
  const [projects, setProjects] = useState(defaultProjects)
  const [state, setState] = useState({ source: 'loading', error: '' })

  useEffect(() => subscribeToProjects(
    remoteProjects => {
      setProjects(remoteProjects)
      setState({ source: 'firestore', error: '' })
    },
    () => {
      setProjects(defaultProjects)
      setState({ source: 'seed-needed', error: '' })
    },
    error => {
      setProjects(defaultProjects)
      setState({ source: 'error', error: firebaseErrorMessage(error) })
    },
  ), [])

  return [projects, state]
}

function useFirebaseUser() {
  const [user, setUser] = useState(undefined)
  const [error, setError] = useState('')

  useEffect(() => onAuthStateChanged(auth, nextUser => {
    setUser(nextUser)
    setError('')
  }, nextError => {
    setUser(null)
    setError(firebaseErrorMessage(nextError))
  }), [])

  return { user, error, setError }
}

function ProjectImage({ project, image, className = '', priority = false, render = true }) {
  const source = image || project.images[0]
  return render ? <img className={`project-image ${className}`} src={imageSource(source)} alt={`${project.name} project`} loading={priority ? 'eager' : 'lazy'} /> : <div className={`project-image project-placeholder ${className}`} aria-hidden="true" />
}

function useReducedMotionPreference() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)

  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mediaQuery) return undefined
    const updatePreference = event => setPrefersReducedMotion(event.matches)
    updatePreference(mediaQuery)
    mediaQuery.addEventListener('change', updatePreference)
    return () => mediaQuery.removeEventListener('change', updatePreference)
  }, [])

  return prefersReducedMotion
}

function ProjectCarousel({ projects }) {
  const projectCount = projects.length
  const [activeIndex, setActiveIndex] = useState(0)
  const [renderedIndex, setRenderedIndex] = useState(() => projectCount > 1 ? 1 : 0)
  const [transitionEnabled, setTransitionEnabled] = useState(false)
  const activeIndexRef = useRef(0)
  const renderedIndexRef = useRef(projectCount > 1 ? 1 : 0)
  const moveInProgress = useRef(false)
  const resetFrame = useRef(null)
  const transitionTimer = useRef(null)
  const autoAdvanceTimer = useRef(null)
  const moveByRef = useRef(null)
  const prefersReducedMotion = useReducedMotionPreference()
  const safeActiveIndex = Math.min(activeIndex, Math.max(projectCount - 1, 0))
  const isLooping = projectCount > 1

  useEffect(() => {
    if (prefersReducedMotion) return undefined
    const frame = window.requestAnimationFrame(() => setTransitionEnabled(true))
    return () => window.cancelAnimationFrame(frame)
  }, [prefersReducedMotion])

  useEffect(() => () => {
    window.cancelAnimationFrame(resetFrame.current)
    window.clearTimeout(transitionTimer.current)
    window.clearTimeout(autoAdvanceTimer.current)
  }, [])

  const queueAutoAdvance = useCallback((delay = 0) => {
    window.clearTimeout(autoAdvanceTimer.current)
    if (projectCount < 2 || prefersReducedMotion) return
    autoAdvanceTimer.current = window.setTimeout(() => moveByRef.current?.(1), delay)
  }, [prefersReducedMotion, projectCount])

  const completeTransition = useCallback(() => {
    window.clearTimeout(transitionTimer.current)
    const currentRenderedIndex = renderedIndexRef.current
    const needsReset = currentRenderedIndex === 0 || currentRenderedIndex === projectCount + 1

    if (!needsReset) {
      moveInProgress.current = false
      queueAutoAdvance()
      return
    }

    const resetIndex = currentRenderedIndex === 0 ? projectCount : 1
    renderedIndexRef.current = resetIndex
    setTransitionEnabled(false)
    setRenderedIndex(resetIndex)
    window.cancelAnimationFrame(resetFrame.current)
    resetFrame.current = window.requestAnimationFrame(() => {
      resetFrame.current = window.requestAnimationFrame(() => {
        setTransitionEnabled(true)
        moveInProgress.current = false
        queueAutoAdvance()
      })
    })
  }, [projectCount, queueAutoAdvance])

  const moveBy = useCallback(direction => {
    if (projectCount < 2 || moveInProgress.current) return
    window.clearTimeout(autoAdvanceTimer.current)

    const nextActiveIndex = (activeIndexRef.current + direction + projectCount) % projectCount
    activeIndexRef.current = nextActiveIndex
    setActiveIndex(nextActiveIndex)

    if (prefersReducedMotion) {
      const nextRenderedIndex = nextActiveIndex + 1
      renderedIndexRef.current = nextRenderedIndex
      setTransitionEnabled(false)
      setRenderedIndex(nextRenderedIndex)
      return
    }

    moveInProgress.current = true
    const nextRenderedIndex = renderedIndexRef.current + direction
    renderedIndexRef.current = nextRenderedIndex
    setTransitionEnabled(true)
    setRenderedIndex(nextRenderedIndex)
    window.clearTimeout(transitionTimer.current)
    transitionTimer.current = window.setTimeout(completeTransition, 3200)
  }, [completeTransition, prefersReducedMotion, projectCount])

  useEffect(() => {
    moveByRef.current = moveBy
  }, [moveBy])

  useEffect(() => {
    queueAutoAdvance(900)
    return () => window.clearTimeout(autoAdvanceTimer.current)
  }, [queueAutoAdvance])

  const onTrackTransitionEnd = event => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') return
    completeTransition()
  }

  const onKeyDown = event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); moveBy(1) }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); moveBy(-1) }
  }

  if (!projectCount) {
    return <section id="work" className="showcase showcase-empty" aria-label="Selected projects"><p className="eyebrow">No projects have been added yet.</p></section>
  }

  const slides = isLooping ? [projects[projectCount - 1], ...projects, projects[0]] : projects

  return <section id="work" className="showcase" aria-label="Selected projects">
    <div className="showcase-stage" onKeyDown={onKeyDown} tabIndex="0">
      <div className="showcase-top"><p>Selected work</p><p>{String(safeActiveIndex + 1).padStart(2, '0')} / {String(projects.length).padStart(2, '0')}</p></div>
      <div className={`showcase-track${transitionEnabled && !prefersReducedMotion ? ' is-animating' : ''}`} onTransitionEnd={onTrackTransitionEnd} style={{ transform: `translate3d(-${renderedIndex * 100}%, 0, 0)` }}>
        {slides.map((project, index) => <article className="showcase-slide" aria-hidden={index !== renderedIndex} key={`${project.slug}-${index}`}>
          <ProjectImage project={project} priority={isLooping ? index === 1 : index === 0} />
          <div className="slide-shade" />
          <div className="showcase-content"><p className="eyebrow">{project.type}</p><h2>{project.name}</h2><a href={`#project/${project.slug}`} tabIndex={index === renderedIndex ? 0 : -1}>Explore project <Arrow /></a></div>
        </article>)}
      </div>
      <div className="showcase-controls"><button type="button" onClick={() => moveBy(-1)} aria-label="Previous project">←</button><button type="button" onClick={() => moveBy(1)} aria-label="Next project">→</button></div>
    </div>
  </section>
}

function ProjectShowcase({ projects }) {
  if (!projects.length) {
    return <section id="work" className="showcase showcase-empty" aria-label="Selected projects"><p className="eyebrow">No projects have been added yet.</p></section>
  }

  return <ProjectCarousel key={projects.map(project => project.slug).join('|')} projects={projects} />
}

function ProjectDetail({ project, onBack }) {
  return <main className="detail">
    <button className="back" type="button" onClick={onBack}>← All projects</button>
    <div className="detail-intro"><p className="eyebrow">{project.type}</p><h1>{project.name}</h1><p>Architecture shaped by atmosphere, material honesty, and the rituals of everyday life.</p></div>
    <ProjectImage project={project} className="detail-image" priority />
    {project.images.length > 1 && <div className="detail-gallery" aria-label={`${project.name} additional images`}>{project.images.slice(1).map((image, index) => <ProjectImage project={project} image={image} className="detail-gallery-image" key={`${image}-${index}`} />)}</div>}
    <section className="detail-grid"><p className="eyebrow">The brief</p><p>{project.description}</p><dl><div><dt>Completion</dt><dd>{project.completion}</dd></div><div><dt>Scope</dt><dd>{project.scope}</dd></div><div><dt>Status</dt><dd>{project.status}</dd></div></dl></section>
  </main>
}

function AdminSignIn({ authError, onSignIn, signingIn }) {
  return <main className="admin" id="top">
    <section className="admin-intro"><p className="eyebrow">Portfolio editor</p><h1>Project <em>admin.</em></h1><p>Project publishing is secured by Google sign-in and Firebase Security Rules.</p></section>
    <section className="admin-auth-card" aria-labelledby="admin-sign-in-heading">
      <p className="eyebrow">Secure access</p><h2 id="admin-sign-in-heading">Sign in to manage the portfolio.</h2>
      <p>Use the Google account authorised in the Firebase Security Rules. Accounts outside that allowlist can sign in but Firebase will reject every write.</p>
      <button className="admin-primary google-sign-in" type="button" onClick={onSignIn} disabled={signingIn}><GoogleIcon />{signingIn ? 'Opening Google…' : 'Continue with Google'}</button>
      {authError && <p className="admin-message" role="alert">{authError}</p>}
    </section>
  </main>
}

function AdminPage({ projects, syncState, user, authError, setAuthError }) {
  const [editingSlug, setEditingSlug] = useState(null)
  const [draft, setDraft] = useState(emptyProject)
  const [notice, setNotice] = useState('Select a project to edit it, or add a new one.')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [signingIn, setSigningIn] = useState(false)

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
    setNotice('Add the project details, then publish them for every visitor.')
  }
  const updateField = event => {
    const { name, value } = event.target
    setDraft(current => ({ ...current, [name]: value }))
  }
  const updateImage = (index, value) => setDraft(current => ({ ...current, images: current.images.map((image, imageIndex) => imageIndex === index ? value : image) }))
  const addImageReference = () => setDraft(current => ({ ...current, images: [...current.images, ''] }))
  const removeImage = index => setDraft(current => ({ ...current, images: current.images.filter((_, imageIndex) => imageIndex !== index) }))

  const signIn = async () => {
    setSigningIn(true)
    setAuthError('')
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (signInError) {
      setAuthError(firebaseErrorMessage(signInError))
    } finally {
      setSigningIn(false)
    }
  }

  const addUploadedImages = async event => {
    const input = event.target
    const files = [...input.files]
    if (!files.length) return
    setSaving(true)
    try {
      const images = await uploadProjectImages(files, draft.slug || draft.name)
      setDraft(current => ({ ...current, images: [...current.images.filter(Boolean), ...images] }))
      setError('')
      setNotice(`${images.length} image${images.length === 1 ? '' : 's'} uploaded. Publish the project to make the change live.`)
    } catch (uploadError) {
      setError(firebaseErrorMessage(uploadError))
    } finally {
      input.value = ''
      setSaving(false)
    }
  }

  const saveProject = async event => {
    event.preventDefault()
    const nextDraft = { ...draft, slug: slugify(draft.slug || draft.name), images: draft.images.filter(Boolean) }
    const previousProject = projects.find(project => project.slug === editingSlug)
    const nextProjects = isEditing ? projects.map(project => project.slug === editingSlug ? nextDraft : project) : [...projects, nextDraft]

    setSaving(true)
    try {
      const normalised = normaliseProjectDocument(nextProjects).projects
      const savedProject = normalised.find(project => project.slug === nextDraft.slug)
      await replaceProjectsInFirestore(normalised)
      const removedImages = previousProject ? previousProject.images.filter(image => !savedProject.images.includes(image)) : []
      await deleteProjectImages(removedImages)
      setEditingSlug(savedProject.slug)
      setDraft(savedProject)
      setError('')
      setNotice(`${savedProject.name} is published and visible to every visitor.`)
    } catch (saveError) {
      setError(firebaseErrorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  const seedExistingProjects = async () => {
    setSaving(true)
    try {
      await replaceProjectsInFirestore(defaultProjects)
      setError('')
      setNotice('The original four projects are now seeded in Firestore for every visitor.')
    } catch (seedError) {
      setError(firebaseErrorMessage(seedError))
    } finally {
      setSaving(false)
    }
  }

  const removeProject = async () => {
    const project = projects.find(item => item.slug === editingSlug)
    if (!project || !window.confirm(`Remove “${project.name}” from the portfolio?`)) return
    setSaving(true)
    try {
      await deleteProjectFromFirestore(project)
      setEditingSlug(null)
      setDraft(emptyProject())
      setError('')
      setNotice(`${project.name} was removed from the live portfolio.`)
    } catch (removeError) {
      setError(firebaseErrorMessage(removeError))
    } finally {
      setSaving(false)
    }
  }

  if (user === undefined) return <main className="admin" id="top"><section className="admin-intro"><p className="eyebrow">Portfolio editor</p><h1>Checking <em>access.</em></h1></section></main>
  if (!user) return <AdminSignIn authError={authError} onSignIn={signIn} signingIn={signingIn} />

  return <main className="admin" id="top">
    <section className="admin-intro"><p className="eyebrow">Portfolio editor</p><h1>Project <em>admin.</em></h1><p>Signed in as <strong>{user.email}</strong>. Firebase Security Rules, not this page, determine whether your account may publish changes.</p><button className="admin-sign-out" type="button" onClick={() => signOut(auth)}>Sign out</button></section>
    {syncState.source === 'seed-needed' && <section className="admin-seed" aria-label="Seed Firestore"><p><strong>Firestore is empty.</strong> Seed the four existing projects once to make the public site read its data from the shared collection.</p><button className="admin-primary" type="button" onClick={seedExistingProjects} disabled={saving}>Seed original projects <Arrow /></button></section>}
    {syncState.error && <p className="admin-message" role="alert">{syncState.error}</p>}
    <section className="admin-toolbar" aria-label="Project administration actions"><button className="admin-primary" type="button" onClick={startNewProject} disabled={saving}>Add project <Arrow /></button></section>
    <p className="admin-persistence">Every published edit is written to Cloud Firestore. Uploads are stored in Firebase Storage; no project changes are saved in this browser.</p>
    <div className="admin-layout" aria-busy={saving}>
      <aside className="admin-project-list" aria-label="Projects"><div><p className="eyebrow">Projects</p><span>{projects.length}</span></div>{projects.length ? projects.map(project => <button className={project.slug === editingSlug ? 'active' : ''} type="button" onClick={() => selectProject(project)} aria-pressed={project.slug === editingSlug} key={project.slug}><small>{project.number}</small><strong>{project.name}</strong><em>{project.type}</em></button>) : <p className="admin-empty">No projects yet. Add one to begin.</p>}</aside>
      <section className="admin-editor" aria-live="polite">
        <div className="admin-editor-heading"><div><p className="eyebrow">{isEditing ? 'Editing project' : 'New project'}</p><h2>{isEditing ? draft.name || 'Untitled project' : 'Add a project'}</h2></div>{isEditing && <button className="admin-delete" type="button" onClick={removeProject} disabled={saving}>Remove project</button>}</div>
        <p className="admin-message" role={error ? 'alert' : 'status'}>{error || notice}</p>
        <form onSubmit={saveProject}>
          <div className="admin-fields"><label>Project header<input name="name" value={draft.name} onChange={updateField} placeholder="House of Light" required disabled={saving} /></label><label>Slug<input name="slug" value={draft.slug} onChange={updateField} placeholder="house-of-light" pattern="[a-z0-9\-]+" aria-describedby="slug-help" required={Boolean(draft.slug)} disabled={saving} /></label><p className="field-help" id="slug-help">Leave blank to create a slug from the header. Slugs must be unique.</p><label>Type / eyebrow<input name="type" value={draft.type} onChange={updateField} placeholder="Residential · Yerevan" required disabled={saving} /></label><label className="admin-field-wide">Project brief<textarea name="description" value={draft.description} onChange={updateField} rows="5" placeholder="Describe the project, its material, and intent." required disabled={saving} /></label><label>Completion<input name="completion" value={draft.completion} onChange={updateField} placeholder="2025" required disabled={saving} /></label><label>Scope<input name="scope" value={draft.scope} onChange={updateField} placeholder="Architecture · Interiors" required disabled={saving} /></label><label>Status<input name="status" value={draft.status} onChange={updateField} placeholder="Built" required disabled={saving} /></label></div>
          <fieldset className="admin-images" disabled={saving}><legend>Project images</legend><p>Upload images directly to Firebase Storage, or add a full image URL or one of the original files from <code>public/images</code>.</p>{draft.images.map((image, index) => <div className="admin-image-row" key={`${index}-${image.slice(0, 24)}`}><label>Image {index + 1}<input value={image} onChange={event => updateImage(index, event.target.value)} placeholder="project-house-of-light.jpg" required={index === 0} /></label>{image && <img src={imageSource(image)} alt={`Preview ${index + 1}`} />}{draft.images.length > 1 && <button type="button" className="admin-image-remove" onClick={() => removeImage(index)} aria-label={`Remove image ${index + 1}`}>Remove</button>}</div>)}<div className="admin-image-actions"><button type="button" className="admin-button" onClick={addImageReference}>Add image URL</button><label className="admin-button upload-button">Upload image<input type="file" accept="image/*" multiple onChange={addUploadedImages} /></label></div></fieldset>
          <div className="admin-form-actions"><button className="admin-primary" type="submit" disabled={saving}>{saving ? 'Publishing…' : isEditing ? 'Save changes' : 'Create project'} <Arrow /></button><button className="admin-button" type="button" onClick={startNewProject} disabled={saving}>Clear form</button></div>
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
  const [projects, syncState] = useFirestoreProjects()
  const { user, error: authError, setError: setAuthError } = useFirebaseUser()
  const [pageRoute, setPageRoute] = useState(currentPageRoute)
  const [hashRoute, setHashRoute] = useState(() => window.location.hash.slice(1))
  const isAdmin = pageRoute === 'admin'
  const slug = !isAdmin && hashRoute.startsWith('project/') ? hashRoute.split('/')[1] : null
  const project = projects.find(item => item.slug === slug)

  useEffect(() => {
    const updateRoute = () => {
      setPageRoute(currentPageRoute())
      setHashRoute(window.location.hash.slice(1))
    }
    window.addEventListener('hashchange', updateRoute)
    window.addEventListener('popstate', updateRoute)
    return () => {
      window.removeEventListener('hashchange', updateRoute)
      window.removeEventListener('popstate', updateRoute)
    }
  }, [])
  useEffect(() => {
    document.title = isAdmin ? 'Project admin — ASPECT' : project ? `${project.name} — ASPECT` : 'ASPECT — Architecture and Design'
    if (project || isAdmin) window.scrollTo(0, 0)
  }, [isAdmin, project])

  return <><Header menuOpen={menuOpen} setMenuOpen={setMenuOpen} />{isAdmin ? <AdminPage projects={projects} syncState={syncState} user={user} authError={authError} setAuthError={setAuthError} /> : project ? <ProjectDetail project={project} onBack={() => { window.location.hash = 'work' }} /> : <Home projects={projects} />}</>
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
