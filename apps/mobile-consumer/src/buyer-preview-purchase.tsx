import { useState } from "react";
import { Image, Pressable, StyleSheet, Text as NativeText, type TextProps, type ImageSourcePropType, View } from "react-native";
import { colors } from "./theme";
import { FigmaIcon } from "./figma-icon";
import { previewPrices, previewCartTotal, previewCartCount, type PreviewCart, type PreviewProductKey } from "./preview-cart";
import { type PreviewAccountState } from "./buyer-preview-account";
export type PreviewPurchasePage="review"|"checkout"|"success"|"tracking";
export type PreviewPaymentMethod="ONLINE"|"SUPPORT"|"PERSONAL";
export const previewPaymentMethodLabels:Record<PreviewPaymentMethod,string>={
 ONLINE:"درگاه آنلاین بانکی",
 SUPPORT:"اعتبار حمایتی موجود",
 PERSONAL:"اعتبار شخصی تأمین‌شده توسط کاربر",
};
/** A visual choice in the Figma-only walkthrough, never a payment instruction. */
export type PreviewOrder={id:number;cart:PreviewCart;total:number;recipient:string;company:string|null;paymentMethod:PreviewPaymentMethod};
type Item={key:PreviewProductKey;name:string;image:ImageSourcePropType};
const fa=(n:number)=>n.toLocaleString("fa-IR");
const money=(n:number)=>fa(n)+" تومان";
function Text(props:TextProps){const w=StyleSheet.flatten(props.style)?.fontWeight;return <NativeText {...props} style={[{fontFamily:w==="700"||w==="800"?"Estedad_700Bold":"Estedad_400Regular"},props.style]}/>;}
function Card({children}:{children:React.ReactNode}){return <View style={s.card}>{children}</View>;}
function Action({title,onPress,secondary=false,disabled=false}:{title:string;onPress:()=>void;secondary?:boolean;disabled?:boolean}){return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={[s.button,secondary&&s.secondary,disabled&&s.disabled]}><Text style={[s.buttonText,secondary&&s.secondaryText]}>{title}</Text></Pressable>;}
function Row({label,value,strong=false}:{label:string;value:string;strong?:boolean}){return <View style={s.row}><Text style={strong?s.total:s.value}>{value}</Text><Text style={s.muted}>{label}</Text></View>;}
function PaymentChoice({method,detail,selected,disabled=false,onPress}:{method:PreviewPaymentMethod;detail:string;selected:boolean;disabled?:boolean;onPress:()=>void}){
 return <Pressable accessibilityRole="radio" accessibilityLabel={previewPaymentMethodLabels[method]} accessibilityState={{selected,disabled}} disabled={disabled} onPress={onPress} style={[s.paymentChoice,selected&&s.paymentSelected,disabled&&s.paymentDisabled]}>
  <View style={[s.paymentRadio,selected&&s.paymentRadioSelected]}>{selected&&<View style={s.paymentRadioDot}/>}</View>
  <View style={s.grow}><Text style={[s.methodTitle,selected&&s.methodTitleSelected]}>{previewPaymentMethodLabels[method]}</Text><Text style={s.muted}>{detail}</Text></View>
 </Pressable>;
}
export function BuyerPreviewPurchase({page,cart,items,account,orders,selectedOrder,legal,setLegal,onNavigate,onHome,onCatalog,onAccountEdit,onSelectOrder,onSubmit}:{page:PreviewPurchasePage|"orders";cart:PreviewCart;items:readonly Item[];account:PreviewAccountState;orders:PreviewOrder[];selectedOrder:number|null;legal:boolean;setLegal:(v:boolean)=>void;onNavigate:(page:PreviewPurchasePage|"cart"|"comparison"|"orders"|"support")=>void;onHome:()=>void;onCatalog:()=>void;onAccountEdit:(target:"company"|"addresses")=>void;onSelectOrder:(id:number)=>void;onSubmit:(paymentMethod:PreviewPaymentMethod)=>void}){
 const [orderFilter,setOrderFilter]=useState<"current"|"delivered"|"cancelled">("current");
 const [paymentMethod,setPaymentMethod]=useState<PreviewPaymentMethod>("ONLINE");
 const order=orders.find(o=>o.id===selectedOrder);
 const address=account.addresses.find(a=>a.id===account.defaultAddress);
 const total=previewCartTotal(cart),count=previewCartCount(cart);
 const summary=(amount:number,label="جمع فعلی کالاها:")=><Card><Row label="مجموع اقلام سبد:" value={money(amount)}/><Row label="هزینه ارسال:" value="تعیین نشده"/><View style={s.rule}/><Row label={label} value={money(amount)} strong/><Text style={s.muted}>مبالغ فقط برای تمرین طراحی هستند؛ قیمت قابل پرداخت واقعی نیستند.</Text></Card>;
 if(page==="review")return <><Card><Text style={s.muted}>فروشگاه انتخاب شده شما</Text><Text style={s.tealTitle}>فروشگاه نمونه ۱</Text><Text style={s.muted}>انتخاب صرفاً نمایشی؛ موجودی، فاصله و ارسال واقعی تأیید نشده‌اند.</Text></Card><Text style={s.title}>لیست اقلام سبد نمونه</Text>{items.filter(i=>(cart[i.key]??0)>0).map(item=><Card key={item.key}><View style={s.line}><Image source={item.image} resizeMode="cover" style={s.image}/><View style={s.grow}><Text style={s.title}>{item.name}</Text><Text style={s.muted}>تعداد: {fa(cart[item.key]??0)} · {money((cart[item.key]??0)*previewPrices[item.key])}</Text></View></View></Card>)}{count===0&&<Card><Text style={s.muted}>سبد نمونه خالی است.</Text></Card>}<Action title="بازگشت به مقایسه" secondary onPress={()=>onNavigate("comparison")}/>{summary(total,"قیمت حدودی نمونه:")}<Action title="ادامه ثبت سفارش" disabled={count===0} onPress={()=>onNavigate("checkout")}/></>;
 if(page==="checkout")return <>
  <Card><Text style={s.title}>آدرس و مشخصات تحویل‌گیرنده</Text>
   {address?<><Text style={s.value}>{address.city}، {address.district}، {address.street}</Text><Text style={s.muted}>تحویل‌گیرنده: {address.recipient} · شماره تماس: {address.phone.replace(/[0-9]/g,d=>"۰۱۲۳۴۵۶۷۸۹"[Number(d)])}</Text></>:
    <View style={s.info}><Text style={s.tealTitle}>آدرس نمونه — فقط برای نمایش طراحی</Text><Text style={s.muted}>در این پیش‌نمایش، برای دیدن ادامه مراحل نیازی به واردکردن نشانی یا شماره واقعی نیست. هیچ تحویلی انجام نمی‌شود.</Text></View>}
   <Action title={address?"تغییر آدرس نمونه":"افزودن آدرس نمونه (اختیاری)"} secondary onPress={()=>onAccountEdit("addresses")}/>
  </Card>
  <Card><Text style={s.title}>شیوه و زمان ارسال</Text><View style={s.info}><Text style={s.tealTitle}>فروشنده انتخاب‌شده: فروشگاه نمونه ۱</Text></View><Text style={s.muted}>ارسال و زمان تحویل واقعی در این تمرین تعیین نمی‌شود.</Text></Card>
  <Card><Text style={s.title}>روش پرداخت</Text>
   <PaymentChoice method="ONLINE" selected={paymentMethod==="ONLINE"} onPress={()=>setPaymentMethod("ONLINE")} detail="پرداخت امن با کارت‌های شتاب در طراحی؛ در این نسخه هیچ درگاه بانکی متصل نیست."/>
   <PaymentChoice method="SUPPORT" selected={paymentMethod==="SUPPORT"} disabled={legal} onPress={()=>setPaymentMethod("SUPPORT")} detail={legal?"اعتبار حمایتی برای خرید حقوقی قابل انتخاب نیست.":"امکان و مانده اعتبار حمایتی فقط پس از استعلام و مجوز واقعی مشخص می‌شود."}/>
   <PaymentChoice method="PERSONAL" selected={paymentMethod==="PERSONAL"} onPress={()=>setPaymentMethod("PERSONAL")} detail="اعتبار شخصی به مانده معتبر حساب نیاز دارد؛ در نسخه نمایشی هیچ اعتباری برداشت نمی‌شود."/>
   <Pressable accessibilityRole="checkbox" accessibilityLabel="خرید حقوقی و دریافت فاکتور رسمی" accessibilityState={{checked:legal}} onPress={()=>{setLegal(!legal);if(!legal&&paymentMethod==="SUPPORT")setPaymentMethod("ONLINE");}} style={s.legalChoice}>
    <View style={[s.toggle,legal&&s.toggleOn]}><View style={[s.knob,legal&&s.knobOn]}/></View>
    <View style={s.grow}><Text style={s.title}>خرید حقوقی و دریافت فاکتور رسمی</Text><Text style={s.muted}>صدور فاکتور واقعی منوط به اطلاعات و تأیید شرکت در سامانه عملیاتی است.</Text></View>
   </Pressable>
   {legal&&(account.company?<><View style={s.info}><Text style={s.tealTitle}>اطلاعات خریدار حقوقی نمونه</Text><Text style={s.value}>نام شرکت: {account.company.name}</Text></View><Action title="ویرایش اطلاعات شرکت" secondary onPress={()=>onAccountEdit("company")}/></>:
    <View style={s.warning}><Text style={s.muted}>اطلاعات شرکت ثبت نشده است. می‌توانید نتیجه تمرین را ببینید، اما فاکتور رسمی صادر نمی‌شود.</Text><Action title="ثبت اطلاعات شرکت نمونه" secondary onPress={()=>onAccountEdit("company")}/></View>)}
   <Text style={s.muted}>انتخاب روش پرداخت فقط نحوه نمایش مراحل را تغییر می‌دهد؛ هیچ پرداخت، افزایش اعتبار یا برداشت وجه انجام نمی‌شود.</Text>
  </Card>
  {summary(total,legal?"جمع نمونه خرید حقوقی:":"جمع فعلی کالاها:")}
  {count===0?<View style={s.warning}><Text style={s.muted}>برای دیدن نتیجه سفارش نمونه، ابتدا یک کالا به سبد آزمایشی اضافه کنید.</Text><Action title="بازگشت به کاتالوگ" secondary onPress={onCatalog}/></View>:
    <View style={s.info}><Text style={s.muted}>با ادامه، فقط صفحه نتیجه و پیگیری نمونه نمایش داده می‌شود. سفارش، فاکتور، پرداخت و ارسال واقعی ثبت نمی‌شود.</Text></View>}
  <Action title="مشاهده نتیجه سفارش نمونه (بدون پرداخت)" disabled={count===0} onPress={()=>onSubmit(paymentMethod)}/>
 </>;
 if(page==="success"&&order)return <><View style={s.successBadge}><Text style={s.successMark}>✓</Text></View><Text style={s.successTitle}>سفارش نمونه در تمرین ثبت شد.</Text><Text style={s.centerMuted}>کد تمرین: {fa(order.id)} · سفارش واقعی نیست</Text><Card><Text style={s.title}>خلاصه سفارش</Text><Row label="فروشگاه تأمین‌کننده:" value="فروشگاه نمونه ۱"/><Row label="تحویل‌گیرنده:" value={order.recipient}/><Row label="مبلغ نمونه:" value={money(order.total)}/><Row label="روش انتخاب‌شده در پیش‌نمایش:" value={previewPaymentMethodLabels[order.paymentMethod]}/><Row label="وضعیت پرداخت:" value="پرداخت نشده؛ تمرین"/></Card><View style={s.info}><Text style={s.tealTitle}>هیچ سفارش یا پرداخت واقعی ثبت نشد.</Text><Text style={s.muted}>این رکورد فقط در حافظه همین نشست آزمایشی است.</Text></View><Action title="پیگیری سفارش نمونه" onPress={()=>onNavigate("tracking")}/><Action title="بازگشت به بازارگاه" secondary onPress={onHome}/></>;
 if(page==="tracking"&&order)return <><Card><Text style={s.title}>سفارش نمونه محله</Text><Row label="فروشنده منتخب:" value="فروشگاه نمونه ۱"/><Row label="خلاصه اقلام:" value={fa(previewCartCount(order.cart))+" کالا · "+money(order.total)}/>{order.company&&<Row label="خرید حقوقی نمونه:" value={order.company}/>}</Card><Card>{[["تحویل سفارش","تأیید نشده"],["در حال ارسال","تأیید نشده"],["آماده‌سازی سفارش","تأیید نشده"],["ثبت سفارش","فقط تمرین ثبت شده"]].map(([title,note],i)=><View key={title} style={s.timeline}><View style={[s.dot,i===3&&s.dotActive]}/><View style={s.grow}><Text style={s.title}>{title}</Text><Text style={s.muted}>{note}</Text></View></View>)}</Card><View style={s.info}><Text style={s.tealTitle}>نیاز به راهنمایی دارید؟</Text><Action title="پشتیبانی حنا" onPress={()=>onNavigate("support")}/></View></>;
 if(page==="orders")return <><View style={s.filters}>{([["لغوشده","cancelled"],["تحویل‌شده","delivered"],["جاری","current"]] as const).map(([label,key])=><Pressable accessibilityRole="button" accessibilityState={{selected:orderFilter===key}} key={key} onPress={()=>setOrderFilter(key)} style={[s.chip,orderFilter===key&&s.chipActive]}><Text style={[s.value,orderFilter===key&&s.chipText]}>{label}</Text></Pressable>)}</View>{orderFilter!=="current"||orders.length===0?<><Card><Text style={s.title}>سفارش واقعی ثبت نشده است</Text><Text style={s.muted}>در این وضعیت سفارش نمونه‌ای برای نمایش وجود ندارد.</Text></Card><Action title="مشاهده محصولات بازار" onPress={onCatalog}/></>:orders.slice().reverse().map(o=><Card key={o.id}><Text style={s.title}>{o.company?"خرید حقوقی نمونه":"خرید شخصی نمونه"}</Text><Text style={s.muted}>ثبت تمرینی · کد {fa(o.id)}</Text><Row label="فروشگاه:" value="فروشگاه نمونه ۱"/><Text style={s.muted}>محصولات: {items.filter(i=>(o.cart[i.key]??0)>0).map(i=>i.name).join("، ")}</Text><Row label="مبلغ نمونه:" value={money(o.total)} strong/><Action title="مشاهده جزئیات" secondary onPress={()=>onSelectOrder(o.id)}/></Card>)}</>;
 return <><Card><Text style={s.title}>سفارش نمونه‌ای برای نمایش نیست</Text></Card><Action title="بازگشت به بازارگاه" onPress={onHome}/></>;
}
const rtl={textAlign:"right",writingDirection:"rtl"} as const;
const s=StyleSheet.create({
 card:{backgroundColor:colors.surface,borderWidth:1,borderColor:"#F0E7DD",borderRadius:16,padding:14,gap:12},title:{fontSize:15,fontWeight:"700",color:colors.charcoal,...rtl},tealTitle:{fontSize:15,fontWeight:"700",color:colors.teal,...rtl},muted:{fontSize:12,color:"#8E8E93",lineHeight:20,...rtl},value:{fontSize:13,color:colors.charcoal,...rtl},total:{fontSize:17,color:colors.terracotta,fontWeight:"700",...rtl},row:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:8},rule:{height:1,backgroundColor:"#F0E7DD"},button:{backgroundColor:colors.teal,borderRadius:12,padding:14,alignItems:"center",minHeight:48,justifyContent:"center"},buttonText:{fontSize:14,fontWeight:"700",color:colors.surface,textAlign:"center"},secondary:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.teal},secondaryText:{color:colors.teal},disabled:{opacity:0.45},line:{flexDirection:"row-reverse",alignItems:"center",gap:12},image:{width:56,height:56,borderRadius:10},grow:{flex:1,minWidth:0,gap:4},info:{backgroundColor:colors.paleTeal,borderRadius:12,padding:12,gap:8},warning:{backgroundColor:colors.errorSurface,borderWidth:1,borderColor:colors.terracotta,borderRadius:12,padding:12,gap:8},warningText:{color:colors.error,fontSize:12,...rtl},toggle:{width:42,height:24,borderRadius:12,backgroundColor:"#DDD6CE",padding:3,alignItems:"flex-start"},toggleOn:{backgroundColor:colors.teal,alignItems:"flex-end"},knob:{width:18,height:18,borderRadius:9,backgroundColor:colors.surface},knobOn:{backgroundColor:colors.surface},successBadge:{alignSelf:"center",width:72,height:72,borderRadius:36,alignItems:"center",justifyContent:"center",backgroundColor:colors.paleTeal,marginTop:20},successMark:{fontSize:32,color:colors.teal,fontWeight:"700"},successTitle:{fontSize:20,color:colors.teal,fontWeight:"800",textAlign:"center"},centerMuted:{textAlign:"center",color:"#8E8E93",fontSize:12},timeline:{flexDirection:"row-reverse",alignItems:"flex-start",gap:14,minHeight:65},dot:{width:14,height:14,borderRadius:7,borderWidth:1,borderColor:"#D7B895",backgroundColor:"#F7F3ED",marginTop:5},dotActive:{backgroundColor:colors.teal,borderColor:colors.teal},paymentChoice:{flexDirection:"row",alignItems:"center",gap:12,padding:12,borderRadius:12,borderWidth:1,borderColor:"#F0E7DD",backgroundColor:"#FAF8F5",minHeight:72},
 paymentSelected:{borderColor:colors.teal,backgroundColor:colors.paleTeal},
 paymentDisabled:{opacity:.55},
 paymentRadio:{height:18,width:18,borderRadius:9,borderWidth:1,borderColor:"#A9A19A",alignItems:"center",justifyContent:"center"},
 paymentRadioSelected:{borderColor:colors.teal},
 paymentRadioDot:{height:10,width:10,borderRadius:5,backgroundColor:colors.teal},
 methodTitle:{fontSize:13,fontWeight:"700",color:colors.charcoal,...rtl},
 methodTitleSelected:{color:colors.teal},
 legalChoice:{flexDirection:"row",alignItems:"center",gap:12,borderWidth:1,borderColor:"#F0E7DD",borderRadius:12,padding:12,backgroundColor:"#FAF8F5"},
 filters:{flexDirection:"row",gap:8},chip:{flex:1,backgroundColor:colors.surface,borderWidth:1,borderColor:"#F0E7DD",borderRadius:24,paddingVertical:10,alignItems:"center"},chipActive:{backgroundColor:colors.teal},chipText:{color:colors.surface}
});
