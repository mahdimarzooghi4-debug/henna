import { useEffect, useState } from "react";
import { AppState, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeCartController, initialNativeCartState } from "./buyer-cart-controller.ts";
import type { MobileCommerceClient } from "./mobile-commerce.ts";
import { MobileCatalogClient } from "./mobile-catalog.ts";
import * as Crypto from "expo-crypto";
import { pendingCommerceStore } from "./native-pending-commerce.ts";

const fa = (value:number) => new Intl.NumberFormat("fa-IR").format(value);

/** Buyer basket screen aligned to Figma frame 452:980. */
export function BuyerCartScreen({api,onBack,onLogin,onCheckout,selectedProduct}:{api:MobileCommerceClient;onBack:()=>void;onLogin:()=>void;onCheckout:()=>void;selectedProduct:string|null}) {
 const [state,setState]=useState(initialNativeCartState);
 const [controller]=useState(()=>new NativeCartController(api,new MobileCatalogClient(process.env.EXPO_PUBLIC_HANA_API_BASE_URL,fetch,__DEV__),Crypto.randomUUID,setState,pendingCommerceStore));
 useEffect(()=>{controller.start();const app=AppState.addEventListener("change",s=>{if(s==="active")void controller.refresh();});return()=>{app.remove();controller.stop();};},[controller]);
 useEffect(()=>{const back=BackHandler.addEventListener("hardwareBackPress",()=>{if(!state.busy&&!state.intent)onBack();return true;});return()=>back.remove();},[onBack,state.busy,state.intent]);
 const disabled=state.busy||!!state.intent;
 const action=(label:string,run:()=>void,off=false,small=false,primary=false,visible=label)=><Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled:off}} disabled={off} onPress={run} style={[styles.button,small&&styles.stepButton,primary&&styles.primary,off&&styles.disabled]}><Text style={[styles.buttonText,primary&&styles.primaryText,small&&styles.stepText]}>{visible}</Text></Pressable>;
 return <SafeAreaView style={styles.safe} edges={["top","bottom"]}>
   <View style={styles.header}>
     {action("بازگشت",onBack,disabled,true,false,"›")}
     <Text style={styles.headerTitle} accessibilityRole="header" accessibilityLabel="سبد مرجع خرید">سبد خرید شما</Text>
     <View style={styles.headerSpacer}/>
   </View>
   <ScrollView style={styles.scroller} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
     {state.error?<View style={styles.inlineState}><Text accessibilityRole="alert" style={styles.body}>{state.error.message}</Text>{state.error.status===401?action("ورود برای مشاهده سبد",onLogin):action("تلاش دوباره",()=>void controller.refresh(),state.busy)}</View>:!state.cart?<Text accessibilityLiveRegion="polite" style={styles.emptyText}>در حال دریافت سبد…</Text>:<>
       {state.cart.items.length===0?<View style={styles.emptyState}><Text style={styles.emptyTitle}>سبد خرید خالی است</Text><Text style={styles.body}>از کاتالوگ، کالاها را به سبد اضافه کنید.</Text>{action("بازگشت به کالاها",onBack,disabled)}</View>:<View style={styles.items}>
         {state.cart.items.map((item,index)=><View key={item.productId} style={styles.item}>
           <View style={styles.quantity}>
             {action("افزایش تعداد",()=>void controller.set(item.productId,item.quantity+1),disabled||item.quantity>=999,true,false,"+")}
             <Text style={styles.quantityValue}>{fa(item.quantity)}</Text>
             {action("کاهش تعداد",()=>void controller.set(item.productId,item.quantity-1),disabled||item.quantity<=1,true,false,"−")}
           </View>
           <View style={styles.itemDetails}>
             <Text style={styles.itemName} numberOfLines={2}>{state.names[item.productId]??"نام کالا"}</Text>
             <Text style={styles.itemMeta}>تعداد درخواستی · {fa(item.quantity)}</Text>
           </View>
           <View style={styles.productThumb} accessibilityElementsHidden><Text style={styles.thumbGlyph}>{index%2===0?"▦":"◈"}</Text></View>
         </View>)}
         {selectedProduct&&!state.cart.items.some(i=>i.productId===selectedProduct)&&action("افزودن کالای انتخاب‌شده",()=>void controller.set(selectedProduct,1),disabled)}
       </View>}
       {state.cart.items.length>0&&<View style={styles.summary}>
         <View style={styles.priceRow}><Text style={styles.priceValue}>—</Text><Text style={styles.priceLabel}>جمع قیمت مرجع:</Text></View>
         <View style={styles.notice}><Text style={styles.infoMark}>ⓘ</Text><Text style={styles.noticeText}>قیمت نهایی پس از انتخاب فروشگاه مشخص می‌شود. فروشگاه‌ها بر اساس موجودی و فاصله، قیمت متفاوتی دارند.</Text></View>
       </View>}
     </>}
     {state.message!==""&&<Text accessibilityLiveRegion="polite" style={styles.feedback}>{state.message}</Text>}
     {state.intent&&action("بررسی نتیجه درخواست قبلی",()=>void controller.retry(),state.busy)}
   </ScrollView>
   <View style={styles.footer}>
     {action("مقایسه فروشگاه‌ها و ادامه خرید",onCheckout,disabled,false,true,"مقایسه فروشگاه‌ها و انتخاب")}
   </View>
 </SafeAreaView>;
}

const styles=StyleSheet.create({
 safe:{flex:1,backgroundColor:"#f7f3ed"},
 header:{height:56,paddingHorizontal:16,backgroundColor:"#fff",borderBottomWidth:1,borderBottomColor:"#e8ded3",flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
 headerTitle:{fontFamily:"Estedad_700Bold",fontSize:18,color:"#2d2d2d",textAlign:"center",writingDirection:"rtl"},headerSpacer:{width:40},
 button:{minHeight:38,minWidth:40,paddingHorizontal:12,paddingVertical:7,borderRadius:10,alignItems:"center",justifyContent:"center",backgroundColor:"#fff"},buttonText:{fontFamily:"Estedad_700Bold",fontSize:13,color:"#b5523b",textAlign:"center",writingDirection:"rtl"},
 stepButton:{width:24,height:24,minWidth:24,minHeight:24,padding:0,backgroundColor:"#f7f3ed",borderRadius:12},stepText:{fontSize:14,color:"#2d2d2d",lineHeight:22},primary:{height:50,width:"100%",minHeight:50,backgroundColor:"#b5523b",borderRadius:12},primaryText:{fontSize:15,color:"#fff"},disabled:{opacity:.48},
 scroller:{flex:1},scrollContent:{paddingBottom:16},items:{padding:16,gap:12},
 item:{width:"100%",minHeight:102,padding:12,gap:12,flexDirection:"row",alignItems:"center",backgroundColor:"#fff",borderColor:"#e8ded3",borderWidth:1,borderRadius:12},
 quantity:{alignItems:"center",justifyContent:"center",gap:4},quantityValue:{fontFamily:"Estedad_700Bold",fontSize:14,color:"#2d2d2d",lineHeight:20},
 itemDetails:{flex:1,minWidth:0,gap:4,alignItems:"flex-end"},itemName:{width:"100%",fontFamily:"Estedad_700Bold",fontSize:14,color:"#2d2d2d",textAlign:"right",writingDirection:"rtl",lineHeight:22},itemMeta:{fontFamily:"Estedad_400Regular",fontSize:11,color:"#0f5b5a",textAlign:"right",writingDirection:"rtl"},
 productThumb:{width:60,height:60,borderRadius:6,backgroundColor:"#f7f3ed",alignItems:"center",justifyContent:"center"},thumbGlyph:{fontFamily:"Estedad_700Bold",fontSize:26,color:"#b5523b"},
 summary:{paddingHorizontal:16,paddingTop:16,gap:12},priceRow:{height:24,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},priceLabel:{fontFamily:"Estedad_400Regular",fontSize:14,color:"#7b746e",textAlign:"right",writingDirection:"rtl"},priceValue:{fontFamily:"Estedad_700Bold",fontSize:16,color:"#2d2d2d"},
 notice:{minHeight:54,padding:10,borderRadius:10,backgroundColor:"#e5f2f1",flexDirection:"row-reverse",alignItems:"center",gap:8},infoMark:{fontFamily:"Estedad_700Bold",fontSize:18,color:"#0f5b5a"},noticeText:{flex:1,fontFamily:"Estedad_400Regular",fontSize:10,color:"#0f5b5a",textAlign:"right",writingDirection:"rtl",lineHeight:15},
 footer:{padding:16,backgroundColor:"#fff",borderTopWidth:1,borderTopColor:"#e8ded3"},
 emptyState:{margin:16,minHeight:230,padding:20,borderRadius:12,borderWidth:1,borderColor:"#e8ded3",backgroundColor:"#fff",alignItems:"center",justifyContent:"center",gap:12},emptyTitle:{fontFamily:"Estedad_700Bold",fontSize:16,color:"#2d2d2d",textAlign:"center",writingDirection:"rtl"},emptyText:{margin:16,fontFamily:"Estedad_400Regular",fontSize:14,color:"#7b746e",textAlign:"center",writingDirection:"rtl"},inlineState:{margin:16,gap:12},body:{fontFamily:"Estedad_400Regular",fontSize:13,lineHeight:22,color:"#7b746e",textAlign:"right",writingDirection:"rtl"},feedback:{margin:16,fontFamily:"Estedad_400Regular",fontSize:12,color:"#0f5b5a",textAlign:"right",writingDirection:"rtl"}
});
