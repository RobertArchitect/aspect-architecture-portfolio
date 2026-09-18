import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Firebase web configuration identifies this public web client. It is not a
// credential; Firestore Security Rules protect project data.
const firebaseConfig = {
  apiKey: 'AIzaSyAePKUad4aarfgypHDYmOgTbJrmLUJgFLI',
  authDomain: 'aspectportfolio.firebaseapp.com',
  projectId: 'aspectportfolio',
  storageBucket: 'aspectportfolio.firebasestorage.app',
  messagingSenderId: '560624393379',
  appId: '1:560624393379:web:9c9fc589d01055713a7316',
  measurementId: 'G-0VWRVNQFSR',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const database = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()

googleProvider.setCustomParameters({ prompt: 'select_account' })
