import {useEffect,useState} from "react";
import {Modal,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {colors} from "./theme";
import {
 EMPTY_PREVIEW_CATALOG_FILTERS,checkPreviewCatalogFilters,previewCatalogFilterCount,
 type PreviewCatalogFilters,
} from "./buyer-catalog-preview-filters.ts";
type Category={id:string;label:string};
export function BuyerCatalogFilterSheet({visible,preview,categories,selectedCategory,applied,onApply,onClose}:{
 visible:boolean;preview:boolean;categories:readonly Category[];selectedCategory:string|null;
 applied:PreviewCatalogFilters;onApply:(id:string|null,f:PreviewCatalogFilters)=>void;onClose:()=>void;
}){
 const [category,setCategory]=useState<string|null>(selectedCategory);
 const [draft,setDraft]=useState<PreviewCatalogFilters>(applied);
 const [error,setError]=useState("");
 useEffect(()=>{if(visible){setCategory(selectedCategory);setDraft(applied);setError("");}},[visible]);
 const clear=()=>{setCategory(null);setDraft(EMPTY_PREVIEW_CATALOG_FILTERS);setError("");};
 const submit=()=>{
  if(preview){const result=checkPreviewCatalogFilters(draft);if(!result.ok){setError(result.message);return;}}
  onApply(category,preview?draft:EMPTY_PREVIEW_CATALOG_FILTERS);
 };
 const option=(label:string,checked:boolean,click:()=>void,disabled=false)=><Pressable key={label}
  accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{checked,disabled}}
  onPress={click} disabled={disabled} style={s.option}>
  <Text style={[s.optionLabel,disabled&&s.disabled]}>{label}</Text>
  <View style={[s.check,checked&&s.checked]}><Text style={s.mark}>{checked?"✓":""}</Text></View>
 </Pressable>;
 const count=previewCatalogFilterCount(category,preview?draft:EMPTY_PREVIEW_CATALOG_FILTERS);
 return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
  <View style={s.overlay} testID="buyer-catalog-filter-sheet-842-6377">
   <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="بستن فیلترها"/>
   <View style={s.sheet}>
    <View style={s.handle}/>
    <View style={s.header}>
     <Pressable accessibilityRole="button" accessibilityLabel="بستن پنل فیلتر" onPress={onClose} style={s.close}><Text style={s.closeLabel}>×</Text></Pressable>
     <Text accessibilityRole="header" style={s.title}>فیلتر کالاها</Text>
    </View>
    <ScrollView style={s.scroll} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
     <View style={s.selected}>
      <Pressable accessibilityRole="button" accessibilityLabel="پاک کردن همه فیلترها" onPress={clear}>
       <Text style={s.clearText}>پاک‌کردن همه</Text>
      </Pressable>
      {count>0&&<Text style={s.clearText}>{count.toLocaleString("fa-IR")} فیلتر انتخاب‌شده</Text>}
     </View>
     <View style={s.rule}/><Text style={s.section}>دسته‌بندی</Text>
     {categories.length===0?<Text style={s.hint}>دسته‌بندی منتشرشده‌ای دریافت نشده است.</Text>:categories.map(c=>{
      const label=preview?({"لبنیات":"لبنیات محلی و تخم‌مرغ","خواربار":"روغن و خواربار","نوشیدنی":"نوشیدنی‌ها"} as Record<string,string>)[c.label]??c.label:c.label;
      return option(label,category===c.id,()=>setCategory(value=>value===c.id?null:c.id));
     })}
     <View style={s.rule}/><Text style={s.section}>بازهٔ قیمت</Text>
     <View style={s.prices}>
      <TextInput accessibilityLabel="حداکثر قیمت (تومان)" placeholder="تا ۵۰۰٬۰۰۰" style={s.input}
       placeholderTextColor="#706963" keyboardType="number-pad" editable={preview} textAlign="right"
       value={preview?draft.maxPrice:""} onChangeText={v=>{setDraft(f=>({...f,maxPrice:v}));setError("");}}/>
      <TextInput accessibilityLabel="حداقل قیمت (تومان)" placeholder="از ۱۰٬۰۰۰" style={s.input}
       placeholderTextColor="#706963" keyboardType="number-pad" editable={preview} textAlign="right"
       value={preview?draft.minPrice:""} onChangeText={v=>{setDraft(f=>({...f,minPrice:v}));setError("");}}/>
     </View>
     <View style={s.rule}/><Text style={s.section}>ویژگی‌ها</Text>
     {option("فقط کالاهای موجود",false,()=>{},true)}
     {option("تخفیف‌دار",preview&&draft.discounted,()=>setDraft(v=>({...v,discounted:!v.discounted})),!preview)}
     {option("قابل خرید با کالابرگ",preview&&draft.credit,()=>setDraft(v=>({...v,credit:!v.credit})),!preview)}
     <Text style={s.hint}>{preview?
      "فقط نمونه‌های نمایشی بررسی می‌شوند. موجودی و حق استفاده واقعی از کالابرگ تأیید نشده است.":
      "فقط دسته‌بندی‌های منتشرشده در کاتالوگ واقعی قابل فیلتر هستند؛ قیمت، موجودی و کالابرگ قرارداد API ندارند."}</Text>
     {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    </ScrollView>
    <View style={s.actions}>
     <Pressable accessibilityRole="button" accessibilityLabel="پاک کردن فیلترها" style={s.clearButton} onPress={clear}><Text style={s.clearButtonText}>پاک‌کردن</Text></Pressable>
     <Pressable accessibilityRole="button" accessibilityLabel="نمایش کالاها" style={s.applyButton} onPress={submit}><Text style={s.applyLabel}>نمایش کالاها</Text></Pressable>
    </View>
   </View>
  </View>
 </Modal>;
}
const s=StyleSheet.create({
 overlay:{flex:1,justifyContent:"flex-end"},
 backdrop:{...StyleSheet.absoluteFill,backgroundColor:"rgba(0,0,0,0.4)"},
 sheet:{height:"82%",minHeight:460,backgroundColor:colors.surface,borderTopLeftRadius:24,borderTopRightRadius:24,paddingHorizontal:20,paddingTop:10},
 handle:{height:4,width:44,backgroundColor:"#EAE6E1",borderRadius:99,alignSelf:"flex-end"},
 header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:16,marginBottom:12},
 close:{backgroundColor:"#FAF8F5",width:36,height:36,borderRadius:18,alignItems:"center",justifyContent:"center"},
 closeLabel:{fontSize:26,color:colors.charcoal},title:{fontSize:20,fontWeight:"800",color:"#1C3F3A",textAlign:"right"},
 scroll:{flex:1},body:{gap:11,paddingBottom:20},selected:{minHeight:34,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
 clearText:{fontSize:12,fontWeight:"700",color:colors.terracotta},rule:{height:1,backgroundColor:"#EAE6E1",marginVertical:4},
 section:{fontSize:14,fontWeight:"800",color:"#1C3F3A",textAlign:"right"},
 option:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",minHeight:32,gap:10},
 optionLabel:{flex:1,fontSize:13,color:"#1C3F3A",textAlign:"right"},disabled:{color:"#8E8E93"},
 check:{width:18,height:18,borderWidth:1.5,borderColor:"#EAE6E1",borderRadius:4,alignItems:"center",justifyContent:"center"},
 checked:{backgroundColor:colors.terracotta,borderColor:colors.terracotta},
 mark:{color:"#FFF",fontSize:13,fontWeight:"700",lineHeight:17},
 prices:{flexDirection:"row",gap:10},
 input:{flex:1,minWidth:0,height:42,borderWidth:1,borderColor:"#F0E7DD",backgroundColor:"#FAF8F5",borderRadius:8,paddingHorizontal:10,color:colors.charcoal,fontSize:12},
 hint:{color:"#706963",fontSize:11,textAlign:"right",lineHeight:20},
 error:{color:colors.error,fontSize:12,textAlign:"right"},
 actions:{flexDirection:"row",gap:10,paddingVertical:12,backgroundColor:colors.surface},
 clearButton:{width:112,height:48,borderWidth:1,borderColor:colors.terracotta,borderRadius:10,alignItems:"center",justifyContent:"center"},
 clearButtonText:{fontWeight:"700",color:colors.terracotta,fontSize:13},
 applyButton:{flex:1,height:48,backgroundColor:colors.terracotta,borderRadius:10,alignItems:"center",justifyContent:"center"},
 applyLabel:{fontWeight:"700",fontSize:13,color:colors.surface},
});
