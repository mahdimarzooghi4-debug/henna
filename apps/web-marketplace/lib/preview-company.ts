import { normalizeDigits } from "./normalize-digits";
export type PreviewCompany = { name:string; nationalId:string; registrationNumber:string; economicCode:string; address:string; postalCode:string };
export const emptyPreviewCompany:PreviewCompany={name:"",nationalId:"",registrationNumber:"",economicCode:"",address:"",postalCode:""};
const key="henna:preview-company:v1";
export function normalizeCompany(value:PreviewCompany):PreviewCompany {
 return {name:value.name.trim(),nationalId:normalizeDigits(value.nationalId).trim(),registrationNumber:normalizeDigits(value.registrationNumber).trim(),economicCode:normalizeDigits(value.economicCode).trim(),address:value.address.trim(),postalCode:normalizeDigits(value.postalCode).trim()};
}
export function validPreviewCompany(value:PreviewCompany):boolean {
 const v=normalizeCompany(value);
 return v.name.length>0&&v.name.length<=200&&/^\d{11}$/.test(v.nationalId)&&/^\d{1,20}$/.test(v.registrationNumber)&&(!v.economicCode||/^\d{1,20}$/.test(v.economicCode))&&v.address.length<=500&&(!v.postalCode||/^\d{10}$/.test(v.postalCode));
}
export function readPreviewCompany():PreviewCompany|null {
 try { const raw:unknown=JSON.parse(sessionStorage.getItem(key)??"null");if(!raw||typeof raw!=="object")return null;
 const v=raw as Record<string,unknown>;if(!Object.keys(emptyPreviewCompany).every(k=>typeof v[k]==="string"))return null;
 const company=normalizeCompany(v as PreviewCompany);return validPreviewCompany(company)?company:null;
 }catch{return null;}
}
export function savePreviewCompany(value:PreviewCompany):boolean {
 if(!validPreviewCompany(value))return false;
 try{sessionStorage.setItem(key,JSON.stringify(normalizeCompany(value)));return true;}catch{return false;}
}
