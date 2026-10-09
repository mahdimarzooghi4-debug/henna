import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Crypto from "expo-crypto";
import { evidencePhotoValid,type IncidentPhoto } from "./buyer-incidents-controller.ts";
import {
  deleteTransientIncidentPhoto,
  persistIncidentPhoto,
} from "./native-pending-commerce.ts";
/** System gallery picker only; no camera or location permission, no EXIF sent to API. */
export async function chooseIncidentPhoto():Promise<IncidentPhoto|null>{
 const picked=await ImagePicker.launchImageLibraryAsync({mediaTypes:["images"],allowsEditing:false,selectionLimit:1,quality:1,exif:false});
 if(picked.canceled)return null;const asset=picked.assets[0];if(!asset||!asset.width||!asset.height)throw Error("عکس انتخاب‌شده قابل خواندن نیست.");
 const scale=Math.min(1,640/Math.max(asset.width,asset.height)),width=Math.max(1,Math.round(asset.width*scale)),height=Math.max(1,Math.round(asset.height*scale));
 for(const compress of [.7,.4,.2]){
  const result=await ImageManipulator.manipulateAsync(asset.uri,[{resize:{width,height}}],{compress,format:ImageManipulator.SaveFormat.JPEG,base64:true});
  const candidate={uri:result.uri,base64:result.base64??""};
  if(evidencePhotoValid(candidate)){
   const durable=await persistIncidentPhoto(result.uri,Crypto.randomUUID());
   try{await deleteTransientIncidentPhoto(result.uri);}catch{}
   return {uri:durable,base64:candidate.base64};
  }
  try{await deleteTransientIncidentPhoto(result.uri);}catch{}
 }
 throw Error("عکس هنوز بزرگ است؛ یک عکس ساده‌تر یا برش‌خورده انتخاب کنید. سقف عکس مدرک ۴۰ کیلوبایت است.");
}
