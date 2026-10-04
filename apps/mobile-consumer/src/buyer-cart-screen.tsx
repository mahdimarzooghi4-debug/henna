import { useEffect, useState } from "react";
import { AppState, BackHandler, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeCartController, initialNativeCartState } from "./buyer-cart-controller.ts";
import type { MobileCommerceClient } from "./mobile-commerce.ts";
import { MobileCatalogClient } from "./mobile-catalog.ts";
import { colors } from "./theme";
import * as Crypto from "expo-crypto";
const logo=require("../assets/hana-cart-logo.png");
const rtl={textAlign:"right",writingDirection:"rtl",fontFamily:"Vazirmatn_400Regular"} as const;
/** Draft Figma 715:35 translated into native layout with real reference-cart controls. */
export function BuyerCartScreen({api,onBack,onLogin,onCheckout,selectedProduct}:{api:MobileCommerceClient;onBack:()=>void;onLogin:()=>void;onCheckout:()=>void;selectedProduct:string|null}) {
 const [state,setState]=useState(initialNativeCartState);
 const [controller]=useState(()=>new NativeCartController(api,new MobileCatalogClient(process.env.EXPO_PUBLIC_HANA_API_BASE_URL,fetch,__DEV__),Crypto.randomUUID,setState));
 useEffect(()=>{controller.start();const app=AppState.addEventListener("change",s=>{if(s==="active")void controller.refresh();});return()=>{app.remove();controller.stop();};},[controller]);
 useEffect(()=>{const back=BackHandler.addEventListener("hardwareBackPress",()=>{if(!state.busy&&!state.intent)onBack();return true;});return()=>back.remove();},[onBack,state.busy,state.intent]);
 const disabled=state.busy||!!state.intent;
 const action=(label:string,run:()=>void,off=false,visible=label)=><Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled:off}} disabled={off} onPress={run} style={[styles.button,off&&{opacity:0.5},visible!==label&&{width:42,paddingHorizontal:0}]}><Text style={styles.buttonText}>{visible}</Text></Pressable>;
 return <SafeAreaView style={styles.safe} edges={["top","bottom"]}><ScrollView contentContainerStyle={{flexGrow:1}}><View style={styles.header}><Image source={logo} style={styles.logo} resizeMode="contain" accessibilityLabel="حنا"/>{action("بازگشت",onBack,disabled)}</View><View style={styles.content}>
 <Text style={styles.eyebrow}>خرید از حنا</Text><Text style={styles.title} accessibilityRole="header">سبد مرجع خرید</Text><Text style={styles.text}>کالاها را برای مقایسهٔ پیشنهادها نگه دارید.</Text>
 <View style={styles.notice}><Text style={[styles.text,{color:colors.teal}]}>این سبد قیمت قطعی، پوشش یا موجودی را تضمین نمی‌کند و هنوز سفارش یا رزروی نمی‌سازد.</Text></View>
 {action("مقایسه فروشگاه‌ها و ادامه خرید",onCheckout,disabled)}
 {state.error?<View style={styles.card}><Text accessibilityRole="alert" style={styles.text}>{state.error.message}</Text>{state.error.status===401?action("ورود برای مشاهده سبد",onLogin):action("تلاش دوباره",()=>void controller.refresh(),state.busy)}</View>:!state.cart?<Text accessibilityLiveRegion="polite" style={styles.text}>در حال دریافت سبد…</Text>:<View style={styles.card}><Text style={styles.cardTitle}>اقلام سبد مرجع</Text>
 {state.cart.items.length===0&&<Text style={styles.text}>سبد خرید خالی است.</Text>}
 {state.cart.items.map(i=><View key={i.productId} style={styles.item}><Text style={styles.itemTitle}>{state.names[i.productId]}</Text><Text style={styles.text}>تعداد درخواستی: {new Intl.NumberFormat("fa-IR").format(i.quantity)}</Text><View style={styles.quantity}>{action("افزایش تعداد",()=>void controller.set(i.productId,i.quantity+1),disabled||i.quantity>=999,"+")}<Text style={styles.text}>{new Intl.NumberFormat("fa-IR").format(i.quantity)}</Text>{action("کاهش تعداد",()=>void controller.set(i.productId,i.quantity-1),disabled||i.quantity<=1,"−")}</View>{action("حذف از سبد",()=>void controller.set(i.productId,0),disabled)}</View>)}
 {selectedProduct&&action("افزودن کالای انتخاب‌شده",()=>void controller.set(selectedProduct,(state.cart?.items.find(i=>i.productId===selectedProduct)?.quantity??0)+1),disabled||(state.cart.items.find(i=>i.productId===selectedProduct)?.quantity??0)>=999)}
 {action("افزودن کالای دیگر",onBack,disabled)}
 </View>}
 {state.message!==""&&<Text accessibilityLiveRegion="polite" style={styles.text}>{state.message}</Text>}{state.intent&&action("بررسی نتیجه درخواست قبلی",()=>void controller.retry(),state.busy)}
 <Text style={styles.text}>برای خرید، یک فروشگاه را مقایسه و انتخاب کنید؛ اقلام این سبد در حساب وب شما نیز قابل مشاهده‌اند.</Text>
 {action("بازگشت به فهرست کالاها",onBack,disabled)}
 </View></ScrollView></SafeAreaView>;
}
const styles=StyleSheet.create({
 safe:{flex:1,backgroundColor:colors.cream},header:{height:80,paddingHorizontal:20,paddingVertical:14,backgroundColor:colors.surface,flexDirection:"row-reverse",justifyContent:"space-between",alignItems:"center"},logo:{width:145,height:48},
 content:{paddingHorizontal:20,paddingTop:24,paddingBottom:48,gap:18,width:"100%",maxWidth:560,alignSelf:"center"},eyebrow:{...rtl,color:colors.terracotta,fontSize:12,fontFamily:"Vazirmatn_700Bold"},title:{...rtl,color:colors.charcoal,fontSize:24,fontFamily:"Vazirmatn_700Bold",lineHeight:40},text:{...rtl,color:colors.muted,fontSize:14,lineHeight:24},notice:{backgroundColor:colors.paleTeal,padding:16,borderRadius:12,minHeight:96,justifyContent:"center"},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.beige,borderRadius:14,padding:12,gap:16,minHeight:374},cardTitle:{...rtl,color:colors.teal,fontSize:17,fontFamily:"Vazirmatn_700Bold"},item:{backgroundColor:colors.cream,padding:16,borderRadius:10,gap:12},itemTitle:{...rtl,color:colors.charcoal,fontFamily:"Vazirmatn_700Bold",fontSize:15},quantity:{flexDirection:"row-reverse",gap:8,alignItems:"center",flexWrap:"wrap"},button:{minHeight:44,paddingHorizontal:10,paddingVertical:8,borderWidth:1,borderColor:colors.teal,borderRadius:9,justifyContent:"center",backgroundColor:colors.surface},buttonText:{...rtl,textAlign:"center",color:colors.teal,fontFamily:"Vazirmatn_700Bold",fontSize:14},
});
