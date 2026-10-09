import * as Crypto from "expo-crypto";
import { useEffect, useState } from "react";
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { MobileCommerceClient } from "./mobile-commerce.ts";
import { pendingCommerceStore } from "./native-pending-commerce.ts";
import {
  NativeBuyerSupportController,
  initialNativeBuyerSupportState,
  type NativeBuyerSupportState,
} from "./buyer-support-controller.ts";
import { colors } from "./theme";

const labels:Record<string,string>={
  SELLER_ORDER_STATE:"وضعیت سفارش شما تغییر کرد.",
  REPLY_TICKET:"پشتیبانی به تیکت شما پاسخ داد.",
  DECIDE_INCIDENT:"نتیجه بررسی گزارش مشکل شما ثبت شد.",
  VERIFY_UNAVAILABILITY:"نتیجه بررسی مراجعه مرجوعی ثبت شد.",
};

export function BuyerSupportScreen({
  api,onBack,onLogin,
}:{
  api:MobileCommerceClient;
  onBack:()=>void;
  onLogin:()=>void;
}){
  const [state,setState]=useState<NativeBuyerSupportState>(
    initialNativeBuyerSupportState);
  const [controller]=useState(()=>new NativeBuyerSupportController(
    api,Crypto.randomUUID,setState,pendingCommerceStore));

  useEffect(()=>{
    controller.start();
    return()=>controller.stop();
  },[controller]);

  const signedOut=state.error?.status===401;
  return(
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled">
        <View style={styles.top}>
          <Pressable accessibilityRole="button"
            accessibilityLabel="بازگشت"
            onPress={onBack} style={styles.linkButton}>
            <Text style={styles.link}>بازگشت</Text>
          </Pressable>
          <Text style={styles.title} accessibilityRole="header">
            اعلان‌ها و پشتیبانی
          </Text>
        </View>

        {state.message?(
          <Text accessibilityRole="alert" style={styles.notice}>
            {state.message}
          </Text>
        ):null}

        {signedOut?(
          <View style={styles.card}>
            <Text style={styles.text}>
              برای دیدن اطلاعات خصوصی حساب ابتدا وارد حنا شوید.
            </Text>
            <Pressable accessibilityRole="button"
              accessibilityLabel="ورود به حنا"
              onPress={onLogin} style={styles.primary}>
              <Text style={styles.primaryText}>ورود به حنا</Text>
            </Pressable>
          </View>
        ):(
          <>
            {state.intent&&(
              <View style={styles.pending}>
                <Text style={styles.cardTitle}>یک درخواست حل‌نشده دارید</Text>
                <Text style={styles.text}>
                  تا تعیین نتیجه، درخواست دیگری ارسال نمی‌شود.
                </Text>
                <Pressable accessibilityRole="button"
                  accessibilityLabel="تکرار امن همان درخواست"
                  disabled={state.busy}
                  onPress={()=>void controller.retry()}
                  style={[styles.primary,state.busy&&styles.disabled]}>
                  <Text style={styles.primaryText}>
                    {state.busy?"در حال بررسی…":"تکرار امن همان درخواست"}
                  </Text>
                </Pressable>
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.cardTitle} accessibilityRole="header">
                اعلان‌های من
              </Text>
              {state.busy&&state.notifications===null?(
                <Text style={styles.muted}>در حال دریافت اعلان‌ها…</Text>
              ):state.notifications?.length===0?(
                <Text style={styles.muted}>اعلانی ندارید.</Text>
              ):state.notifications?.map(item=>(
                <View key={item.id}
                  style={[styles.notification,!item.read&&styles.unread]}>
                  <View style={styles.flex}>
                    <Text style={styles.text}>
                      {labels[item.code]??"رویداد تازه‌ای در حساب شما ثبت شد."}
                    </Text>
                    <Text style={styles.meta}>
                      {new Date(item.createdAtUtc).toLocaleString("fa-IR")}
                    </Text>
                  </View>
                  {!item.read&&(
                    <Pressable accessibilityRole="button"
                      accessibilityLabel="خوانده شد"
                      disabled={state.busy||state.intent!==null}
                      onPress={()=>void controller.markRead(item.id)}
                      style={styles.outline}>
                      <Text style={styles.outlineText}>خوانده شد</Text>
                    </Pressable>
                  )}
                </View>
              ))}
              <View style={styles.pager}>
                <Pressable accessibilityRole="button"
                  accessibilityLabel="صفحه قبل اعلان‌ها"
                  disabled={state.notificationPage===1||state.busy||
                    state.intent!==null}
                  onPress={()=>void controller.notificationPage(-1)}
                  style={styles.outline}>
                  <Text style={styles.outlineText}>قبل</Text>
                </Pressable>
                <Text style={styles.meta}>
                  صفحه {state.notificationPage.toLocaleString("fa-IR")}
                </Text>
                <Pressable accessibilityRole="button"
                  accessibilityLabel="صفحه بعد اعلان‌ها"
                  disabled={!state.notifications||
                    state.notifications.length<20||state.busy||
                    state.intent!==null}
                  onPress={()=>void controller.notificationPage(1)}
                  style={styles.outline}>
                  <Text style={styles.outlineText}>بعد</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle} accessibilityRole="header">
                تماس با پشتیبانی
              </Text>
              <TextInput accessibilityLabel="عنوان تیکت"
                style={styles.input}
                maxLength={120}
                editable={!state.busy&&!state.intent}
                value={state.draft.subject}
                onChangeText={value=>controller.edit({subject:value})}
                placeholder="موضوع درخواست"
                placeholderTextColor={colors.muted}
                textAlign="right"/>
              <TextInput accessibilityLabel="شرح تیکت"
                style={[styles.input,styles.textarea]}
                maxLength={2000}
                multiline
                editable={!state.busy&&!state.intent}
                value={state.draft.message}
                onChangeText={value=>controller.edit({message:value})}
                placeholder="مسئله را برای پشتیبانی توضیح دهید."
                placeholderTextColor={colors.muted}
                textAlign="right"/>
              <Pressable accessibilityRole="button"
                accessibilityLabel="ثبت تیکت"
                disabled={!controller.canOpenTicket()}
                onPress={()=>void controller.openTicket()}
                style={[styles.primary,!controller.canOpenTicket()&&styles.disabled]}>
                <Text style={styles.primaryText}>ثبت تیکت</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle} accessibilityRole="header">
                تیکت‌های من
              </Text>
              {state.busy&&state.tickets===null?(
                <Text style={styles.muted}>در حال دریافت تیکت‌ها…</Text>
              ):state.tickets?.length===0?(
                <Text style={styles.muted}>تیکتی ثبت نشده است.</Text>
              ):state.tickets?.map(item=>(
                <View key={item.id} style={styles.ticket}>
                  <Text style={styles.cardTitle}>{item.subject}</Text>
                  <Text style={styles.meta}>
                    {item.state==="ANSWERED"?"پاسخ داده شده":"باز"}
                  </Text>
                  <Text style={styles.text}>{item.message}</Text>
                  {item.reply?(
                    <View style={styles.reply}>
                      <Text style={styles.replyTitle}>پاسخ پشتیبانی</Text>
                      <Text style={styles.text}>{item.reply}</Text>
                    </View>
                  ):null}
                </View>
              ))}
              <View style={styles.pager}>
                <Pressable accessibilityRole="button"
                  accessibilityLabel="صفحه قبل تیکت‌ها"
                  disabled={state.ticketPage===1||state.busy||
                    state.intent!==null}
                  onPress={()=>void controller.ticketPage(-1)}
                  style={styles.outline}>
                  <Text style={styles.outlineText}>قبل</Text>
                </Pressable>
                <Text style={styles.meta}>
                  صفحه {state.ticketPage.toLocaleString("fa-IR")}
                </Text>
                <Pressable accessibilityRole="button"
                  accessibilityLabel="صفحه بعد تیکت‌ها"
                  disabled={!state.tickets||state.tickets.length<20||
                    state.busy||state.intent!==null}
                  onPress={()=>void controller.ticketPage(1)}
                  style={styles.outline}>
                  <Text style={styles.outlineText}>بعد</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const rtl={textAlign:"right",writingDirection:"rtl"} as const;
const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.cream},
  body:{width:"100%",maxWidth:560,alignSelf:"center",padding:20,gap:14},
  top:{flexDirection:"row-reverse",alignItems:"center",
    justifyContent:"space-between",gap:12},
  title:{fontSize:24,fontWeight:"700",color:colors.teal,...rtl},
  linkButton:{minHeight:44,justifyContent:"center",paddingHorizontal:8},
  link:{color:colors.teal,fontWeight:"700",...rtl},
  card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.beige,
    borderRadius:14,padding:16,gap:12},
  pending:{backgroundColor:colors.paleTeal,borderRadius:14,padding:16,gap:8},
  cardTitle:{fontSize:17,fontWeight:"700",color:colors.teal,...rtl},
  text:{fontSize:14,lineHeight:24,color:colors.charcoal,...rtl},
  muted:{fontSize:14,lineHeight:24,color:colors.muted,...rtl},
  meta:{fontSize:12,color:colors.muted,...rtl},
  notice:{fontSize:13,lineHeight:23,color:colors.teal,
    backgroundColor:colors.paleTeal,padding:12,borderRadius:10,...rtl},
  notification:{flexDirection:"row-reverse",alignItems:"center",gap:10,
    borderWidth:1,borderColor:colors.beige,borderRadius:10,padding:12},
  unread:{backgroundColor:colors.paleTeal},
  flex:{flex:1,gap:4},
  input:{minHeight:50,borderWidth:1,borderColor:colors.beige,
    borderRadius:10,paddingHorizontal:12,color:colors.charcoal,
    backgroundColor:colors.surface},
  textarea:{minHeight:120,textAlignVertical:"top",paddingTop:12},
  primary:{minHeight:48,borderRadius:10,backgroundColor:colors.terracotta,
    justifyContent:"center",alignItems:"center",paddingHorizontal:14},
  primaryText:{color:colors.surface,fontWeight:"700"},
  disabled:{opacity:.45},
  outline:{minHeight:40,borderWidth:1,borderColor:colors.teal,
    borderRadius:9,justifyContent:"center",alignItems:"center",
    paddingHorizontal:10},
  outlineText:{color:colors.teal,fontWeight:"700"},
  pager:{flexDirection:"row-reverse",alignItems:"center",
    justifyContent:"space-between",gap:10,marginTop:4},
  ticket:{borderWidth:1,borderColor:colors.beige,borderRadius:10,
    padding:12,gap:7},
  reply:{backgroundColor:colors.paleTeal,borderRadius:9,padding:10,gap:4},
  replyTitle:{color:colors.teal,fontWeight:"700",...rtl},
});
