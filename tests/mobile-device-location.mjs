import assert from "node:assert/strict";
import test from "node:test";
import {
  requestAddressCoordinates,
} from "../apps/mobile-consumer/src/device-location.ts";

test("location is requested only through the explicit foreground flow",async()=>{
  const calls=[];
  const result=await requestAddressCoordinates({
    requestForegroundPermission:async()=>{calls.push("permission");return "granted";},
    servicesEnabled:async()=>{calls.push("services");return true;},
    current:async()=>{calls.push("current");return{
      latitude:35.689197123,longitude:51.388973456,
    };},
  });
  assert.deepEqual(calls,["permission","services","current"]);
  assert.deepEqual(result,{
    status:"ok",coordinates:{latitude:35.689197,longitude:51.388973},
  });
});

test("denied permission and disabled services never read a coordinate",async()=>{
  let current=0;
  const denied=await requestAddressCoordinates({
    requestForegroundPermission:async()=>"denied",
    servicesEnabled:async()=>{throw Error("must not check");},
    current:async()=>{current++;return{latitude:0,longitude:0};},
  });
  assert.deepEqual(denied,{status:"denied"});
  const disabled=await requestAddressCoordinates({
    requestForegroundPermission:async()=>"granted",
    servicesEnabled:async()=>false,
    current:async()=>{current++;return{latitude:0,longitude:0};},
  });
  assert.deepEqual(disabled,{status:"disabled"});
  assert.equal(current,0);
});

test("provider failures and invalid coordinates fail closed",async()=>{
  const bad=await requestAddressCoordinates({
    requestForegroundPermission:async()=>"granted",
    servicesEnabled:async()=>true,
    current:async()=>({latitude:91,longitude:51}),
  });
  assert.deepEqual(bad,{status:"unavailable"});
  const failed=await requestAddressCoordinates({
    requestForegroundPermission:async()=>"granted",
    servicesEnabled:async()=>true,
    current:async()=>{throw Error("native failure");},
  });
  assert.deepEqual(failed,{status:"unavailable"});
});
