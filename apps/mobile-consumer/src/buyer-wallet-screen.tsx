import * as Crypto from "expo-crypto";
import { useEffect, useState } from "react";
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { MobileCommerceClient } from "./mobile-commerce.ts";
import { pendingCommerceStore } from "./native-pending-commerce.ts";
import {
  NativeWalletController,
  initialNativeWalletState,
  type NativeWalletState,
} from "./buyer-wallet-controller.ts";
import { colors } from "./theme";

const rial=(value:number)=>
  new Intl.NumberFormat("fa-IR").format(value)+" ریال";

export function BuyerWalletScreen({
  api,onBack,onLogin,
}:{
  api:MobileCommerceClient;
  onBack:()=>void;
  onLogin:()=>void;
}){
  const [state,setState]=useState<NativeWalletState>(
    initialNativeWalletState);
  const [controller]=useState(()=>new NativeWalletController(
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
            کیف پول و برداشت
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
              برای دیدن کیف پول و درخواست برداشت ابتدا وارد حنا شوید.
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
                <Text style={styles.cardTitle}>
                  یک عملیات مالی حل‌نشده دارید
                </Text>
                <Text style={styles.text}>
                  تا تعیین نتیجه، برداشت دیگری ارسال نمی‌شود.
                </Text>
                <Pressable accessibilityRole="button"
                  accessibilityLabel="تکرار امن همان درخواست برداشت"
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
                موجودی نقدی
              </Text>
              {state.wallet?(
                <Text style={styles.balance}>
                  {rial(state.wallet.balanceRial)}
                </Text>
              ):(
                <Text style={styles.muted}>در حال دریافت موجودی…</Text>
              )}

              <Text style={styles.cardTitle}>درخواست برداشت</Text>
              <TextInput accessibilityLabel="مبلغ برداشت"
                style={styles.input}
                keyboardType="number-pad"
                maxLength={15}
                editable={!state.busy&&!state.intent}
                value={state.draft.amountRial}
                onChangeText={value=>controller.edit({amountRial:value})}
                placeholder="مبلغ، ریال"
                placeholderTextColor={colors.muted}
                textAlign="right"/>
              <TextInput
                accessibilityLabel="مرجع درخواست تأیید مالکیت شبا"
                style={styles.input}
                maxLength={240}
                editable={!state.busy&&!state.intent}
                value={state.draft.ibanVerificationRequestReference}
                onChangeText={value=>controller.edit({
                  ibanVerificationRequestReference:value,
                })}
                placeholder="مرجع قابل پیگیری تأیید مالکیت"
                placeholderTextColor={colors.muted}
                textAlign="right"/>
              <Text style={styles.boundary}>
                مبلغ پس از ثبت در hold قرار می‌گیرد. تأیید مالکیت شبا و
                انتقال بانکی در این نسخه متصل نشده و موفق نمایش داده نمی‌شود.
              </Text>
              <Pressable accessibilityRole="button"
                accessibilityLabel="ثبت درخواست برداشت"
                disabled={!controller.canRequest()}
                onPress={()=>void controller.request()}
                style={[styles.primary,
                  !controller.canRequest()&&styles.disabled]}>
                <Text style={styles.primaryText}>ثبت درخواست برداشت</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle} accessibilityRole="header">
                سابقه برداشت
              </Text>
              {state.withdrawals===null?(
                <Text style={styles.muted}>در حال دریافت درخواست‌ها…</Text>
              ):state.withdrawals.length===0?(
                <Text style={styles.muted}>درخواست برداشتی ندارید.</Text>
              ):state.withdrawals.map(item=>(
                <View key={item.id} style={styles.withdrawal}>
                  <Text style={styles.amount}>{rial(item.amountRial)}</Text>
                  <Text style={styles.text}>
                    {item.state==="OWNERSHIP_VERIFICATION_PENDING"
                      ?"در انتظار تأیید مالکیت شبا"
                      :"لغوشده"}
                  </Text>
                  <Text style={styles.meta}>
                    سررسید: {new Date(item.dueAtUtc)
                      .toLocaleString("fa-IR")}
                    {item.slaEscalated?" · نیازمند پیگیری SLA":""}
                  </Text>
                  {item.state==="OWNERSHIP_VERIFICATION_PENDING"&&(
                    <Pressable accessibilityRole="button"
                      accessibilityLabel="لغو درخواست برداشت"
                      disabled={state.busy||state.intent!==null}
                      onPress={()=>void controller.cancel(item.id)}
                      style={styles.outline}>
                      <Text style={styles.outlineText}>
                        لغو و بازگشت مبلغ به کیف پول
                      </Text>
                    </Pressable>
                  )}
                </View>
              ))}
              <View style={styles.pager}>
                <Pressable accessibilityRole="button"
                  accessibilityLabel="صفحه قبل برداشت‌ها"
                  disabled={state.page===1||state.busy||
                    state.intent!==null}
                  onPress={()=>void controller.page(-1)}
                  style={styles.outline}>
                  <Text style={styles.outlineText}>قبل</Text>
                </Pressable>
                <Text style={styles.meta}>
                  صفحه {state.page.toLocaleString("fa-IR")}
                </Text>
                <Pressable accessibilityRole="button"
                  accessibilityLabel="صفحه بعد برداشت‌ها"
                  disabled={!state.withdrawals||
                    state.withdrawals.length<20||state.busy||
                    state.intent!==null}
                  onPress={()=>void controller.page(1)}
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
  balance:{fontSize:28,fontWeight:"700",color:colors.teal,...rtl},
  text:{fontSize:14,lineHeight:24,color:colors.charcoal,...rtl},
  muted:{fontSize:14,lineHeight:24,color:colors.muted,...rtl},
  meta:{fontSize:12,lineHeight:21,color:colors.muted,...rtl},
  notice:{fontSize:13,lineHeight:23,color:colors.teal,
    backgroundColor:colors.paleTeal,padding:12,borderRadius:10,...rtl},
  input:{minHeight:50,borderWidth:1,borderColor:colors.beige,
    borderRadius:10,paddingHorizontal:12,color:colors.charcoal,
    backgroundColor:colors.surface},
  boundary:{fontSize:12,lineHeight:22,color:colors.muted,...rtl},
  primary:{minHeight:48,borderRadius:10,backgroundColor:colors.terracotta,
    justifyContent:"center",alignItems:"center",paddingHorizontal:14},
  primaryText:{color:colors.surface,fontWeight:"700"},
  disabled:{opacity:.45},
  withdrawal:{borderWidth:1,borderColor:colors.beige,borderRadius:10,
    padding:12,gap:6},
  amount:{fontSize:18,fontWeight:"700",color:colors.teal,...rtl},
  outline:{minHeight:42,borderWidth:1,borderColor:colors.teal,
    borderRadius:9,justifyContent:"center",alignItems:"center",
    paddingHorizontal:10},
  outlineText:{color:colors.teal,fontWeight:"700",...rtl},
  pager:{flexDirection:"row-reverse",alignItems:"center",
    justifyContent:"space-between",gap:10},
});
