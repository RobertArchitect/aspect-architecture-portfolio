import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { database } from './firebase'
import { firestoreProjects, normaliseProjectDocument, slugify } from './projects'

const projectsCollection = collection(database, 'projects')
const maximumImageBytes = 10 * 1024 * 1024
const cloudinaryCloudName = 'fogield7'
const cloudinaryUploadPreset = 'aspect-portfolio'
const cloudinaryUploadUrl = `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`

export function subscribeToProjects(onProjects, onEmpty, onError) {
  const orderedProjects = query(projectsCollection, orderBy('sortOrder', 'asc'))

  return onSnapshot(orderedProjects, snapshot => {
    if (snapshot.empty) {
      onEmpty()
      return
    }

    try {
      onProjects(normaliseProjectDocument(snapshot.docs.map(project => project.data())).projects)
    } catch (error) {
      onError(error)
    }
  }, onError)
}

export async function replaceProjectsInFirestore(projects) {
  const nextProjects = firestoreProjects(projects)
  const currentSnapshot = await getDocs(projectsCollection)
  const nextSlugs = new Set(nextProjects.map(project => project.slug))
  const batch = writeBatch(database)

  nextProjects.forEach(project => {
    batch.set(doc(database, 'projects', project.slug), {
      ...project,
      updatedAt: serverTimestamp(),
    })
  })

  currentSnapshot.docs.forEach(project => {
    if (!nextSlugs.has(project.id)) batch.delete(project.ref)
  })

  await batch.commit()
  return normaliseProjectDocument(nextProjects).projects
}

export async function uploadProjectImages(files, projectSlug) {
  const slug = slugify(projectSlug)
  if (!slug) throw new Error('Add a project header before uploading images.')

  return Promise.all(files.map(async file => {
    if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image.`)
    if (file.size > maximumImageBytes) throw new Error(`${file.name} is larger than 10 MB.`)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', cloudinaryUploadPreset)

    const response = await fetch(cloudinaryUploadUrl, { method: 'POST', body: formData })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || !payload.secure_url) {
      const error = new Error(payload.error?.message || 'Cloudinary could not upload this image. Please try again.')
      error.code = 'cloudinary/upload-failed'
      throw error
    }

    return payload.secure_url
  }))
}

export async function deleteProjectFromFirestore(project) {
  await deleteDoc(doc(database, 'projects', project.slug))
}

export function firebaseErrorMessage(error) {
  if (error?.code === 'permission-denied') {
    return 'Firebase denied this action. Sign in with the allowlisted Google account, then confirm the deployed Security Rules include that exact email.'
  }

  if (error?.code === 'auth/popup-closed-by-user') return 'Google sign-in was closed before it finished.'
  if (error?.code === 'auth/unauthorized-domain') return 'This domain is not authorised in Firebase Authentication yet.'
  if (error?.code === 'cloudinary/upload-failed') return error.message

  return error?.message || 'Firebase could not complete that action. Please try again.'
}
