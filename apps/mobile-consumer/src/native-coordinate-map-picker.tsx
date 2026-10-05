import { useEffect, useMemo, useState } from "react";
import {
  Image, Pressable, StyleSheet, Text, View,
  type GestureResponderEvent, type LayoutChangeEvent,
} from "react-native";
import {
  IRAN_MAP_OVERVIEW,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  MAP_TILE_SIZE,
  mapPointFromPixel,
  mapTiles,
  osmTileUrl,
  validMapPoint,
  type MapPoint,
} from "../../../packages/buyer-commerce/map-tiles.ts";
import { colors } from "./theme";

const height=280;

export function NativeCoordinateMapPicker({
  value,
  onChange,
  disabled=false,
}:{
  value:MapPoint|null;
  onChange:(point:MapPoint)=>void;
  disabled?:boolean;
}){
  const [open,setOpen]=useState(false);
  const [zoom,setZoom]=useState(6);
  const [width,setWidth]=useState(320);
  const [center,setCenter]=useState<MapPoint>(
    validMapPoint(value)?value:IRAN_MAP_OVERVIEW,
  );

  useEffect(()=>{
    if(validMapPoint(value))setCenter(value);
  },[value]);

  const tiles=useMemo(
    ()=>open?mapTiles(center,zoom,width,height,1):[],
    [center,open,width,zoom],
  );

  const layout=(event:LayoutChangeEvent)=>{
    const next=event.nativeEvent.layout.width;
    if(Number.isFinite(next)&&next>=240)setWidth(next);
  };

  const choose=(event:GestureResponderEvent)=>{
    if(disabled)return;
    const point=mapPointFromPixel(
      center,zoom,width,height,
      event.nativeEvent.locationX,event.nativeEvent.locationY,
    );
    const normalized={
      latitude:Number(point.latitude.toFixed(6)),
      longitude:Number(point.longitude.toFixed(6)),
    };
    setCenter(normalized);
    onChange(normalized);
  };

  if(!open)return <View style={styles.closed}>
    <Pressable accessibilityRole="button" accessibilityLabel="باز کردن نقشه"
      accessibilityState={{disabled}} disabled={disabled}
      onPress={()=>setOpen(true)} style={[styles.button,disabled&&styles.disabled]}>
      <Text style={styles.buttonText}>باز کردن نقشه</Text>
    </Pressable>
    <Text style={styles.help}>
      نقشه فقط پس از اقدام شما بارگیری می‌شود. انتخاب نقطه به معنی پوشش ارسال یا
      سرویس لجستیک نیست.
    </Text>
  </View>;

  return <View style={styles.root}>
    <View style={styles.toolbar}>
      <Pressable accessibilityRole="button" accessibilityLabel="بزرگ‌نمایی نقشه"
        accessibilityState={{disabled:disabled||zoom>=MAP_MAX_ZOOM}}
        disabled={disabled||zoom>=MAP_MAX_ZOOM}
        onPress={()=>setZoom(v=>Math.min(MAP_MAX_ZOOM,v+1))}
        style={[styles.toolButton,(disabled||zoom>=MAP_MAX_ZOOM)&&styles.disabled]}>
        <Text style={styles.toolText}>+</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="کوچک‌نمایی نقشه"
        accessibilityState={{disabled:disabled||zoom<=MAP_MIN_ZOOM}}
        disabled={disabled||zoom<=MAP_MIN_ZOOM}
        onPress={()=>setZoom(v=>Math.max(MAP_MIN_ZOOM,v-1))}
        style={[styles.toolButton,(disabled||zoom<=MAP_MIN_ZOOM)&&styles.disabled]}>
        <Text style={styles.toolText}>−</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="بستن نقشه"
        accessibilityState={{disabled}} disabled={disabled}
        onPress={()=>setOpen(false)}
        style={[styles.toolButton,disabled&&styles.disabled]}>
        <Text style={styles.closeText}>بستن</Text>
      </Pressable>
    </View>
    <Pressable accessibilityRole="button"
      accessibilityLabel="انتخاب موقعیت نشانی روی نقشه"
      accessibilityHint="با لمس نقشه، مختصات همان نقطه در فرم قرار می‌گیرد."
      accessibilityState={{disabled}}
      disabled={disabled}
      onLayout={layout} onPress={choose}
      style={[styles.viewport,{height}]}>
      {tiles.map(tile=><Image key={tile.key}
        source={{uri:osmTileUrl(tile)}} accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          position:"absolute",width:MAP_TILE_SIZE,height:MAP_TILE_SIZE,
          left:tile.left,top:tile.top,
        }}/>)}
      <View pointerEvents="none" style={styles.pin}>
        <Text style={styles.pinText}>⌖</Text>
      </View>
    </Pressable>
    <Text style={styles.coordinates}>
      {validMapPoint(value)
        ? `مختصات انتخاب‌شده: ${value.latitude.toFixed(6)}، ${value.longitude.toFixed(6)}`
        : "برای ثبت مختصات روی نقشه لمس کنید."}
    </Text>
    <Text style={styles.attribution}>© OpenStreetMap contributors</Text>
  </View>;
}

const styles=StyleSheet.create({
  root:{gap:8},
  closed:{gap:8},
  toolbar:{flexDirection:"row",justifyContent:"flex-start",gap:8},
  button:{
    minHeight:48,borderRadius:10,borderWidth:1,borderColor:colors.teal,
    alignItems:"center",justifyContent:"center",paddingHorizontal:14,
  },
  buttonText:{fontFamily:"Vazirmatn_700Bold",color:colors.teal,fontSize:14},
  toolButton:{
    minWidth:48,minHeight:42,borderRadius:9,borderWidth:1,
    borderColor:colors.beige,backgroundColor:colors.surface,
    alignItems:"center",justifyContent:"center",paddingHorizontal:10,
  },
  toolText:{fontFamily:"Vazirmatn_700Bold",color:colors.charcoal,fontSize:22},
  closeText:{fontFamily:"Vazirmatn_700Bold",color:colors.charcoal,fontSize:13},
  disabled:{opacity:.45},
  viewport:{
    position:"relative",overflow:"hidden",borderRadius:12,borderWidth:1,
    borderColor:colors.beige,backgroundColor:"#e9e3da",
  },
  pin:{
    position:"absolute",left:"50%",top:"50%",width:36,height:36,
    marginLeft:-18,marginTop:-18,alignItems:"center",justifyContent:"center",
    borderRadius:18,backgroundColor:colors.surface,
  },
  pinText:{fontSize:28,color:colors.terracotta},
  help:{
    fontFamily:"Vazirmatn_400Regular",fontSize:12,lineHeight:22,
    textAlign:"right",writingDirection:"rtl",color:colors.charcoal,
  },
  coordinates:{
    fontFamily:"Vazirmatn_400Regular",fontSize:12,lineHeight:22,
    textAlign:"right",writingDirection:"rtl",color:colors.charcoal,
  },
  attribution:{
    fontFamily:"Vazirmatn_400Regular",fontSize:10,textAlign:"left",
    writingDirection:"ltr",color:colors.charcoal,
  },
});
