import assert from "node:assert/strict";
import test from "node:test";
import {
  parseExternalIntegrationStatus,
} from "../apps/web-marketplace/lib/external-integration-status.ts";

test("external integration readiness is bounded and internally consistent",()=>{
  const parsed=parseExternalIntegrationStatus({
    sms:{configured:false,requiredForPublicSignIn:true,secret:"x"},
    sellerIdentity:{configured:true,
      requiredForNaturalSellerVerification:true,provider:"x"},
    payment:{configured:false,requiredForExternalPayment:true},
    ibanOwnership:{configured:false,requiredForWithdrawalOwnership:true},
    logistics:{configured:false,requiredForDelivery:true},
    allExternalReady:false,
    extra:"hidden",
  });
  assert.deepEqual(parsed,{
    sms:{configured:false,requiredForPublicSignIn:true},
    sellerIdentity:{configured:true,
      requiredForNaturalSellerVerification:true},
    payment:{configured:false,requiredForExternalPayment:true},
    ibanOwnership:{configured:false,requiredForWithdrawalOwnership:true},
    logistics:{configured:false,requiredForDelivery:true},
    allExternalReady:false,
  });
  assert.equal(JSON.stringify(parsed).includes("secret"),false);
  assert.equal(parseExternalIntegrationStatus({
    sms:{configured:true,requiredForPublicSignIn:true},
    sellerIdentity:{configured:true,
      requiredForNaturalSellerVerification:true},
    payment:{configured:true,requiredForExternalPayment:true},
    ibanOwnership:{configured:true,requiredForWithdrawalOwnership:true},
    logistics:{configured:true,requiredForDelivery:true},
    allExternalReady:false,
  }),null);
  assert.equal(parseExternalIntegrationStatus({
    sms:{configured:false,requiredForPublicSignIn:false},
    sellerIdentity:{configured:false,
      requiredForNaturalSellerVerification:true},
    payment:{configured:false,requiredForExternalPayment:true},
    ibanOwnership:{configured:false,requiredForWithdrawalOwnership:true},
    logistics:{configured:false,requiredForDelivery:true},
    allExternalReady:false,
  }),null);
});
