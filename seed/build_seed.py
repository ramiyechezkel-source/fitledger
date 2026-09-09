from openpyxl import load_workbook
import datetime, re, json, collections

SRC='/mnt/user-data/uploads/ניר.xlsx'
GROUPS=['קבוצת אונו','קבוצת אונו בוקר','קבוצת דרך הים 20','קבוצת ילדים','ילדים קטנים','אימון נשים ורשה']
OTHER_RE=re.compile(r'פרסומ|תפריט|תזונ|משקול|שי 🎁|עיצוב|ליווי|תכנית אימון|גומיה|מזרן')
SKIP_RE=re.compile(r'^\d+\s*(בנות|ילדים)|היו\b|^כל אחד|הביא|חובה|לחשב|לבקש|מאימון|חודש חדש|אימון אחרון|תכנית אימון|שילמו|רק את|^שילמה$|מכאן|פעם הבאה|לא הגיע|הייתה|שילמ|נשאר')
PER_RE=re.compile(r'^כל אחד\s*(\d+)')
TRIAL_RE=re.compile(r'ניסיון|חינם')
UNPAID_RE=re.compile(r'no pay|לא שולם|לא שילם',re.I)
FROM_HERE_RE=re.compile(r'no pay from here',re.I)

def to_date(d):
    if isinstance(d,(int,float)): return datetime.date(1899,12,30)+datetime.timedelta(days=int(d))
    return d.date()

wb=load_workbook(SRC,read_only=True); ws=wb.active
rows=[r for r in ws.iter_rows(values_only=True)][1:]
data=[r for r in rows if any(c is not None for c in r)]

clients={}   # name -> id
groups={}    # name -> {id, members:Counter, lastSeen}
sessions=[]; payments=[]
def cid(name):
    name=name.strip()
    if name not in clients: clients[name]={'id':f'c{len(clients)+1:03d}','name':name,'last':None,'first':None,'prices':collections.Counter(),'n':0}
    return clients[name]['id']

def parse_participant(cell,default):
    s=str(cell).strip()
    note=''
    extra=0
    m=re.search(r'\+\s*(?:מזרן\s*)?\(?\s*(\d+)\s*(?:ש"ח|ש״ח|שח)?\)?\s*(?:מזרן)?!?$',s)
    if m and 'מזרן' in s:
        extra=int(m.group(1)); s=s[:m.start()].strip(); note='מזרן'
    s=re.sub(r'\s*[-–]?\s*(NIGHT!?|אימון לילה|אימון בוקר|קבוצת ערב!?|בוקר|ערב חינם)$','',s).strip()
    amt=default
    if TRIAL_RE.search(s):
        amt=0; note='ניסיון'; s=re.sub(r'\s*[-–]?\s*(ניסיון חינם|ניסיון|חינם|חדשה)\s*$','',s).strip()
    paid=None
    if 'שילמה כבר' in s:
        paid=True; s=re.sub(r'\s*[-–]?\s*שילמה כבר','',s).strip()
    m=re.search(r'^(.*?)\s*[-–]?\s*(\d+)\s*(?:ש"ח|ש״ח|שח)?\s*(?:\(גומיה\))?$',s)
    if m and m.group(1).strip():
        s=m.group(1).strip(); amt=int(m.group(2))
    s=s.rstrip('-–').strip()
    return s, amt+extra, note, paid

seen=collections.Counter()
from_here={}  # clientId -> date
for idx,r in enumerate(data):
    d=to_date(r[0]); ds=d.isoformat()
    amount=r[1]; name=(r[2] or '').strip()
    extras=[str(c).strip() for c in r[5:] if c is not None and str(c).strip()]
    flag=None
    if amount is None: amount=0; flag='missing_amount'
    amount=float(amount)
    key=(ds,amount,name)
    seen[key]+=1
    if seen[key]>1: flag='duplicate'
    alltext=' | '.join(extras)
    if name in GROUPS:
        gid=groups.setdefault(name,{'id':f'g{len(groups)+1:02d}','name':name,'members':collections.Counter(),'last':None,'first':None})
        gid['last']=max(gid['last'] or ds,ds); gid['first']=min(gid['first'] or ds,ds)
        per=None; parts=[]; notes=[]
        for c in extras:
            m=PER_RE.match(c)
            if m: per=int(m.group(1)); continue
            if SKIP_RE.search(c) or len(c)>40: notes.append(c); continue
            parts.append(c)
        if not parts:
            sessions.append(dict(date=ds,clientId=cid(name),clientName=name,amount=amount,type='group',groupId=gid['id'],groupName=name,gkey=f"{gid['id']}_{ds}",paid=True,note=alltext,flag=flag,src='excel'))
            clients[name]['prices'][amount]+=1; clients[name]['n']+=1
            clients[name]['last']=max(clients[name]['last'] or ds,ds); clients[name]['first']=min(clients[name]['first'] or ds,ds)
            continue
        default=per if per else round(amount/len(parts),2)
        parsed=[parse_participant(c,default) for c in parts]
        # if amounts don't sum to row total and no explicit per-person amounts, keep default
        tot=sum(p[1] for p in parsed)
        gnote=' | '.join(notes)
        for (pname,pamt,pnote,ppaid) in parsed:
            if not pname: continue
            c=cid(pname); ci=clients[pname]
            ci['prices'][pamt]+=1; ci['n']+=1; ci['group']=gid['id']
            ci['last']=max(ci['last'] or ds,ds); ci['first']=min(ci['first'] or ds,ds)
            gid['members'][pname]+=1
            gid.setdefault('memberLast',{})[pname]=max(gid.get('memberLast',{}).get(pname,ds),ds)
            n=' | '.join(x for x in [pnote,gnote] if x)
            sessions.append(dict(date=ds,clientId=c,clientName=pname,amount=pamt,type='group',groupId=gid['id'],groupName=name,gkey=f"{gid['id']}_{ds}",paid=True,note=n,flag=flag,src='excel',rowTotal=amount))
    else:
        c=cid(name); ci=clients[name]
        ci['prices'][amount]+=1; ci['n']+=1
        ci['last']=max(ci['last'] or ds,ds); ci['first']=min(ci['first'] or ds,ds)
        typ='other' if (OTHER_RE.search(name) or OTHER_RE.search(alltext) or amount>=1000) else 'personal'
        s=dict(date=ds,clientId=c,clientName=name,amount=amount,type=typ,groupId=None,groupName=None,gkey=None,paid=True,note=alltext,flag=flag,src='excel')
        if FROM_HERE_RE.search(alltext): from_here[c]=ds
        sessions.append(s)

# unpaid rules (2026 only)
for s in sessions:
    if s['date']>='2026-01-01':
        if UNPAID_RE.search(s['note'] or ''): s['paid']=False
        if s['clientId'] in from_here and s['date']>=from_here[s['clientId']]: s['paid']=False
# Idit credit
idit=clients['עידית']['id']
payments.append(dict(date='2026-08-30',clientId=idit,clientName='עידית',amount=2134,note='יתרת זכות בפתיחה (מהאקסל: "היום הביאה 5,600. היא ביתרה של 2,134")',src='excel'))
for s in sessions:
    if s['clientId']==idit and s['date']>'2026-08-30': s['paid']=False

# sessions ids
for i,s in enumerate(sessions): s['id']=f's{i+1:05d}'
for i,p in enumerate(payments): p['id']=f'p{i+1:05d}'

out_clients=[]
for name,ci in clients.items():
    price=ci['prices'].most_common(1)[0][0] if ci['prices'] else 200
    # most recent price: last session
    last_price=max((s for s in sessions if s['clientId']==ci['id']),key=lambda s:s['date'])['amount']
    out_clients.append(dict(id=ci['id'],name=name,defaultPrice=last_price or 200,active=True,groupId=ci.get('group'),firstSeen=ci['first'],lastSeen=ci['last'],sessionCount=ci['n'],isGroupRow=name in GROUPS))
out_groups=[]
for name,g in groups.items():
    ml=g.get('memberLast',{})
    lastd=datetime.date.fromisoformat(g['last'])
    cutoff=(lastd-datetime.timedelta(days=120)).isoformat()
    roster=[clients[m]['id'] for m,d in ml.items() if d>=cutoff]
    per=collections.Counter(s['amount'] for s in sessions if s['groupId']==g['id'] and s['clientName']!=name)
    out_groups.append(dict(id=g['id'],name=name,memberIds=roster,defaultPrice=per.most_common(1)[0][0] if per else 50,active=(g['last']>='2026-01-01'),firstSeen=g['first'],lastSeen=g['last']))

flags=collections.Counter(s['flag'] for s in sessions if s['flag'])
json.dump(dict(clients=out_clients,groups=out_groups,sessions=sessions,payments=payments,meta=dict(source='ניר.xlsx',rows=len(data),generated=datetime.date.today().isoformat(),flags=flags)),open('public/history.json','w'),ensure_ascii=False)
print('clients',len(out_clients),'groups',len(out_groups),'sessions',len(sessions),'payments',len(payments),'flags',flags)
for g in out_groups: print(g['name'],g['active'],g['defaultPrice'],len(g['memberIds']),[clients_name for clients_name,cc in clients.items() if cc['id'] in g['memberIds']])
print('unpaid', sum(1 for s in sessions if not s['paid']), sum(s['amount'] for s in sessions if not s['paid']))
print(collections.Counter(s['type'] for s in sessions))
