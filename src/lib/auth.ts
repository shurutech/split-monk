import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { resolvePendingInvites } from '@/lib/firestore'

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider()
  const result   = await signInWithPopup(auth, provider)
  const user     = result.user

  const userRef = doc(db, 'users', user.uid)
  const snap    = await getDoc(userRef)

  if (!snap.exists()) {
    await setDoc(userRef, {
      uid:          user.uid,
      email:        user.email,
      displayName:  user.displayName ?? '',
      photoURL:     user.photoURL ?? '',
      createdAt:    serverTimestamp(),
      lastActiveAt: serverTimestamp(),
    })
  } else {
    await setDoc(userRef, { lastActiveAt: serverTimestamp() }, { merge: true })
  }

  // Resolve any pending group invites for this email — fire-and-forget,
  // failures here must not block sign-in.
  if (user.email) {
    resolvePendingInvites(user.uid, user.email).catch((err) => {
      console.error('[auth] resolvePendingInvites failed:', err)
    })
  }

  return user
}

export async function signOut() {
  await firebaseSignOut(auth)
}
