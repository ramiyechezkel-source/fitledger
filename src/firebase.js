import { initializeApp } from 'firebase/app'
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

// הגדרות הפרויקט fitledger. אלה מזהים ציבוריים; ההגנה היא ב-Security Rules + Authentication.
const firebaseConfig = {
  apiKey: 'AIzaSyBLpc9T-4Ep667kFKfJzlp10QJC8l7_Bdo',
  authDomain: 'fitledger-a516a.firebaseapp.com',
  projectId: 'fitledger-a516a',
  storageBucket: 'fitledger-a516a.firebasestorage.app',
  messagingSenderId: '99553974535',
  appId: '1:99553974535:web:2e679358c92b51c0b88da2',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
setPersistence(auth, browserLocalPersistence).catch(() => {})

// מטמון מקומי מתמיד: נתונים שכבר נטענו לא נקראים שוב מהשרת (חוסך קריאות ועובד אופליין).
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})
