import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Proyecto formularios-7f89a — datos propios de los formularios
const firebaseConfig = {
  apiKey: "AIzaSyBTrJuMQAdOtYJVxVcqxZYgCSkijgaCB3k",
  authDomain: "formularios-7f89a.firebaseapp.com",
  projectId: "formularios-7f89a",
  storageBucket: "formularios-7f89a.firebasestorage.app",
  messagingSenderId: "325241702490",
  appId: "1:325241702490:web:3a110a95bc5e80902a7063",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
