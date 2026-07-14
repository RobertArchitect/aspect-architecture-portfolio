import defaultProjectDocument from './projects.json'

const requiredFields = ['name', 'type', 'description', 'completion', 'scope', 'status']

const asString = value => typeof value === 'string' ? value.trim() : ''

export function slugify(value) {
  return asString(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function normaliseImageReference(value) {
  const image = asString(value)
  if (!image) return ''
  if (/^(data:|https?:|\/)/i.test(image)) return image
  return image.replace(/^public\/images\//, '').replace(/^images\//, '')
}

function normaliseProject(project, index) {
  if (!project || typeof project !== 'object') throw new Error(`Project ${index + 1} is invalid.`)

  const name = asString(project.name)
  const slug = slugify(project.slug || name)
  const images = (Array.isArray(project.images) ? project.images : [project.image])
    .map(normaliseImageReference)
    .filter(Boolean)

  if (!slug) throw new Error(`Project ${index + 1} needs a unique slug.`)
  if (!images.length) throw new Error(`${name || `Project ${index + 1}`} needs at least one image.`)

  const normalised = {
    slug,
    number: String(index + 1).padStart(2, '0'),
    name,
    type: asString(project.type),
    description: asString(project.description),
    completion: asString(project.completion),
    scope: asString(project.scope),
    status: asString(project.status),
    images,
  }

  requiredFields.forEach(field => {
    if (!normalised[field]) throw new Error(`${field[0].toUpperCase()}${field.slice(1)} is required for ${name || `project ${index + 1}`}.`)
  })

  return normalised
}

export function normaliseProjectDocument(input) {
  const sourceProjects = Array.isArray(input) ? input : input?.projects
  if (!Array.isArray(sourceProjects)) throw new Error('Import a projects.json file with a projects array.')

  const slugs = new Set()
  const projects = sourceProjects.map((project, index) => {
    const normalised = normaliseProject(project, index)
    if (slugs.has(normalised.slug)) throw new Error(`The slug “${normalised.slug}” is used more than once.`)
    slugs.add(normalised.slug)
    return normalised
  })

  return { version: 1, projects }
}

export const defaultProjects = normaliseProjectDocument(defaultProjectDocument).projects

export function firestoreProjects(projects) {
  return normaliseProjectDocument(projects).projects.map(({ number: _number, ...project }, index) => ({
    ...project,
    sortOrder: index + 1,
  }))
}

export function imageSource(image) {
  if (/^(data:|https?:|\/)/i.test(image)) return image
  return `${import.meta.env.BASE_URL}images/${image}`
}

export function emptyProject() {
  return {
    slug: '',
    name: '',
    type: '',
    description: '',
    completion: '',
    scope: '',
    status: '',
    images: [''],
  }
}
