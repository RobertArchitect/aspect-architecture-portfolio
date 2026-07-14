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
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { database, storage } from './firebase'
import { firestoreProjects, normaliseProjectDocument, slugify } from './projects'

const projectsCollection = collection(database, 'projects')
const maximumImageBytes = 10 * 1024 * 1024

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

function safeFileName(fileName) {
  const extension = fileName.includes('.') ? `.${fileName.split('.').pop().toLowerCase()}` : ''
  const stem = slugify(fileName.replace(/\.[^.]+$/, '')) || 'image'
  return `${stem}${extension}`
}

export async function uploadProjectImages(files, projectSlug) {
  const slug = slugify(projectSlug)
  if (!slug) throw new Error('Add a project header before uploading images.')

  return Promise.all(files.map(async file => {
    if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image.`)
    if (file.size > maximumImageBytes) throw new Error(`${file.name} is larger than 10 MB.`)

    const identifier = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const uploadReference = ref(storage, `projects/${slug}/${identifier}-${safeFileName(file.name)}`)
    const snapshot = await uploadBytes(uploadReference, file, { contentType: file.type })
    return getDownloadURL(snapshot.ref)
  }))
}

function isManagedStorageUrl(value) {
  return typeof value === 'string' && (value.startsWith('gs://') || value.includes('firebasestorage.googleapis.com'))
}

export async function deleteProjectImages(images) {
  const deletions = images.filter(isManagedStorageUrl).map(async image => {
    try {
      await deleteObject(ref(storage, image))
    } catch (error) {
      if (error?.code !== 'storage/object-not-found') throw error
    }
  })

  await Promise.all(deletions)
}

export async function deleteProjectFromFirestore(project) {
  await deleteDoc(doc(database, 'projects', project.slug))
  await deleteProjectImages(project.images)
}

export function firebaseErrorMessage(error) {
  if (error?.code === 'permission-denied' || error?.code === 'storage/unauthorized') {
    return 'Firebase denied this action. Sign in with the allowlisted Google account, then confirm the deployed Security Rules include that exact email.'
  }

  if (error?.code === 'auth/popup-closed-by-user') return 'Google sign-in was closed before it finished.'
  if (error?.code === 'auth/unauthorized-domain') return 'This domain is not authorised in Firebase Authentication yet.'
  if (error?.code === 'storage/unauthenticated') return 'Sign in with Google before uploading an image.'

  return error?.message || 'Firebase could not complete that action. Please try again.'
}
