const sources = [
  { id:'domclick-news', name:'Домклик', type:'html', feed:'https://blog.domclick.ru/novosti', homepage:'https://blog.domclick.ru/novosti', hosts:['blog.domclick.ru'], paths:['/novosti/'], region:null, priority:1 },
  { id:'domrf-news', name:'ДОМ.РФ', type:'rss', feed:'https://xn--h1alcedd.xn--d1aqf.xn--p1ai/rss/news/', homepage:'https://xn--h1alcedd.xn--d1aqf.xn--p1ai/news/', hosts:['xn--h1alcedd.xn--d1aqf.xn--p1ai'], paths:['/news/'], region:null, priority:2 },
  { id:'krasdom', name:'КРАСДОМ', type:'html', feed:'https://krasdom.ru/news/', homepage:'https://krasdom.ru/news/', hosts:['krasdom.ru','www.krasdom.ru'], paths:['/news/'], region:'krasnodar', priority:3 },
  { id:'93ru', name:'93.RU', type:'html', feed:'https://93.ru/text/realty/', homepage:'https://93.ru/text/realty/', hosts:['93.ru','www.93.ru'], paths:['/text/realty/'], region:'krasnodar', priority:4 },
  { id:'cian-news', name:'ЦИАН', type:'html', feed:'https://krasnodar.cian.ru/magazine/', homepage:'https://krasnodar.cian.ru/magazine/', hosts:['krasnodar.cian.ru'], paths:['/magazine/'], region:'krasnodar', priority:5 },
  { id:'yandex-news', name:'Яндекс Недвижимость', type:'html', feed:'https://realty.yandex.ru/journal/category/news/', homepage:'https://realty.yandex.ru/journal/category/news/', hosts:['realty.yandex.ru'], paths:['/journal/'], region:null, priority:6 },
  { id:'161ru', name:'161.RU', type:'html', feed:'https://161.ru/text/realty/', homepage:'https://161.ru/text/realty/', hosts:['161.ru','www.161.ru'], paths:['/text/realty/'], region:'rostov', priority:7 }
];

const SOURCE_LIMIT = 30;
const PAGE_TIMEOUT = 7000;
const ARTICLE_TIMEOUT = 2500;
const IMAGE_LIMIT = 12;
const IMAGE_CONCURRENCY = 4;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36 UrbanEstateNews/7.0';

const RULES = {
  mortgage:['ипотек','ставк','кредит','семейн','материнск','заем','заём','банк','банков','ключев','рефинанс','эскроу','первоначальн','кредитован','процентн','кредитн','заемщик','заёмщик'],
  newbuild:['новостро','застройщик','девелоп','жк ','жилой комплекс','строительств','дду','долев','нового дома','новом доме','жилых домов','жилых комплексов'],
  law:['закон','законодатель','правил','постанов','госдум','минстрой','минфин','росреестр','налог','штраф','норм','регулирован','вступил в силу','изменен','изменён','поправк','законопроект','госуслуг','егрн'],
  estate:['недвижим','жиль','квартир','аренд','рынок жилья','вторич','дом ','участок','земел','апартамент','жилье','жильё','продаж квартир','рынок недвижимости','собственник','покупател','продавц','коммерческ','ипотечн']
};
const MONTHS={января:0,февраля:1,марта:2,апреля:3,мая:4,июня:5,июля:6,августа:7,сентября:8,октября:9,ноября:10,декабря:11};

function decode(s=''){return String(s).replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/&#x27;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n)).replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCharCode(parseInt(n,16)));}
function strip(s=''){return decode(String(s).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<noscript[\s\S]*?<\/noscript>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();}
function norm(s=''){return strip(s).toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/gi,' ').replace(/\s+/g,' ').trim();}
function abs(raw,base){try{return raw?new URL(decode(raw).trim(),base).toString():null;}catch{return null;}}
function canonical(u){try{const x=new URL(u);x.hash='';['utm_source','utm_medium','utm_campaign','utm_term','utm_content','utm_id','gclid','fbclid','yclid'].forEach(k=>x.searchParams.delete(k));return x.toString().replace(/\/$/,'').toLowerCase();}catch{return String(u||'').replace(/\/$/,'').toLowerCase();}}
function allowed(u,s){try{const x=new URL(u);return s.hosts.includes(x.hostname.toLowerCase())&&s.paths.some(p=>x.pathname.toLowerCase().startsWith(p));}catch{return false;}}
function articleUrl(u,s){if(!allowed(u,s))return false;const p=new URL(u).pathname;if(s.id==='krasdom')return /^\/news\/(?!$)[^/?#]+/i.test(p);if(s.id==='93ru'||s.id==='161ru')return /^\/text\/realty\/\d{4}\/\d{2}\/\d{2}\/\d+\/?$/i.test(p);if(s.id==='cian-news')return /^\/magazine\/[^/?#]+/i.test(p)&&!/^\/magazine\/?$/i.test(p);if(s.id==='domclick-news')return /^\/novosti\/[^/?#]+/i.test(p)&&!/^\/novosti\/?$/i.test(p);if(s.id==='yandex-news')return /^\/journal\/[^/?#]+\/[^/?#]+/i.test(p);return false;}
function dateRu(t=''){const x=strip(t);let m=x.match(/(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s*(\d{4})?(?:\s*[|,]?\s*(\d{1,2}):(\d{2}))?/i);if(!m)return null;let y=m[3]?+m[3]:new Date().getFullYear();let d=new Date(y,MONTHS[m[2].toLowerCase()],+m[1],+(m[4]||12),+(m[5]||0));if(!m[3]&&d.getTime()>Date.now()+86400000)d.setFullYear(y-1);return d.toISOString();}
function meta(html,names){for(const n of names){const e=n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');let m=html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${e}["'][^>]+content=["']([^"']+)["']`,'i'))||html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${e}["']`,'i'));if(m)return decode(m[1]);}return null;}
function jsonLd(html,s){
  const out=[];
  const blocks=html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi)||[];
  for(const b of blocks){
    try{
      const raw=b.replace(/^.*?>/s,'').replace(/<\/script>[\s\S]*$/i,'').trim();
      const data=JSON.parse(raw);
      const nodes=Array.isArray(data)?data:[data];
      for(const n of nodes){
        const graph=Array.isArray(n?.['@graph'])?n['@graph']:[n];
        for(const x of graph){
          if(!x||typeof x!=='object')continue;
          const type=Array.isArray(x['@type'])?x['@type'].join(' '):String(x['@type']||'');
          if(!/article|newsarticle|blogposting/i.test(type))continue;
          const u=abs(x.url||x.mainEntityOfPage?.['@id']||x.mainEntityOfPage,s.feed);
          if(!u||!articleUrl(u,s))continue;
          const title=strip(x.headline||x.name||'');
          if(title.length<15)continue;
          let image=x.image;
          if(Array.isArray(image))image=image[0];
          if(image&&typeof image==='object')image=image.url;
          out.push({title,description:strip(x.description||''),url:u,published:x.datePublished||null,image:abs(image,u)});
        }
      }
    }catch{}
  }
  return out;
}
function anchors(html,s){const out=[];const re=/<a\b([^>]*?)href\s*=\s*(["'])(.*?)\2([^>]*)>([\s\S]*?)<\/a>/gi;let m;while((m=re.exec(html))){const u=abs(m[3],s.feed);if(!u||!articleUrl(u,s))continue;const title=strip(m[5]);if(title.length<15||title.length>300||/^(читать|далее|подробнее|все новости|новости|статьи)$/i.test(title))continue;const ctx=strip(html.slice(Math.max(0,m.index-1200),Math.min(html.length,re.lastIndex+1200)));out.push({title,description:'',url:u,published:dateRu(ctx),image:null});}return out;}
function parsePage(html,s){const all=[...jsonLd(html,s),...anchors(html,s)];const seen=new Set();return all.filter(x=>{const k=canonical(x.url);if(!k||seen.has(k))return false;seen.add(k);return true;}).slice(0,SOURCE_LIMIT);}
function categories(title,desc,s){const t=norm(`${title} ${desc}`),r=new Set();if(s.region)r.add(s.region);for(const [c,words] of Object.entries(RULES))if(words.some(w=>t.includes(norm(w))))r.add(c);if(s.id!=='domrf-news' && !r.has('estate'))r.add('estate');return [...r];}
function item(x,s){const title=strip(x.title||'Без названия');return {id:s.id+':'+canonical(x.url||s.homepage),title,description:strip(x.description||'').slice(0,360),url:x.url||s.homepage,source:s.name,sourceId:s.id,sourceHome:s.homepage,published:x.published&& !Number.isNaN(new Date(x.published).getTime())?new Date(x.published).toISOString():null,image:x.image||null,categories:categories(title,x.description||'',s),priority:s.priority};}
function recent(x,days){if(!x.published)return true;const t=new Date(x.published).getTime();return Number.isNaN(t)||Date.now()-t<=days*86400000;}
function sort(a){return a.sort((x,y)=>(y.published?Date.parse(y.published):0)-(x.published?Date.parse(x.published):0)||x.priority-y.priority);}
function dedupe(a){const u=new Set(),t=new Set();return a.filter(x=>{const cu=canonical(x.url),ct=norm(x.title);if(u.has(cu)||t.has(ct))return false;u.add(cu);t.add(ct);return true;});}
function xmlTag(s,tag){const re=new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,'i'),m=s.match(re);return m?strip(m[1]):'';}
function xmlLink(block){let m=block.match(/<link[^>]*href=["']([^"']+)["']/i);if(m)return decode(m[1]);m=block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);return m?strip(m[1]):'';}
function parseRss(xml,s){const blocks=xml.match(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi)||[];return blocks.slice(0,SOURCE_LIMIT).map(b=>item({title:xmlTag(b,'title'),description:xmlTag(b,'description')||xmlTag(b,'summary')||xmlTag(b,'content'),url:xmlLink(b),published:xmlTag(b,'pubDate')||xmlTag(b,'published')||xmlTag(b,'updated'),image:null},s)).filter(x=>allowed(x.url,s));}
async function fetchText(url,timeout){const c=new AbortController(),tm=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{redirect:'follow',signal:c.signal,headers:{'User-Agent':UA,'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8','Accept-Language':'ru-RU,ru;q=0.9'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return {text:await r.text(),url:r.url||url};}finally{clearTimeout(tm);}}
async function load(s){try{const p=await fetchText(s.feed,PAGE_TIMEOUT);if(s.type==='rss')return {source:s,items:parseRss(p.text,s),error:null};return {source:s,items:parsePage(p.text,s).map(x=>item(x,s)),error:null};}catch(e){return {source:s,items:[],error:e.message||'fetch failed'};}}
async function imageOne(x,s){if(x.image||!allowed(x.url,s))return x;try{const p=await fetchText(x.url,ARTICLE_TIMEOUT);const im=meta(p.text,['og:image','og:image:url','twitter:image','twitter:image:src']);if(im)x.image=abs(im,x.url);}catch{}return x;}
async function images(items){let q=items.filter(x=>!x.image).slice(0,IMAGE_LIMIT),i=0;async function w(){while(i<q.length){const x=q[i++],s=sources.find(s=>s.id===x.sourceId);if(s)await imageOne(x,s);}}await Promise.all(Array.from({length:Math.min(IMAGE_CONCURRENCY,q.length)},w));return items;}

export const maxDuration = 30;

export default async function handler(request){
  const url = new URL(request.url);
  const method = request.method;
  const headers = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Cache-Control':'s-maxage=300, stale-while-revalidate=600','Content-Type':'application/json; charset=utf-8'};
  if(method==='OPTIONS') return new Response(null,{status:204,headers});
  const send=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  try{
    const q=Object.fromEntries(url.searchParams.entries());
const category=String(q.category||'all').toLowerCase();const limit=Math.min(Math.max(Number(q.limit||15),1),50);const days=Math.min(Math.max(Number(q.days||7),1),30);
    const loaded=await Promise.all(sources.map(load));
    let all=loaded.flatMap(x=>x.items).filter(x=>{const s=sources.find(s=>s.id===x.sourceId);return s&&allowed(x.url,s)&&recent(x,days);});
    if(category!=='all')all=all.filter(x=>x.categories.includes(category));
    all=dedupe(sort(all)).slice(0,Math.max(limit*3,30));
    await images(all);all=sort(all).slice(0,limit);
    return send({ok:true,version:'8.0.0',generatedAt:new Date().toISOString(),category,days,limit,count:all.length,items:all,sources:loaded.map(x=>({id:x.source.id,name:x.source.name,type:x.source.type,ok:!x.error,count:x.items.length,categoryCount:x.items.filter(i=>category==='all'||i.categories.includes(category)).length,finalCount:all.filter(i=>i.sourceId===x.source.id).length,images:all.filter(i=>i.sourceId===x.source.id&&i.image).length,error:x.error||null}))});
  }catch(e){console.error('Urban Estate News API v7',e);return send({ok:false,version:'8.0.0',error:e?.message||String(e)},500);}
};
