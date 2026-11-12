/** Figma 842:6377: isolated buyer sample filter. NEVER send price/credit filters to public API. */
export type PreviewCatalogFilters = Readonly<{minPrice:string;maxPrice:string;discounted:boolean;credit:boolean}>;
export const EMPTY_PREVIEW_CATALOG_FILTERS:PreviewCatalogFilters={minPrice:"",maxPrice:"",discounted:false,credit:false};
export function parsePreviewCatalogPrice(raw:string):number|null {
 if(!raw.trim())return 0;
 const text=raw.trim().replace(/[۰-۹]/g,c=>String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)))
   .replace(/[٠-٩]/g,c=>String("٠١٢٣٤٥٦٧٨٩".indexOf(c))).replace(/[٬,]/g,"");
 if(!/^[0-9]{1,12}$/.test(text))return null;
 const amount=Number(text);
 return Number.isSafeInteger(amount)&&amount>0?amount:null;
}
export function checkPreviewCatalogFilters(f:PreviewCatalogFilters):
 {ok:true;min:number;max:number}|{ok:false;message:string} {
 const min=parsePreviewCatalogPrice(f.minPrice),max=parsePreviewCatalogPrice(f.maxPrice);
 if(min===null||max===null)return{ok:false,message:"بازه قیمت باید عدد صحیح مثبت به تومان باشد."};
 if(min>0&&max>0&&min>max)return{ok:false,message:"حداقل قیمت نمی‌تواند از حداکثر بیشتر باشد."};
 return{ok:true,min,max};
}
export function previewCatalogFilterCount(category:string|null,f:PreviewCatalogFilters):number{
 return Number(!!category)+Number(!!f.minPrice.trim())+Number(!!f.maxPrice.trim())+Number(f.discounted)+Number(f.credit);
}
export function passesPreviewCatalogFilters(item:{priceToman:number;badge:string},f:PreviewCatalogFilters):boolean {
 const b=checkPreviewCatalogFilters(f);
 if(!b.ok)return false;
 return !(b.min&&item.priceToman<b.min)&&!(b.max&&item.priceToman>b.max)
   &&(!f.discounted||item.badge==="٪ تخفیف")&&(!f.credit||item.badge==="کالابرگ");
}
