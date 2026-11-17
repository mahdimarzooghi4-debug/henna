import test from "node:test";
import assert from "node:assert/strict";
import {
 EMPTY_PREVIEW_CATALOG_FILTERS,parsePreviewCatalogPrice,checkPreviewCatalogFilters,
 passesPreviewCatalogFilters,previewCatalogFilterCount,
} from "../apps/mobile-consumer/src/buyer-catalog-preview-filters.ts";
test("price bounds accept Persian Arabic ASCII integers but reject zero, negatives and unsafe values",()=>{
 assert.equal(parsePreviewCatalogPrice("۱۸۵٬۰۰۰"),185000);
 assert.equal(parsePreviewCatalogPrice("٦٨,٠٠٠"),68000);
 assert.equal(parsePreviewCatalogPrice("45000"),45000);
 assert.equal(parsePreviewCatalogPrice(""),0);
 for(const value of ["-1","0","0.5","1e3","۲ تومان","999999999999999999999","۳-۲"]){
  assert.equal(parsePreviewCatalogPrice(value),null,value);
 }
});
test("preview range validates order and checks only sample price/badge",()=>{
 const f={minPrice:"۱۰٬۰۰۰",maxPrice:"۱۰۰٬۰۰۰",discounted:false,credit:false};
 assert.deepEqual(checkPreviewCatalogFilters(f),{ok:true,min:10000,max:100000});
 assert.equal(passesPreviewCatalogFilters({priceToman:68000,badge:"٪ تخفیف"},f),true);
 assert.equal(passesPreviewCatalogFilters({priceToman:185000,badge:"کالابرگ"},f),false);
 assert.equal(checkPreviewCatalogFilters({...f,minPrice:"۵۰۰٬۰۰۰"}).ok,false);
 assert.equal(checkPreviewCatalogFilters({...f,maxPrice:"-12"}).ok,false);
 assert.equal(passesPreviewCatalogFilters({priceToman:68000,badge:"٪ تخفیف"},{...f,credit:true}),false);
 assert.equal(previewCatalogFilterCount("لبنیات",{...f,credit:true}),4);
 assert.deepEqual(EMPTY_PREVIEW_CATALOG_FILTERS,{minPrice:"",maxPrice:"",discounted:false,credit:false});
});
