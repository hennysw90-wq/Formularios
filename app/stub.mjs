const S = "export const collection=()=>{};export const deleteDoc=()=>{};export const doc=()=>{};export const getDocs=()=>{};export const onSnapshot=()=>{};export const query=()=>{};export const setDoc=()=>{};export const where=()=>{};export const getFirestore=()=>{};export const initializeApp=()=>{};export const getApps=()=>[];export const getAuth=()=>({});export const signInAnonymously=()=>Promise.resolve();export const onAuthStateChanged=()=>()=>{};export const getDoc=()=>{};export const updateDoc=()=>{};export const deleteField=()=>{};export class FieldPath{};";
export async function resolve(spec, ctx, next) {
  if (spec.startsWith("firebase/")) return { url: "data:text/javascript," + encodeURIComponent(S), shortCircuit: true };
  return next(spec, ctx);
}
