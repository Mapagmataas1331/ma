import{l as H,p as a,c as B,i as ne,j as fe,a as u,t as D,b as we,r as mt,q as ft,f as _e,k as L,s as ye,d as Be,e as ve}from"../chunks/disclose-version.CYM3sL8r.js";import{F as vt,I as st,J as Fe,g as ce,l as j,i as Se,f as T,m as f,o as v,t as Z,j as ue,K as R,v as p,y as Te,w as $e,L as I,x as Me,k as S,q as W}from"../chunks/utils.Dokr0Jt2.js";import{t as We,o as rt,b as nt,h as De,y as qe,m as Oe,f as je,R as Ie,g as ht,e as Xe,d as pe,w as pt,S as bt,n as Ne,p as _t,N as Ve,q as kt,T as wt,j as yt,z as Ze,A as it,C as lt,D as ot,i as ge,a as q,J as he,U as St,G as be,E as Ct,F as dt,H as Pe,L as Qe,I as ct,K as xt,B as Re,l as Pt,V as Ot,W as Tt}from"../chunks/language.easLb1wG.js";import{w as ze,d as $t}from"../chunks/index.DId5r52q.js";import{d as Mt,u as At,s as Lt,t as Et}from"../chunks/theme.pjoo0TBX.js";import{R as et,T as tt,a as at}from"../chunks/index.DD37kcl9.js";function It(d){const e=[],n=document.createTreeWalker(d,NodeFilter.SHOW_ELEMENT,{acceptNode:o=>o.tabIndex>=0?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP});for(;n.nextNode();)e.push(n.currentNode);return e}const Nt={src:"",delayMs:0,onLoadingStatusChange:void 0},Rt=d=>{const e={...Nt,...d},n=We(rt(e,"loadingStatus","onLoadingStatusChange")),{src:o,delayMs:r}=n,h=e.loadingStatus??ze("loading"),t=nt(h,e==null?void 0:e.onLoadingStatusChange);De([o,r],([k,x])=>{if(qe){const M=new Image;M.src=k,M.onload=()=>{if(r!==void 0){const P=window.setTimeout(()=>{t.set("loaded")},x);return()=>window.clearTimeout(P)}else t.set("loaded")},M.onerror=()=>{t.set("error")}}});const s=Oe("avatar-image",{stores:[o,t],returned:([k,x])=>{const M=je({display:x==="loaded"?"block":"none"});return{src:k,style:M}}}),_=Oe("avatar-fallback",{stores:[t],returned:([k])=>({style:k==="loaded"?je({display:"none"}):void 0,hidden:k==="loaded"?!0:void 0})});return{elements:{image:s,fallback:_},states:{loadingStatus:t},options:n}},{name:Ge}=yt("hover-card"),Dt={defaultOpen:!1,openDelay:1e3,closeDelay:100,positioning:{placement:"bottom"},arrowSize:8,closeOnOutsideClick:!0,forceVisible:!1,portal:void 0,closeOnEscape:!0,onOutsideClick:void 0},zt=["trigger","content"];function Bt(d={}){const e={...Dt,...d},n=e.open??ze(e.defaultOpen),o=nt(n,e==null?void 0:e.onOpenChange),r=Ie.writable(!1),h=Ie.writable(!1),t=ze(!1),s=ze(null),_=We(rt(e,"ids")),{openDelay:k,closeDelay:x,positioning:M,arrowSize:P,closeOnOutsideClick:O,forceVisible:z,portal:b,closeOnEscape:m,onOutsideClick:C}=_,c=We({...ht(zt),...e.ids});let $=null,K;const ee=Ie.derived(k,i=>()=>{$&&(window.clearTimeout($),$=null),$=window.setTimeout(()=>{o.set(!0)},i)}),se=Ie.derived([x,h,r],([i,E,l])=>()=>{$&&(window.clearTimeout($),$=null),!E&&!l&&($=window.setTimeout(()=>{o.set(!1)},i))}),me=Oe(Ge("trigger"),{stores:[o,c.trigger,c.content],returned:([i,E,l])=>({role:"button","aria-haspopup":"dialog","aria-expanded":i,"data-state":i?"open":"closed","aria-controls":l,id:E}),action:i=>({destroy:Xe(pe(i,"pointerenter",l=>{Ne(l)||ee.get()()}),pe(i,"pointerleave",l=>{Ne(l)||se.get()()}),pe(i,"focus",l=>{!pt(l.currentTarget)||!bt(l.currentTarget)||ee.get()()}),pe(i,"blur",()=>se.get()()))})}),ie=Mt({open:o,forceVisible:z,activeTrigger:s}),ke=Oe(Ge("content"),{stores:[ie,b,c.content],returned:([i,E,l])=>({hidden:i?void 0:!0,tabindex:-1,style:je({"pointer-events":i?void 0:"none",opacity:i?1:0,userSelect:"text",WebkitUserSelect:"text"}),id:l,"data-state":i?"open":"closed","data-portal":_t(E)}),action:i=>{let E=Ze;const l=()=>{$&&window.clearTimeout($)};let A=Ze;const y=De([ie,s,M,O,b,m],([w,g,U,Y,V,X])=>{A(),!(!w||!g)&&vt().then(()=>{A(),A=At(i,{anchorElement:g,open:o,options:{floating:U,modal:{closeOnInteractOutside:Y,onClose:()=>{o.set(!1),g.focus()},shouldCloseOnInteractOutside:G=>{var te;return(te=C.get())==null||te(G),!(G.defaultPrevented||Ve(g)&&g.contains(G.target))},open:w},portal:kt(i,V),focusTrap:null,escapeKeydown:X?void 0:null}}).destroy})});return E=Xe(pe(i,"pointerdown",w=>{const g=w.currentTarget,U=w.target;!Ve(g)||!Ve(U)||(g.contains(U)&&t.set(!0),r.set(!1),h.set(!0))}),pe(i,"pointerenter",w=>{Ne(w)||ee.get()()}),pe(i,"pointerleave",w=>{Ne(w)||se.get()()}),pe(i,"focusout",w=>{w.preventDefault()})),{destroy(){E(),A(),l(),y()}}}}),oe=Oe(Ge("arrow"),{stores:P,returned:i=>({"data-arrow":!0,style:je({position:"absolute",width:`var(--arrow-size, ${i}px)`,height:`var(--arrow-size, ${i}px)`})})});return De([t],([i])=>{if(!qe||!i)return;const E=document.body,l=document.getElementById(c.content.get());if(!l)return;K=E.style.userSelect||E.style.webkitUserSelect;const A=l.style.userSelect||l.style.webkitUserSelect;return E.style.userSelect="none",E.style.webkitUserSelect="none",l.style.userSelect="text",l.style.webkitUserSelect="text",()=>{E.style.userSelect=K,E.style.webkitUserSelect=K,l.style.userSelect=A,l.style.webkitUserSelect=A}}),wt(()=>{const i=document.getElementById(c.trigger.get());i&&s.set(i)}),De([o],([i])=>{if(!qe||!i){r.set(!1);return}const E=()=>{t.set(!1),h.set(!1),Lt(1).then(()=>{var w;((w=document.getSelection())==null?void 0:w.toString())!==""&&r.set(!0)})};document.addEventListener("pointerup",E);const l=document.getElementById(c.content.get());return l?(It(l).forEach(y=>y.setAttribute("tabindex","-1")),()=>{document.removeEventListener("pointerup",E),r.set(!1),h.set(!1)}):void 0}),{ids:c,elements:{trigger:me,content:ke,arrow:oe},states:{open:o},options:_}}function Je(){return{NAME:"avatar",PARTS:["root","image","fallback"]}}function jt(d){const{NAME:e,PARTS:n}=Je(),o=it(e,n),r={...Rt(lt(d)),getAttrs:o};return st(e,r),{...r,updateOption:ot(r.options)}}function Qt(d=""){const{NAME:e}=Je(),n=Fe(e);return d?n.options.src.set(d):n.options.src.set(""),n}function Ht(){const{NAME:d}=Je();return Fe(d)}var Ut=D("<div><!></div>");function Vt(d,e){const n=H(e,["children","$$slots","$$events","$$legacy"]),o=H(n,["delayMs","loadingStatus","onLoadingStatusChange","asChild","el"]);ce(e,!1);let r=a(e,"delayMs",24,()=>{}),h=a(e,"loadingStatus",28,()=>{}),t=a(e,"onLoadingStatusChange",24,()=>{}),s=a(e,"asChild",8,!1),_=a(e,"el",28,()=>{});const{states:{loadingStatus:k},updateOption:x,getAttrs:M}=jt({src:"",delayMs:r(),onLoadingStatusChange:({next:b})=>{var m;return h(b),(m=t())==null||m(b),b}}),P=M("root");j(()=>R(h()),()=>{h()!==void 0&&k.set(h())}),j(()=>R(r()),()=>{x("delayMs",r())}),Se(),ge();var O=B(),z=T(O);ne(z,s,b=>{var m=B(),C=T(m);q(C,e,"default",{attrs:P},null),u(b,m)},b=>{var m=Ut();fe(m,$=>_($),()=>_());let C;var c=f(m);q(c,e,"default",{attrs:P},null),v(m),Z(()=>C=he(m,C,{...o,...P})),u(b,m)}),u(d,O),ue()}var Gt=D("<img>");function Wt(d,e){const n=H(e,["children","$$slots","$$events","$$legacy"]),o=H(n,["src","alt","asChild","el"]);ce(e,!1);const r=we(),h=()=>_e(p(t),"$image",r),t=Te(),s=Te();let _=a(e,"src",24,()=>{}),k=a(e,"alt",24,()=>{}),x=a(e,"asChild",8,!1),M=a(e,"el",28,()=>{});const P={"data-bits-avatar-image":""};j(()=>R(_()),()=>{ft($e(t,Qt(_()).elements.image),"$image",r)}),j(()=>h(),()=>{$e(s,h())}),j(()=>p(s),()=>{Object.assign(p(s),P)}),Se(),ge();var O=B(),z=T(O);ne(z,x,b=>{var m=B(),C=T(m);q(C,e,"default",{get builder(){return p(s)}},null),u(b,m)},b=>{var m=Gt();fe(m,c=>M(c),()=>M());let C;Z(()=>C=he(m,C,{...p(s),alt:k(),...o})),St(m),mt(m),be(m,c=>p(s).action(c)),u(b,m)}),u(d,O),ue()}var qt=D("<span><!></span>");function Ft(d,e){const n=H(e,["children","$$slots","$$events","$$legacy"]),o=H(n,["asChild","el"]);ce(e,!1);const r=we(),h=()=>_e(k,"$fallback",r),t=Te();let s=a(e,"asChild",8,!1),_=a(e,"el",28,()=>{});const{elements:{fallback:k},getAttrs:x}=Ht(),M=x("fallback");j(()=>h(),()=>{$e(t,h())}),j(()=>p(t),()=>{Object.assign(p(t),M)}),Se(),ge();var P=B(),O=T(P);ne(O,s,z=>{var b=B(),m=T(b);q(m,e,"default",{get builder(){return p(t)}},null),u(z,b)},z=>{var b=qt();fe(b,c=>_(c),()=>_());let m;var C=f(b);q(C,e,"default",{get builder(){return p(t)}},null),v(b),Z(()=>m=he(b,m,{...p(t),...o})),be(b,c=>p(t).action(c)),u(z,b)}),u(d,P),ue()}function ut(){return{NAME:"link-preview",PARTS:["arrow","content","trigger"]}}function Jt(d){const{NAME:e,PARTS:n}=ut(),o=it(e,n),r={...Bt({...lt(d),forceVisible:!0}),getAttrs:o};return st(e,r),{...r,updateOption:ot(r.options)}}function Ke(){const{NAME:d}=ut();return Fe(d)}function Kt(d){const n={...{side:"bottom",align:"center"},...d},{options:{positioning:o}}=Ke();Ct(o)(n)}function Yt(d,e){ce(e,!1);const n=we(),o=()=>_e(b,"$idValues",n);let r=a(e,"open",28,()=>{}),h=a(e,"onOpenChange",24,()=>{}),t=a(e,"openDelay",8,700),s=a(e,"closeDelay",8,300),_=a(e,"closeOnOutsideClick",24,()=>{}),k=a(e,"closeOnEscape",24,()=>{}),x=a(e,"portal",24,()=>{}),M=a(e,"onOutsideClick",24,()=>{});const{states:{open:P},updateOption:O,ids:z}=Jt({defaultOpen:r(),openDelay:t(),closeDelay:s(),closeOnOutsideClick:_(),closeOnEscape:k(),portal:x(),onOutsideClick:M(),onOpenChange:({next:c})=>{var $;return r()!==c&&(($=h())==null||$(c),r(c)),c}}),b=$t([z.content,z.trigger],([c,$])=>({content:c,trigger:$}));j(()=>R(r()),()=>{r()!==void 0&&P.set(r())}),j(()=>R(t()),()=>{O("openDelay",t())}),j(()=>R(s()),()=>{O("closeDelay",s())}),j(()=>R(_()),()=>{O("closeOnOutsideClick",_())}),j(()=>R(k()),()=>{O("closeOnEscape",k())}),j(()=>R(x()),()=>{O("portal",x())}),j(()=>R(M()),()=>{O("onOutsideClick",M())}),Se(),ge();var m=B(),C=T(m);q(C,e,"default",{get ids(){return o()}},null),u(d,m),ue()}var Xt=D("<div><!></div>"),Zt=D("<div><!></div>"),ea=D("<div><!></div>"),ta=D("<div><!></div>"),aa=D("<div><!></div>");function sa(d,e){const n=H(e,["children","$$slots","$$events","$$legacy"]),o=H(n,["transition","transitionConfig","inTransition","inTransitionConfig","outTransition","outTransitionConfig","asChild","id","side","align","sideOffset","alignOffset","collisionPadding","avoidCollisions","collisionBoundary","sameWidth","fitViewport","strategy","overlap","el"]);ce(e,!1);const r=we(),h=()=>_e(E,"$content",r),t=()=>_e(l,"$open",r),s=Te();let _=a(e,"transition",24,()=>{}),k=a(e,"transitionConfig",24,()=>{}),x=a(e,"inTransition",24,()=>{}),M=a(e,"inTransitionConfig",24,()=>{}),P=a(e,"outTransition",24,()=>{}),O=a(e,"outTransitionConfig",24,()=>{}),z=a(e,"asChild",8,!1),b=a(e,"id",24,()=>{}),m=a(e,"side",8,"bottom"),C=a(e,"align",8,"center"),c=a(e,"sideOffset",8,0),$=a(e,"alignOffset",8,0),K=a(e,"collisionPadding",8,8),ee=a(e,"avoidCollisions",8,!0),se=a(e,"collisionBoundary",24,()=>{}),me=a(e,"sameWidth",8,!1),ie=a(e,"fitViewport",8,!1),ke=a(e,"strategy",8,"absolute"),oe=a(e,"overlap",8,!1),i=a(e,"el",28,()=>{});const{elements:{content:E},states:{open:l},ids:A,getAttrs:y}=Ke(),w=y("content"),g=dt();j(()=>R(b()),()=>{b()&&A.content.set(b())}),j(()=>h(),()=>{$e(s,h())}),j(()=>p(s),()=>{Object.assign(p(s),w)}),j(()=>(t(),R(m()),R(C()),R(c()),R($()),R(K()),R(ee()),R(se()),R(me()),R(ie()),R(ke()),R(oe())),()=>{t()&&Kt({side:m(),align:C(),sideOffset:c(),alignOffset:$(),collisionPadding:K(),avoidCollisions:ee(),collisionBoundary:se(),sameWidth:me(),fitViewport:ie(),strategy:ke(),overlap:oe()})}),Se(),ge();var U=B(),Y=T(U);ne(Y,()=>z()&&t(),V=>{var X=B(),G=T(X);q(G,e,"default",{get builder(){return p(s)}},null),u(V,X)},V=>{var X=B(),G=T(X);ne(G,()=>_()&&t(),te=>{var Q=Xt();fe(Q,N=>i(N),()=>i());let de;var le=f(Q);q(le,e,"default",{get builder(){return p(s)}},null),v(Q),Z(()=>de=he(Q,de,{...p(s),...o})),Pe(3,Q,_,k),be(Q,N=>p(s).action(N)),I(()=>L("m-focusout",Q,g)),I(()=>L("m-pointerdown",Q,g)),I(()=>L("m-pointerenter",Q,g)),I(()=>L("m-pointerleave",Q,g)),u(te,Q)},te=>{var Q=B(),de=T(Q);ne(de,()=>x()&&P()&&t(),le=>{var N=Zt();fe(N,F=>i(F),()=>i());let Ae;var Ce=f(N);q(Ce,e,"default",{get builder(){return p(s)}},null),v(N),Z(()=>Ae=he(N,Ae,{...p(s),...o})),Pe(1,N,x,M),Pe(2,N,P,O),be(N,F=>p(s).action(F)),I(()=>L("m-focusout",N,g)),I(()=>L("m-pointerdown",N,g)),I(()=>L("m-pointerenter",N,g)),I(()=>L("m-pointerleave",N,g)),u(le,N)},le=>{var N=B(),Ae=T(N);ne(Ae,()=>x()&&t(),Ce=>{var F=ea();fe(F,J=>i(J),()=>i());let Le;var xe=f(F);q(xe,e,"default",{get builder(){return p(s)}},null),v(F),Z(()=>Le=he(F,Le,{...p(s),...o})),Pe(1,F,x,M),be(F,J=>p(s).action(J)),I(()=>L("m-focusout",F,g)),I(()=>L("m-pointerdown",F,g)),I(()=>L("m-pointerenter",F,g)),I(()=>L("m-pointerleave",F,g)),u(Ce,F)},Ce=>{var F=B(),Le=T(F);ne(Le,()=>P()&&t(),xe=>{var J=ta();fe(J,ae=>i(ae),()=>i());let Ee;var He=f(J);q(He,e,"default",{get builder(){return p(s)}},null),v(J),Z(()=>Ee=he(J,Ee,{...p(s),...o})),Pe(2,J,P,O),be(J,ae=>p(s).action(ae)),I(()=>L("m-focusout",J,g)),I(()=>L("m-pointerdown",J,g)),I(()=>L("m-pointerenter",J,g)),I(()=>L("m-pointerleave",J,g)),u(xe,J)},xe=>{var J=B(),Ee=T(J);ne(Ee,t,He=>{var ae=aa();fe(ae,Ue=>i(Ue),()=>i());let Ye;var gt=f(ae);q(gt,e,"default",{get builder(){return p(s)}},null),v(ae),Z(()=>Ye=he(ae,Ye,{...p(s),...o})),be(ae,Ue=>p(s).action(Ue)),I(()=>L("m-focusout",ae,g)),I(()=>L("m-pointerdown",ae,g)),I(()=>L("m-pointerenter",ae,g)),I(()=>L("m-pointerleave",ae,g)),u(He,ae)},null,!0),u(xe,J)},!0),u(Ce,F)},!0),u(le,N)},!0),u(te,Q)},!0),u(V,X)}),u(d,U),ue()}var ra=D("<a><!></a>");function na(d,e){const n=H(e,["children","$$slots","$$events","$$legacy"]),o=H(n,["asChild","id","el"]);ce(e,!1);const r=we(),h=()=>_e(x,"$trigger",r),t=Te();let s=a(e,"asChild",8,!1),_=a(e,"id",24,()=>{}),k=a(e,"el",28,()=>{});const{elements:{trigger:x},ids:M,getAttrs:P}=Ke(),O=dt(),z=P("trigger");j(()=>R(_()),()=>{_()&&M.trigger.set(_())}),j(()=>h(),()=>{$e(t,h())}),j(()=>p(t),()=>{Object.assign(p(t),z)}),Se(),ge();var b=B(),m=T(b);ne(m,s,C=>{var c=B(),$=T(c);q($,e,"default",{get builder(){return p(t)}},null),u(C,c)},C=>{var c=ra();fe(c,ee=>k(ee),()=>k());let $;var K=f(c);q(K,e,"default",{get builder(){return p(t)}},null),v(c),Z(()=>$=he(c,$,{...p(t),...o,...z})),be(c,ee=>p(t).action(ee)),I(()=>L("m-blur",c,O)),I(()=>L("m-focus",c,O)),I(()=>L("m-pointerenter",c,O)),I(()=>L("m-pointerleave",c,O)),u(C,c)}),u(d,b),ue()}function ia(d,e){const n=H(e,["children","$$slots","$$events","$$legacy"]),o=H(n,["class","delayMs"]);ce(e,!1);let r=a(e,"class",8,void 0),h=a(e,"delayMs",8,void 0);ge();var t=Me(()=>Qe("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",r()));Vt(d,ye({get delayMs(){return h()},get class(){return p(t)}},()=>o,{children:(s,_)=>{var k=B(),x=T(k);q(x,e,"default",{},null),u(s,k)},$$slots:{default:!0}})),ue()}function la(d,e){const n=H(e,["children","$$slots","$$events","$$legacy"]),o=H(n,["class","src","alt"]);ce(e,!1);let r=a(e,"class",8,void 0),h=a(e,"src",8,void 0),t=a(e,"alt",8,void 0);ge();var s=Me(()=>Qe("aspect-square h-full w-full",r()));Wt(d,ye({get src(){return h()},get alt(){return t()},get class(){return p(s)}},()=>o)),ue()}function oa(d,e){const n=H(e,["children","$$slots","$$events","$$legacy"]),o=H(n,["class"]);ce(e,!1);let r=a(e,"class",8,void 0);ge();var h=Me(()=>Qe("flex h-full w-full items-center justify-center rounded-full bg-muted",r()));Ft(d,ye({get class(){return p(h)}},()=>o,{children:(t,s)=>{var _=B(),k=T(_);q(k,e,"default",{},null),u(t,_)},$$slots:{default:!0}})),ue()}function da(d,e){const n=H(e,["children","$$slots","$$events","$$legacy"]);ct(d,ye({name:"github"},()=>n,{iconNode:[["path",{d:"M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"}],["path",{d:"M9 18c-4.51 2-5-2-7-2"}]],children:(r,h)=>{var t=B(),s=T(t);q(s,e,"default",{},null),u(r,t)},$$slots:{default:!0}}))}function ca(d,e){const n=H(e,["children","$$slots","$$events","$$legacy"]);ct(d,ye({name:"send"},()=>n,{iconNode:[["path",{d:"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"}],["path",{d:"m21.854 2.147-10.94 10.939"}]],children:(r,h)=>{var t=B(),s=T(t);q(s,e,"default",{},null),u(r,t)},$$slots:{default:!0}}))}function ua(d,e){const n=H(e,["children","$$slots","$$events","$$legacy"]),o=H(n,["class","align","sideOffset","transition","transitionConfig"]);ce(e,!1);let r=a(e,"class",8,void 0),h=a(e,"align",8,"center"),t=a(e,"sideOffset",8,4),s=a(e,"transition",8,xt),_=a(e,"transitionConfig",8,void 0);ge();var k=Me(()=>Qe("z-50 w-64 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none",r()));sa(d,ye({get transition(){return s()},get transitionConfig(){return _()},get sideOffset(){return t()},get align(){return h()},get class(){return p(k)}},()=>o,{children:(x,M)=>{var P=B(),O=T(P);q(O,e,"default",{},null),u(x,P)},$$slots:{default:!0}})),ue()}const ga=Yt,ma=na;var fa=D("<!> <!>",1),va=D('<div class="flex space-x-4"><!> <div><h4 class="text-sm font-semibold"> </h4> <p class="text-sm"> </p></div></div>'),ha=D("<!> <!>",1);function re(d,e){let n=a(e,"class",8,""),o=a(e,"link",8,"https://ma.cyou"),r=a(e,"name",8,"ma.cyou"),h=a(e,"img",8,"https://github.com/ma-cyou.png"),t=a(e,"fallback",8,"MA"),s=a(e,"title",8,"macyou"),_=a(e,"description",8,"Mapagmataas's website");ga(d,{children:(k,x)=>{var M=ha(),P=T(M),O=Me(()=>`${(n()!==""?n()+" ":"")??""}rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-black`);ma(P,{get href(){return o()},target:"_blank",rel:"noreferrer noopener",get class(){return p(O)},children:(b,m)=>{W();var C=Be();Z(()=>ve(C,r())),u(b,C)},$$slots:{default:!0}});var z=S(P,2);ua(z,{class:"w-80",children:(b,m)=>{var C=va(),c=f(C);ia(c,{class:"my-auto h-12 w-12",children:(ie,ke)=>{var oe=fa(),i=T(oe);la(i,{get src(){return h()}});var E=S(i,2);oa(E,{children:(l,A)=>{W();var y=Be();Z(()=>ve(y,t())),u(l,y)},$$slots:{default:!0}}),u(ie,oe)},$$slots:{default:!0}});var $=S(c,2),K=f($),ee=f(K,!0);v(K);var se=S(K,2),me=f(se,!0);v(se),v($),v(C),Z(()=>{ve(ee,s()),ve(me,_())}),u(b,C)},$$slots:{default:!0}}),u(k,M)},$$slots:{default:!0}})}var pa=D('<div class="flex items-center justify-center">Привет&nbsp; <button class="cursor-grab grayscale-[20%] hover:scale-110">👋</button> ,</div> <div class="ml-0 text-2xl sm:ml-2 sm:text-4xl md:text-5xl">я автор</div>',1),ba=D('<div class="flex items-center justify-center">Hi&nbsp; <button class="cursor-grab grayscale-[20%] hover:scale-110">👋</button> ,</div> <div class="ml-0 text-2xl sm:ml-2 sm:text-4xl md:text-5xl">I am the author</div>',1),_a=D(`<ul class="my-4 ml-3 list-disc space-y-2 md:my-8 md:ml-6 md:space-y-4 [&amp;>li]:mt-2"><li><p>Меня зовут Тимофей, мой ник — "Mapagmataas". В настоящий момент я работаю в <!> лаборантом на <a href="https://ru.wikipedia.org/wiki/ВЭПП-2000" target="_blank" class="svelte-1mrrbe8">коллайдере частиц</a>. Основное направление моей деятельности — <a href="https://wikipedia.org/wiki/Solution_stack#Full-stack_developer" class="svelte-1mrrbe8">full stack</a> разработка веб-сайтов для управления данными, приборами и различными системами.</p></li> <li><p>Я увлекаюсь веб-дизайном и front-end разработкой, постоянно нахожу новые решения и
								стремлюсь узнавать что-то новое, и не побоюсь сказать, что уверен в своих знаниях <a href="https://wikipedia.org/wiki/HTML" target="_blank" class="svelte-1mrrbe8">HTML</a>, <a href="https://wikipedia.org/wiki/CSS" target="_blank" class="svelte-1mrrbe8">CSS</a>, <a href="https://wikipedia.org/wiki/JavaScript" target="_blank" class="svelte-1mrrbe8">JavaScript</a>/<a href="https://wikipedia.org/wiki/TypeScript" target="_blank" class="svelte-1mrrbe8">TypeScript</a>, в моем любимом фреймворке <!>, а также <!>. Меня также привлекает мир разработки игр, и я горю желанием попробовать себя в <a href="https://wikipedia.org/wiki/Video_game_development" target="_blank" class="svelte-1mrrbe8">game dev</a>. Я хорошо знаком с основами языков C-семейства (<a href="https://wikipedia.org/wiki/C_(programming_language)" target="_blank" class="svelte-1mrrbe8">C</a>, <a href="https://wikipedia.org/wiki/C_Sharp_(programming_language)" target="_blank" class="svelte-1mrrbe8">C#</a>, <a href="https://wikipedia.org/wiki/C++" target="_blank" class="svelte-1mrrbe8">C++</a>, <!>), <a href="https://wikipedia.org/wiki/Memory_management" target="_blank" class="svelte-1mrrbe8">управлением памятью</a>, <a href="https://wikipedia.org/wiki/Multithreading_(computer_architecture)" target="_blank" class="svelte-1mrrbe8">многопоточностью</a>, <a href="https://wikipedia.org/wiki/Asynchrony_(computer_programming)" target="_blank" class="svelte-1mrrbe8">асинхронным программированием</a>.</p></li> <li><p>Также владею основами работы с <a href="https://wikipedia.org/wiki/Database" target="_blank" class="svelte-1mrrbe8">базами данных</a> — таких как <a href="https://wikipedia.org/wiki/PostgreSQL" target="_blank" class="svelte-1mrrbe8">PostgreSQL</a>, <a href="https://wikipedia.org/wiki/MySQL" target="_blank" class="svelte-1mrrbe8">MySQL</a>, <a href="https://wikipedia.org/wiki/SQLite" target="_blank" class="svelte-1mrrbe8">SQLite</a>, <a href="https://wikipedia.org/wiki/SQLAlchemy" target="_blank" class="svelte-1mrrbe8">SQLAlchemy</a>, <a href="https://wikipedia.org/wiki/Redis" target="_blank" class="svelte-1mrrbe8">Redis</a> и <a href="https://wikipedia.org/wiki/MongoDB" target="_blank" class="svelte-1mrrbe8">MongoDB</a>. Для
								повседневных задач я использую <!> или <!>, и хорошо знаком с множеством модулей и библиотек для этих языков.</p></li></ul> <blockquote class="mt-6 border-l-2 border-muted-foreground pl-6 italic md:mt-10">Главное, что я ищу в своей работе, — это интересные задачи и профессиональный рост.
						Однако при этом я не спешу и стремлюсь к качественному развитию.</blockquote>`,1),ka=D(`<ul class="my-4 ml-3 list-disc space-y-2 md:my-8 md:ml-6 md:space-y-4 [&amp;>li]:mt-2"><li><p>My name is Timofey, and my nickname is "Mapagmataas". Currently, I work as a lab
								technician at <!> at a <a href="https://wikipedia.org/wiki/Collider" target="_blank" class="svelte-1mrrbe8">particle collider</a>.
								My primary area of expertise is <a href="https://wikipedia.org/wiki/Solution_stack#Full-stack_developer" class="svelte-1mrrbe8">full stack</a> development of websites for managing data, instruments, and various systems.</p></li> <li><p>I am passionate about web design and front-end development, always looking for new
								solutions and eager to learn new things. I am confident in my knowledge of <a href="https://wikipedia.org/wiki/HTML" target="_blank" class="svelte-1mrrbe8">HTML</a>, <a href="https://wikipedia.org/wiki/CSS" target="_blank" class="svelte-1mrrbe8">CSS</a>, <a href="https://wikipedia.org/wiki/JavaScript" target="_blank" class="svelte-1mrrbe8">JavaScript</a>/<a href="https://wikipedia.org/wiki/TypeScript" target="_blank" class="svelte-1mrrbe8">TypeScript</a>, my favorite framework <!>, and also <!>. I am also drawn to the world of game development and am eager to explore
								opportunities in <a href="https://wikipedia.org/wiki/Video_game_development" target="_blank" class="svelte-1mrrbe8">game dev</a>. I am familiar with the basics of C-family languages (<a href="https://wikipedia.org/wiki/C_(programming_language)" target="_blank" class="svelte-1mrrbe8">C</a>, <a href="https://wikipedia.org/wiki/C_Sharp_(programming_language)" target="_blank" class="svelte-1mrrbe8">C#</a>, <a href="https://wikipedia.org/wiki/C++" target="_blank" class="svelte-1mrrbe8">C++</a>, <!>), <a href="https://wikipedia.org/wiki/Memory_management" target="_blank" class="svelte-1mrrbe8">memory management</a>, <a href="https://wikipedia.org/wiki/Multithreading_(computer_architecture)" target="_blank" class="svelte-1mrrbe8">multithreading</a>, and <a href="https://wikipedia.org/wiki/Asynchrony_(computer_programming)" target="_blank" class="svelte-1mrrbe8">asynchronous programming</a>.</p></li> <li><p>I also have a strong foundation in working with <a href="https://wikipedia.org/wiki/Database" target="_blank" class="svelte-1mrrbe8">databases</a> such as <a href="https://wikipedia.org/wiki/PostgreSQL" target="_blank" class="svelte-1mrrbe8">PostgreSQL</a>, <a href="https://wikipedia.org/wiki/MySQL" target="_blank" class="svelte-1mrrbe8">MySQL</a>, <a href="https://wikipedia.org/wiki/SQLite" target="_blank" class="svelte-1mrrbe8">SQLite</a>, <a href="https://wikipedia.org/wiki/SQLAlchemy" target="_blank" class="svelte-1mrrbe8">SQLAlchemy</a>, <a href="https://wikipedia.org/wiki/Redis" target="_blank" class="svelte-1mrrbe8">Redis</a>, and <a href="https://wikipedia.org/wiki/MongoDB" target="_blank" class="svelte-1mrrbe8">MongoDB</a>. For
								everyday tasks, I use <!> or <!>, and I am well-versed in many modules and libraries for these languages.</p></li></ul> <blockquote class="mt-6 border-l-2 border-muted-foreground pl-6 italic md:mt-10">The most important thing I seek in my work is interesting challenges and professional
						growth. However, I am not in a hurry; I strive for quality development.</blockquote>`,1),wa=D("<!> @mapagmataas1331",1),ya=D("<p>GitHub</p>"),Sa=D("<!> <!>",1),Ca=D("<!> @mapagmataas",1),xa=D("<p>Telegram</p>"),Pa=D("<!> <!>",1),Oa=D(`<div class="w-full snap-y snap-mandatory justify-center overflow-y-scroll scroll-smooth bg-gradient-to-br from-white to-sky-200 dark:from-sky-800 dark:to-black svelte-1mrrbe8"><section class="relative z-20 flex snap-start items-center justify-center svelte-1mrrbe8"><div class="text-center"><h1 class="block items-center justify-center text-3xl font-bold sm:flex sm:text-4xl md:text-5xl"><!></h1> <p class="mt-2 text-base sm:mt-5 md:text-lg"> </p> <img src="/author.png"> <div class="mt-5 flex flex-col items-center justify-center sm:mt-10 md:flex-row"><!> <!></div></div></section> <section id="about" class="relative z-10 flex snap-start flex-col items-center justify-center text-xs leading-normal tracking-tight md:text-base md:leading-relaxed md:tracking-normal svelte-1mrrbe8"><div class="container z-10 max-h-full"><h1 class="scroll-m-20 text-2xl font-extrabold tracking-tight md:text-4xl lg:text-5xl"> </h1> <div class="mt-0 md:mt-6"><!></div></div></section> <section id="socials" class="relative z-20 flex snap-start flex-col items-center justify-center svelte-1mrrbe8"><div class="container mx-auto text-center"><h2 class="text-4xl font-bold"> </h2> <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2"><!> <!></div> <p class="absolute bottom-0 left-0 right-0 p-2 text-center text-xs backdrop-blur-sm">© ma.cyou (<a href="https://github.com/mapagmataas1331" target="_blank" class="svelte-1mrrbe8">Mapagmataas</a>),
				2024. All rights reserved.</p></div></section></div>`);function Ia(d){const e=we(),n=()=>_e(Pt,"$language",e),o=()=>_e(Et,"$theme",e),r=l=>{l.innerHTML="👀",setTimeout(()=>l.style.transform="scaleX(-1)",500),setTimeout(()=>l.style.transform="",1e3),setTimeout(()=>l.innerHTML="👋",1500)};var h=Oa(),t=f(h),s=f(t),_=f(s),k=f(_);ne(k,()=>n()==="ru",l=>{var A=pa(),y=T(A),w=S(f(y));W(),v(y),W(2),L("click",w,g=>r(g.target)),u(l,A)},l=>{var A=ba(),y=T(A),w=S(f(y));W(),v(y),W(2),L("click",w,g=>r(g.target)),u(l,A)}),v(_);var x=S(_,2),M=f(x,!0);v(x);var P=S(x,2),O=S(P,2),z=f(O);Re(z,{href:"#about",variant:"default",class:"m-2 min-w-48 font-semibold shadow-lg hover:scale-105",children:(l,A)=>{W();var y=Be();Z(()=>ve(y,n()==="ru"?"Больше обо мне":"More about me")),u(l,y)},$$slots:{default:!0}});var b=S(z,2);Re(b,{href:"#socials",variant:"default",class:"m-2 min-w-48 font-semibold shadow-lg hover:scale-105",children:(l,A)=>{W();var y=Be();Z(()=>ve(y,n()==="ru"?"Мои Соц. сети":"My Social links")),u(l,y)},$$slots:{default:!0}}),v(O),v(s),v(t);var m=S(t,2),C=f(m),c=f(C),$=f(c,!0);v(c);var K=S(c,2),ee=f(K);ne(ee,()=>n()==="ru",l=>{var A=_a(),y=T(A),w=f(y),g=f(w),U=S(f(g));re(U,{class:"font-semibold italic",link:"https://www.inp.nsk.su/",name:"ИЯФ",img:"https://inp.nsk.su/images/logo/OfficiallogoBINPblueClear.gif",fallback:"ИЯФ",title:"ИЯФ СО РАН",description:"Институт ядерной физики имени Г. И. Будкера СО РАН"}),W(5),v(g),v(w);var Y=S(w,2),V=f(Y),X=S(f(V),9);re(X,{class:"font-semibold italic",link:"https://svelte.dev/",name:"Svelte",img:"https://github.com/sveltejs.png",fallback:"SK",title:"SVELTE",description:"Кибернетически улучшенные веб-приложения."});var G=S(X,2);re(G,{class:"font-semibold italic",link:"https://react.dev/",name:"React",img:"https://github.com/reactjs.png",fallback:"RC",title:"React",description:"Библиотека для создания пользовательских интерфейсов."});var te=S(G,10);re(te,{class:"font-semibold italic",link:"https://www.rust-lang.org/",name:"Rust",img:"https://github.com/rust-lang.png",fallback:"RT",title:"Rust",description:"Язык, расширяющий возможности каждого для создания надежного и эффективного программного обеспечения."}),W(7),v(V),v(Y);var Q=S(Y,2),de=f(Q),le=S(f(de),15);re(le,{class:"font-semibold italic",link:"https://www.python.org/",name:"Python",img:"https://github.com/python.png",fallback:"PY",title:"Python",description:"язык программирования, который позволяет работать быстро и более эффективно интегрировать программы."});var N=S(le,2);re(N,{class:"font-semibold italic",link:"https://go.dev/",name:"Golang",img:"https://github.com/golang.png",fallback:"GO",title:"GO",description:"Создавайте простые, безопасные и масштабируемые программы с помощью Go."}),W(),v(de),v(Q),v(y),W(2),u(l,A)},l=>{var A=ka(),y=T(A),w=f(y),g=f(w),U=S(f(g));re(U,{class:"font-semibold italic",link:"https://www.inp.nsk.su/",name:"BINP",img:"https://inp.nsk.su/images/logo/OfficiallogoBINPblueClear.gif",fallback:"BINP",title:"Budker Institute of Nuclear Physics",description:"G. I. Budker Institute of Nuclear Physics SB RAS"}),W(5),v(g),v(w);var Y=S(w,2),V=f(Y),X=S(f(V),9);re(X,{class:"font-semibold italic",link:"https://svelte.dev/",name:"Svelte",img:"https://github.com/sveltejs.png",fallback:"SK",title:"SVELTE",description:"Cybernetically enhanced web apps."});var G=S(X,2);re(G,{class:"font-semibold italic",link:"https://react.dev/",name:"React",img:"https://github.com/reactjs.png",fallback:"RC",title:"React",description:"A JavaScript library for building user interfaces."});var te=S(G,10);re(te,{class:"font-semibold italic",link:"https://www.rust-lang.org/",name:"Rust",img:"https://github.com/rust-lang.png",fallback:"RT",title:"Rust",description:"A language empowering everyone to build reliable and efficient software."}),W(7),v(V),v(Y);var Q=S(Y,2),de=f(Q),le=S(f(de),15);re(le,{class:"font-semibold italic",link:"https://www.python.org/",name:"Python",img:"https://github.com/python.png",fallback:"PY",title:"Python",description:"A programming language that lets you work quickly and integrate systems more effectively."});var N=S(le,2);re(N,{class:"font-semibold italic",link:"https://go.dev/",name:"Golang",img:"https://github.com/golang.png",fallback:"GO",title:"Go",description:"Create fast, reliable, and scalable programs with Go."}),W(),v(de),v(Q),v(y),W(2),u(l,A)}),v(K),v(C),v(m);var se=S(m,2),me=f(se),ie=f(me),ke=f(ie,!0);v(ie);var oe=S(ie,2),i=f(oe);et(i,{children:(l,A)=>{var y=Sa(),w=T(y);tt(w,{class:"sm:text-right",children:(U,Y)=>{Re(U,{href:"https://github.com/mapagmataas1331",variant:"default",target:"_blank",class:"m-2 min-w-48 font-semibold shadow-lg hover:scale-105",children:(V,X)=>{var G=wa(),te=T(G);da(te,{class:"mr-2 h-6 w-6"}),W(),u(V,G)},$$slots:{default:!0}})},$$slots:{default:!0}});var g=S(w,2);at(g,{children:(U,Y)=>{var V=ya();u(U,V)},$$slots:{default:!0}}),u(l,y)},$$slots:{default:!0}});var E=S(i,2);et(E,{children:(l,A)=>{var y=Pa(),w=T(y);tt(w,{class:"sm:text-left",children:(U,Y)=>{Re(U,{href:"https://t.me/mapagmataas",variant:"default",target:"_blank",class:"m-2 min-w-48 font-semibold shadow-lg hover:scale-105",children:(V,X)=>{var G=Ca(),te=T(G);ca(te,{class:"mr-2 h-6 w-6"}),W(),u(V,G)},$$slots:{default:!0}})},$$slots:{default:!0}});var g=S(w,2);at(g,{children:(U,Y)=>{var V=xa();u(U,V)},$$slots:{default:!0}}),u(l,y)},$$slots:{default:!0}}),v(oe),W(2),v(me),v(se),v(h),Z(()=>{ve(M,n()==="ru"?"Веб-разработчик и дизайнер":"Web developer and designer"),Ot(P,"alt",n()==="ru"?"Фото Aвтора":"Author's photo"),Tt(P,`mx-auto mt-5 flex h-full max-h-[calc((100dvh_-_3.5rem)_/_2)] min-h-48 items-center justify-center rounded-3xl shadow-xl transition-transform hover:scale-105 sm:mt-10 md:max-h-[calc((100dvh_-_4rem)_/_2)] ${(o()==="dark"?"pattern-light":"pattern")??""} svelte-1mrrbe8`),ve($,n()==="ru"?"Обо мне":"About me"),ve(ke,n()==="ru"?"Мои Соц. сети":"My Social links")}),u(d,h)}export{Ia as component};