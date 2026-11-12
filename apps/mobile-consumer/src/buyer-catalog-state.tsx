import {Pressable,StyleSheet,Text,View} from "react-native";
import {colors} from "./theme";
type Kind="loading"|"empty"|"no-results"|"error";
const data:Record<Kind,{symbol:string;title:string;body:string;action?:string}>={
 loading:{symbol:"",title:"در حال دریافت کالاها",body:"اطلاعات کاتالوگ در حال بارگذاری است."},
 empty:{symbol:"📦",title:"هنوز کالایی منتشر نشده است",body:"پس از انتشار کالا در کاتالوگ، اینجا نمایش داده می‌شود."},
 "no-results":{symbol:"🔍",title:"نتیجه‌ای پیدا نشد",body:"کالایی با جست‌وجو و فیلتر انتخاب‌شده پیدا نشد.",action:"پاک‌کردن جست‌وجو و فیلترها"},
 error:{symbol:"⚡",title:"خطا در دریافت کالاها",body:"پاسخ معتبر از کاتالوگ دریافت نشد. داده قدیمی به‌جای نتیجه جدید نمایش داده نمی‌شود.",action:"تلاش دوباره"},
};
export function BuyerCatalogState({kind,onAction}:{kind:Kind;onAction?:()=>void}){
 const d=data[kind];
 if(kind==="loading")return <View style={s.loading} testID="buyer-catalog-state-loading">
  <Text style={s.title}>{d.title}</Text>
  {[0,1].map(n=><View key={n} style={s.skeletonRow}><View style={s.skeleton}/><View style={s.skeleton}/></View>)}
  <Text style={s.body}>{d.body}</Text>
 </View>;
 return <View style={s.card} testID={`buyer-catalog-state-${kind}`}>
  <View style={s.iconWrap}><Text style={s.symbol}>{d.symbol}</Text></View>
  <Text accessibilityRole="header" style={s.title}>{d.title}</Text>
  <Text style={s.body}>{d.body}</Text>
  {!!d.action&&onAction&&<Pressable accessibilityRole="button" accessibilityLabel={d.action} onPress={onAction} style={s.action}><Text style={s.actionText}>{d.action}</Text></Pressable>}
 </View>;
}
const s=StyleSheet.create({
 card:{marginHorizontal:20,marginTop:20,marginBottom:18,backgroundColor:colors.surface,borderWidth:1,borderColor:"#F0E7DD",borderRadius:20,minHeight:245,padding:24,gap:12,alignItems:"center",justifyContent:"center"},
 iconWrap:{width:64,height:64,borderRadius:32,backgroundColor:colors.cream,alignItems:"center",justifyContent:"center"},
 symbol:{fontSize:28},title:{color:colors.charcoal,fontSize:16,fontWeight:"800",textAlign:"center"},
 body:{fontSize:13,color:"#8E8E93",textAlign:"center",lineHeight:23},
 action:{width:"100%",minHeight:50,padding:14,borderRadius:12,backgroundColor:colors.teal,alignItems:"center",marginTop:8},
 actionText:{color:colors.surface,fontSize:14,fontWeight:"700"},
 loading:{marginHorizontal:20,marginTop:16,padding:20,backgroundColor:colors.surface,borderWidth:1,borderColor:"#F0E7DD",borderRadius:20,gap:14},
 skeletonRow:{flexDirection:"row-reverse",gap:14},skeleton:{flex:1,height:160,borderRadius:16,backgroundColor:"#F2EFEB"},
});
