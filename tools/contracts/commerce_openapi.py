"""Generate the shipping commerce contract; --check detects stale output/action coverage."""
from pathlib import Path
import copy
import json
import re
import sys
ROOT = Path(__file__).resolve().parents[2]
S = {}
def obj(fields, optional=()):
    return {'type':'object','properties':fields,'required':[k for k in fields if k not in optional]}
def ref(name): return {'$ref':'#/components/schemas/'+name}
def arr(item, **kw): return {'type':'array','items':item,**kw}
def integer(minimum=0,maximum=None):
    return {'type':'integer','format':'int64','minimum':minimum,**({'maximum':maximum} if maximum is not None else {})}
def text(maximum=240): return {'type':'string','minLength':1,'maxLength':maximum}
def enum(*values): return {'type':'string','enum':list(values)}
uuid={'type':'string','format':'uuid'}
boolean={'type':'boolean'}
utc={'type':'string','format':'date-time','description':'UTC timestamp with zero offset.'}
version=integer(1,2147483647)
# JsonElement command/resource payloads retain record PascalCase. Public typed responses use HTTP camelCase.
models=(ROOT/'src/Hana.Infrastructure/Commerce/CommerceModels.cs').read_text()
records=re.findall(r'public sealed record (\w+)\((.*?)\);',models,re.S)
def cstype(t, camel=False):
    nullable=t.endswith('?'); t=t.rstrip('?')
    if t.startswith('List<'): result=arr(cstype(t[5:-1],camel))
    else: result=copy.deepcopy({'Guid':uuid,'string':{'type':'string'},'long':{'type':'integer','format':'int64'},'int':{'type':'integer','format':'int32'},'bool':boolean,'decimal':{'type':'number'},'DateTimeOffset':utc}.get(t,ref(('Public' if camel else '')+t)))
    return {'anyOf':[result,{'type':'null'}]} if nullable else result
for name,parameters in records:
    for camel in (False,True):
        fields={}
        for part in parameters.split(','):
            t,n=part.strip().split(' ',1);n=n.split('=')[0].strip()
            fields[n[0].lower()+n[1:] if camel else n]=cstype(t,camel)
        S[('Public' if camel else '')+name]=obj(fields)
S['PublicOffer']['properties']['storeName']=text(200)
S['PublicOffer']['required'].append('storeName')
comparison=obj({'storeName':text(200),'sellerId':uuid,'available':arr(ref('QuoteItem')),'unavailable':arr(ref('CartItem')),'itemsTotalRial':integer()})
commands={}
def command(action,fields,response,optional=(),permission='Authenticated owner'):
    S[action+'Input']=obj(fields,optional)
    commands[action]=(response,permission)
command('SAVE_OFFER',{'offerId':uuid,'productId':uuid,'priceRial':integer(1),'stock':integer(0,1000000),'expectedVersion':integer(0,2147483647)},ref('Offer'),permission='Active SELLER')
command('SET_CART_ITEM',{'productId':uuid,'quantity':integer(0,999),'expectedVersion':integer(0,2147483647)},ref('Cart'),('expectedVersion',))
command('COMPARE_CART',{},arr(comparison))
command('SAVE_ADDRESS',{'addressId':uuid,'cityId':uuid,'text':text(1000),'latitude':{'type':'number','minimum':-90,'maximum':90},'longitude':{'type':'number','minimum':-180,'maximum':180}},ref('BuyerAddress'))
command('CREATE_QUOTE',{'sellerId':uuid,'addressId':uuid,'purchaseType':enum('PERSONAL','LEGAL'),'fulfillmentMode':enum('PICKUP')},ref('Quote'))
command('PLACE_ORDER',{'quoteId':uuid,'creditGrantId':{'anyOf':[uuid,{'type':'null'}]},'unavailableDisposition':enum('KEEP','REMOVE'),'confirmUnavailable':boolean},ref('Order'),('creditGrantId','confirmUnavailable'))
for action in ('CANCEL_ORDER','CONFIRM_PICKUP'):
    command(action,{'orderId':uuid,'expectedVersion':version},ref('Order'))
command('SELLER_ORDER_STATE',{'orderId':uuid,'expectedVersion':version,'state':enum('PREPARING','READY_FOR_PICKUP')},ref('Order'),permission='Active seller of order')
command('CREATE_PROGRAM',{'name':text(120),'fundingReference':text(),'fundedRial':integer(1),'expiresAtUtc':utc,'categoryIds':arr(uuid,minItems=1,maxItems=100,uniqueItems=True),'organizationId':{'anyOf':[uuid,{'type':'null'}]}},ref('CreditProgram'),('organizationId',),'FINANCE or ADMIN')
scores=obj({k:integer(0,3) for k in ('health','hardship','age','size','care','education')})
beneficiary=obj({'accountId':uuid,'householdKey':uuid,'geographicFactor':{'type':'number','exclusiveMinimum':0},'scores':scores})
command('ALLOCATE_CREDIT',{'programId':uuid,'poolRial':integer(1),'beneficiaries':arr(beneficiary,minItems=1,maxItems=500)},obj({'grants':arr(ref('CreditGrant')),'unallocatedRial':integer(),'formulaVersion':text()}),permission='FINANCE or ADMIN')
command('LINK_HOUSEHOLD',{'accountId':uuid,'householdKey':uuid,'evidenceReference':text()},ref('CommerceHouseholdLink'),permission='FINANCE or ADMIN')
command('REPORT_INCIDENT',{'orderId':uuid,'orderItemId':uuid,'type':enum('DAMAGED_ITEM','MISSING_ITEM'),'quantity':integer(1,999),'evidenceId':uuid},ref('Incident'))
review=obj({'incident':ref('Incident'),'reason':text(1000)})
command('DECIDE_INCIDENT',{'incidentId':uuid,'decision':enum('APPROVE','REJECT'),'reason':text(1000)},review,permission='SUPPORT or ADMIN')
for action in ('RETURN_CONTACT','RETURN_VISIT'):
    command(action,{'incidentId':uuid,'evidenceReference':text()},obj({'incident':ref('Incident'),'evidence':text()}),permission='Active seller of incident')
command('CONFIRM_RETURN',{'incidentId':uuid},ref('Incident'))
command('VERIFY_UNAVAILABILITY',{'incidentId':uuid,'reason':text(1000)},review,permission='SUPPORT or ADMIN')
command('ASSESS_RETURN_SLA',{},obj({'assessed':integer()}),permission='SUPPORT or ADMIN')
command('SET_FEE_POLICY',{'version':text(120),'fixedInvoiceFeeRial':integer(),'approvalReference':text()},ref('FeePolicy'),permission='FINANCE or ADMIN')
command('BUILD_SETTLEMENTS',{},arr(ref('Settlement')),permission='FINANCE or ADMIN')
command('REQUEST_WITHDRAWAL',{'amountRial':integer(1),'ibanVerificationRequestReference':text()},ref('Withdrawal'))
command('CANCEL_WITHDRAWAL',{'withdrawalId':uuid},ref('Withdrawal'))
command('ASSESS_WITHDRAWAL_SLA',{},obj({'escalated':integer()}),permission='FINANCE or ADMIN')
command('OPEN_TICKET',{'subject':text(120),'message':text(2000)},ref('SupportTicket'))
command('REPLY_TICKET',{'ticketId':uuid,'reply':text(2000)},ref('SupportTicket'),permission='SUPPORT or ADMIN')
command('CREATE_ORGANIZATION',{'name':text(200),'registrationReference':text()},ref('CommerceOrganization'),permission='ADMIN')
command('GRANT_ORGANIZATION_MEMBER',{'organizationId':uuid,'accountId':uuid,'role':enum('MANAGER','BENEFICIARY')},ref('OrganizationMembership'),permission='ADMIN')
command('REVOKE_ORGANIZATION_MEMBER',{'membershipId':uuid},ref('OrganizationMembership'),permission='ADMIN')
command('SET_STAFF_PERMISSION',{'accountId':uuid,'permission':enum('FINANCE','SUPPORT'),'active':boolean},ref('CommerceStaffPermission'),permission='ADMIN')
command('SAVE_CONTENT',{'slug':{'type':'string','maxLength':100,'pattern':'^[a-z0-9]+(?:-[a-z0-9]+)*$'},'title':text(200),'text':text(10000),'expectedVersion':integer(0,2147483647)},ref('CommerceContent'),permission='ADMIN')
command('PUBLISH_CONTENT',{'contentId':uuid,'published':boolean,'expectedVersion':version},ref('CommerceContent'),permission='ADMIN')
command('READ_NOTIFICATION',{'notificationId':uuid},ref('CommerceNotification'))
command('SAVE_EVIDENCE',{'contentType':enum('image/png','image/jpeg','image/webp'),'contentBase64':{'type':'string','maxLength':55000,'contentEncoding':'base64','description':'Decoded image 12..40000 bytes; file signature checked.'}},obj({'evidenceId':uuid,'sha256':{'type':'string','pattern':'^[A-F0-9]{64}$'},'contentType':text(40),'size':integer(12,40000)}))
service=(ROOT/'src/Hana.Infrastructure/Commerce/CommerceService.cs').read_text()
actual=set(re.findall(r'"([A-Z_]+)"=>await',service))
assert actual==set(commands), f'Action mismatch: {actual ^ set(commands)}'
errors={str(n):{'description':d} for n,d in ((400,'Invalid input or missing UUID Idempotency-Key'),(401,'Missing/invalid/expired session'),(403,'Current role or ownership denied'),(404,'Missing or concealed resource'),(409,'State, balance, inventory, version or idempotency conflict'),(429,'New command limit exceeded'),(503,'Backend/integration unconfigured or temporarily unavailable'))}
paths={}
def operation(method,response,description,fields=None,parameters=(),public=False):
    op={'description':description,'security':[] if public else [{'session':[]}],'parameters':list(parameters),'responses':{'200':{'description':'Success','content':{'application/json':{'schema':response}}},**copy.deepcopy(errors)}}
    if method=='post':
        op['parameters'].append({'name':'Idempotency-Key','in':'header','required':True,'schema':uuid})
        op['requestBody']={'required':True,'content':{'application/json':{'schema':fields}}}
    return op
for action,(response,permission) in commands.items():
    paths['/api/v1/commerce/commands/'+action]={'post':operation('post',response,permission+'; persisted idempotency, all monetary values in IRR.',ref(action+'Input'))}
endpoints=(ROOT/'apps/api/Hana.Api/CommerceEndpoints.cs').read_text()
# REST writes are fixed aliases, including the route identifier merged by the server.
for path,action,key in re.findall(r'\("(/[^"]+)","([A-Z_]+)"(?:,"([a-zA-Z]+)")?\)',endpoints):
    path=path.replace(':guid','')
    if action not in commands: continue
    fields=copy.deepcopy(S[action+'Input']);params=[]
    if key:
        fields['required'].remove(key)
        params=[{'name':'id','in':'path','required':True,'schema':uuid}]
    response,permission=commands[action]
    paths.setdefault('/api/v1'+path,{})['post']=operation('post',response,permission+'; alias of '+action+'. A supplied body ID must match the route ID.',fields,params)
resource_models={'OFFER':'Offer','CART':'Cart','ADDRESS':'BuyerAddress','QUOTE':'Quote','ORDER':'Order','WALLET':'CashWallet','CREDIT':'CreditGrant','PROGRAM':'CreditProgram','INCIDENT':'Incident','SETTLEMENT':'Settlement','WITHDRAWAL':'Withdrawal','TICKET':'SupportTicket','NOTIFICATION':'CommerceNotification','CONTENT':'CommerceContent','ORGANIZATION':'CommerceOrganization','MEMBERSHIP':'OrganizationMembership','PERMISSION':'CommerceStaffPermission','FEE_VERSION':'FeePolicy','HOUSEHOLD':'CommerceHouseholdLink'}
page={'name':'page','in':'query','schema':integer(1,10000)}
def envelope(model): return obj({'items':arr(ref(model)),'page':integer(1),'pageSize':{'const':20}})
for path,kind in re.findall(r'\("(/[^"]+)","([A-Z_]+)"\)',endpoints):
    if kind not in resource_models: continue
    paths.setdefault('/api/v1'+path,{})['get']=operation('get',envelope(resource_models[kind]),'Scoped before pagination. /me and /orders show the buyer; /seller requires active SELLER.',parameters=[page])
paths['/api/v1/orders/{id}']={'get':operation('get',ref('Order'),'Buyer, current seller or authorized support/admin; other users receive 404.',parameters=[{'name':'id','in':'path','required':True,'schema':uuid}])}
paths['/api/v1/carts/current/comparison']={'get':operation('get',arr(comparison),'Current cart availability; not a price/stock reservation.')}
paths['/api/v1/offers']={'get':operation('get',envelope('PublicOffer'),'Published offers belonging to currently activated sellers.',parameters=[{'name':'productId','in':'query','schema':uuid},page],public=True)}
paths['/api/v1/content/{slug}']={'get':operation('get',ref('PublicCommerceContent'),'Only explicitly published content.',parameters=[{'name':'slug','in':'path','required':True,'schema':text(100)}],public=True)}
paths['/api/v1/organization/dashboard']={'get':operation('get',ref('OrganizationDashboard'),'Organization manager only. No beneficiary identities, funding references or unrelated organization data are returned.')}
paths['/api/v1/seller/report']={'get':operation('get',ref('SellerOperationalReport'),'Active seller only. Aggregate order, incident and prepared-settlement metrics scoped to the current seller; no buyer identities.')}
paths['/api/v1/evidence/{id}']={'get':operation('get',{},'Private evidence download; owner, current SUPPORT or active seller of the referenced incident. no-store, attachment, nosniff, CSP sandbox.',parameters=[{'name':'id','in':'path','required':True,'schema':uuid}])}
paths['/api/v1/evidence/{id}']['get']['responses']['200']['content']={mime:{'schema':{'type':'string','format':'binary'}} for mime in ('image/png','image/jpeg','image/webp')}
# Resources expose heterogeneous aggregates; summary and audit have distinct envelopes.
S['OperationalSummary']=obj({k:integer() for k in ('orders','cancelled','collected','openIncidents','preparedSettlements','grossRial')})
S['SellerOperationalReport']=obj({
 'orders':integer(),'paid':integer(),'preparing':integer(),'readyForPickup':integer(),
 'collected':integer(),'cancelled':integer(),'grossRial':integer(),
 'openIncidents':integer(),'incidentRefundRial':integer(),
 'preparedSettlements':integer(),'settlementGrossRial':integer(),
 'settlementRefundRial':integer(),'settlementPenaltyRial':integer(),
 'settlementFeeRial':integer(),'settlementNetRial':{'type':'integer','format':'int64'},
 'financeReviewRequired':integer()
})
S['AuditPage']=obj({'items':arr(obj({'id':uuid,'actorId':uuid,'commandId':uuid,'resourceId':uuid,'event':text(64),'createdAtUtc':utc})),'page':integer(1)})
S['OrganizationDashboard']=obj({
 'organizations':arr(obj({'id':uuid,'name':text(200),'managerCount':integer(),'beneficiaryCount':integer(),'programCount':integer()})),
 'programs':arr(obj({'id':uuid,'organizationId':uuid,'name':text(120),'fundedRial':integer(),'unallocatedRial':integer(),'expiresAtUtc':utc,'categoryCount':integer(1,100)})),
 'unreadNotifications':integer(),'openTickets':integer()
})
paths['/api/v1/commerce/resources/{kind}']={'get':operation('get',{'anyOf':[envelope(n) for n in resource_models.values()]+[ref('OperationalSummary'),ref('AuditPage')]},'Kind-specific scoped aggregates; AUDIT and SUMMARY require ADMIN.',parameters=[{'name':'kind','in':'path','required':True,'schema':enum(*resource_models,'AUDIT','SUMMARY')},{'name':'id','in':'query','schema':uuid},page])}
spec={'openapi':'3.1.0','info':{'title':'Henna internal pilot commerce API','version':'2026-10-04','description':'Backend contract only; SMS, PSP and logistics excluded. Command and stored resource records retain PascalCase; public typed records use camelCase. Runtime OpenAPI can remain generic for JsonElement endpoints.'},'paths':paths,'components':{'securitySchemes':{'session':{'type':'http','scheme':'bearer','description':'Current server-backed opaque session; not a user-provided account ID.'}},'schemas':S}}
output=json.dumps(spec,ensure_ascii=False,indent=2)+'\n'
target=ROOT/'docs/api/HANA-COMMERCE-OPENAPI.json'
if '--check' in sys.argv:
    assert json.loads(target.read_text())==spec, 'Commerce OpenAPI is stale; run tools/contracts/commerce_openapi.py'
    print(f'Commerce contract matches {len(commands)} shipping commands and {len(paths)} routes.')
else:
    target.write_text(output)
