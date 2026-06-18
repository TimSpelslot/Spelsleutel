import{B as N,o,c as d,h as I,m as b,t as m,i as D,n as g,j as E,f as S,k as U,b as i,l as j,r as L,d as z,u as O,g as R,a as n,e as t,w as k,p as w,q as V,F as q,s as F,v as P,R as K,T as G,x as H}from"./index-IGAQcL52.js";import{a as M,s as y}from"./index-B-iZxgRE.js";import{s as J,f as Q}from"./index-BVAJutP1.js";import{s as W}from"./index-Fno4zoeW.js";import{_ as x}from"./_plugin-vue_export-helper-DlAUqK2U.js";var X=`
    .p-avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: dt('avatar.width');
        height: dt('avatar.height');
        font-size: dt('avatar.font.size');
        background: dt('avatar.background');
        color: dt('avatar.color');
        border-radius: dt('avatar.border.radius');
    }

    .p-avatar-image {
        background: transparent;
    }

    .p-avatar-circle {
        border-radius: 50%;
    }

    .p-avatar-circle img {
        border-radius: 50%;
    }

    .p-avatar-icon {
        font-size: dt('avatar.icon.size');
        width: dt('avatar.icon.size');
        height: dt('avatar.icon.size');
    }

    .p-avatar img {
        width: 100%;
        height: 100%;
    }

    .p-avatar-lg {
        width: dt('avatar.lg.width');
        height: dt('avatar.lg.width');
        font-size: dt('avatar.lg.font.size');
    }

    .p-avatar-lg .p-avatar-icon {
        font-size: dt('avatar.lg.icon.size');
        width: dt('avatar.lg.icon.size');
        height: dt('avatar.lg.icon.size');
    }

    .p-avatar-xl {
        width: dt('avatar.xl.width');
        height: dt('avatar.xl.width');
        font-size: dt('avatar.xl.font.size');
    }

    .p-avatar-xl .p-avatar-icon {
        font-size: dt('avatar.xl.icon.size');
        width: dt('avatar.xl.icon.size');
        height: dt('avatar.xl.icon.size');
    }

    .p-avatar-group {
        display: flex;
        align-items: center;
    }

    .p-avatar-group .p-avatar + .p-avatar {
        margin-inline-start: dt('avatar.group.offset');
    }

    .p-avatar-group .p-avatar {
        border: 2px solid dt('avatar.group.border.color');
    }

    .p-avatar-group .p-avatar-lg + .p-avatar-lg {
        margin-inline-start: dt('avatar.lg.group.offset');
    }

    .p-avatar-group .p-avatar-xl + .p-avatar-xl {
        margin-inline-start: dt('avatar.xl.group.offset');
    }
`,Y={root:function(e){var r=e.props;return["p-avatar p-component",{"p-avatar-image":r.image!=null,"p-avatar-circle":r.shape==="circle","p-avatar-lg":r.size==="large","p-avatar-xl":r.size==="xlarge"}]},label:"p-avatar-label",icon:"p-avatar-icon"},Z=N.extend({name:"avatar",style:X,classes:Y}),aa={name:"BaseAvatar",extends:J,props:{label:{type:String,default:null},icon:{type:String,default:null},image:{type:String,default:null},size:{type:String,default:"normal"},shape:{type:String,default:"square"},ariaLabelledby:{type:String,default:null},ariaLabel:{type:String,default:null}},style:Z,provide:function(){return{$pcAvatar:this,$parentInstance:this}}};function f(a){"@babel/helpers - typeof";return f=typeof Symbol=="function"&&typeof Symbol.iterator=="symbol"?function(e){return typeof e}:function(e){return e&&typeof Symbol=="function"&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},f(a)}function A(a,e,r){return(e=ea(e))in a?Object.defineProperty(a,e,{value:r,enumerable:!0,configurable:!0,writable:!0}):a[e]=r,a}function ea(a){var e=ta(a,"string");return f(e)=="symbol"?e:e+""}function ta(a,e){if(f(a)!="object"||!a)return a;var r=a[Symbol.toPrimitive];if(r!==void 0){var l=r.call(a,e);if(f(l)!="object")return l;throw new TypeError("@@toPrimitive must return a primitive value.")}return(e==="string"?String:Number)(a)}var B={name:"Avatar",extends:aa,inheritAttrs:!1,emits:["error"],methods:{onError:function(e){this.$emit("error",e)}},computed:{dataP:function(){return Q(A(A({},this.shape,this.shape),this.size,this.size))}}},ra=["aria-labelledby","aria-label","data-p"],na=["data-p"],sa=["data-p"],ia=["src","alt","data-p"];function oa(a,e,r,l,c,s){return o(),d("div",b({class:a.cx("root"),"aria-labelledby":a.ariaLabelledby,"aria-label":a.ariaLabel},a.ptmi("root"),{"data-p":s.dataP}),[I(a.$slots,"default",{},function(){return[a.label?(o(),d("span",b({key:0,class:a.cx("label")},a.ptm("label"),{"data-p":s.dataP}),m(a.label),17,na)):a.$slots.icon?(o(),D(E(a.$slots.icon),{key:1,class:g(a.cx("icon"))},null,8,["class"])):a.icon?(o(),d("span",b({key:2,class:[a.cx("icon"),a.icon]},a.ptm("icon"),{"data-p":s.dataP}),null,16,sa)):a.image?(o(),d("img",b({key:3,src:a.image,alt:a.ariaLabel,onError:e[0]||(e[0]=function(){return s.onError&&s.onError.apply(s,arguments)})},a.ptm("image"),{"data-p":s.dataP}),null,16,ia)):S("",!0)]})],16,ra)}B.render=oa;var la=`
    .p-overlaybadge {
        position: relative;
    }

    .p-overlaybadge .p-badge {
        position: absolute;
        inset-block-start: 0;
        inset-inline-end: 0;
        transform: translate(50%, -50%);
        transform-origin: 100% 0;
        margin: 0;
        outline-width: dt('overlaybadge.outline.width');
        outline-style: solid;
        outline-color: dt('overlaybadge.outline.color');
    }

    .p-overlaybadge .p-badge:dir(rtl) {
        transform: translate(-50%, -50%);
    }
`,da={root:"p-overlaybadge"},pa=N.extend({name:"overlaybadge",style:la,classes:da}),ca={name:"OverlayBadge",extends:M,style:pa,provide:function(){return{$pcOverlayBadge:this,$parentInstance:this}}},T={name:"OverlayBadge",extends:ca,inheritAttrs:!1,components:{Badge:M}};function ua(a,e,r,l,c,s){var _=U("Badge");return o(),d("div",b({class:a.cx("root")},a.ptmi("root")),[I(a.$slots,"default"),i(_,b(a.$props,{pt:a.ptm("pcBadge")}),null,16,["pt"])],16)}T.render=ua;const $=L(!1),h=L(!1);function C(){function a(){window.matchMedia("(max-width: 767px)").matches?h.value=!h.value:$.value=!$.value}function e(){h.value=!1}return j({collapsed:$,mobileOpen:h,toggle:a,closeMobile:e})}const va={class:"navbar"},ba={class:"navbar__start"},ma={class:"navbar__end"},ga={class:"navbar__user","aria-hidden":"false"},_a={class:"navbar__display-name"},fa=z({__name:"TheNavbar",setup(a){const e=O(),r=R(),l=C(),c=w(()=>(e.user?.displayName??e.user?.name??"").charAt(0).toUpperCase()||"?"),s=w(()=>{switch(e.user?.role){case"DM":return"warn";case"ADMIN":return"contrast";default:return"secondary"}});async function _(){await e.logout(),await r.push("/login")}return(u,p)=>(o(),d("header",va,[n("div",ba,[i(t(y),{icon:t(l).mobileOpen?"pi pi-times":"pi pi-bars",text:"",rounded:"","aria-label":"Toggle sidebar",class:"navbar__toggle",onClick:p[0]||(p[0]=v=>t(l).toggle())},null,8,["icon"]),p[1]||(p[1]=n("div",{class:"navbar__brand"},[n("i",{class:"pi pi-shield navbar__brand-icon","aria-hidden":"true"}),n("span",{class:"navbar__brand-name"},"Spelslot")],-1))]),n("div",ma,[i(t(T),{value:"3",severity:"danger",class:"navbar__bell"},{default:k(()=>[i(t(y),{icon:"pi pi-bell",text:"",rounded:"","aria-label":"Notifications"})]),_:1}),i(t(B),{image:t(e).user?.avatarUrl??void 0,label:t(e).user?.avatarUrl?void 0:c.value,shape:"circle",class:"navbar__avatar"},null,8,["image","label"]),n("div",ga,[n("span",_a,m(t(e).user?.displayName??t(e).user?.name),1),i(t(W),{value:t(e).user?.role,severity:s.value,class:"navbar__role-tag"},null,8,["value","severity"])]),i(t(y),{icon:"pi pi-sign-out",text:"",rounded:"","aria-label":"Sign out",class:"navbar__logout",onClick:_})])]))}}),ha=x(fa,[["__scopeId","data-v-685b8113"]]),ya={class:"sidebar__nav"},$a={class:"sidebar__label"},wa={class:"sidebar__item sidebar__item--disabled"},Sa={class:"sidebar__label"},za={key:0,class:"sidebar__coming-soon"},ka={class:"sidebar__footer"},xa={class:"sidebar__footer-info"},Ba={class:"sidebar__footer-name"},Ca={class:"sidebar__footer-role"},Pa=z({__name:"TheSidebar",setup(a){const e=O(),r=C(),l=w(()=>(e.user?.displayName??e.user?.name??"").charAt(0).toUpperCase()||"?"),c=[{name:"dashboard",label:"Dashboard",icon:"pi pi-home"},{name:"codex",label:"Codex",icon:"pi pi-book"},{name:"session",label:"Sessions",icon:"pi pi-calendar"}],s={label:"Marketplace",icon:"pi pi-shopping-bag"};return(_,u)=>{const p=V("tooltip");return o(),d("aside",{class:g(["sidebar",{"sidebar--collapsed":t(r).collapsed,"sidebar--mobile-open":t(r).mobileOpen}]),"aria-label":"Main navigation"},[n("nav",ya,[(o(),d(q,null,F(c,v=>P(i(t(K),{key:v.name,to:{name:v.name},class:g(["sidebar__item"]),onClick:u[0]||(u[0]=Oa=>t(r).closeMobile())},{default:k(()=>[n("i",{class:g(["sidebar__icon",v.icon]),"aria-hidden":"true"},null,2),n("span",$a,m(v.label),1)]),_:2},1032,["to"]),[[p,t(r).collapsed?v.label:void 0,void 0,{right:!0}]])),64)),P((o(),d("div",wa,[n("i",{class:g(["sidebar__icon",s.icon]),"aria-hidden":"true"},null,2),n("span",Sa,m(s.label),1),t(r).collapsed?S("",!0):(o(),d("span",za,"Soon"))])),[[p,t(r).collapsed?s.label:void 0,void 0,{right:!0}]])]),u[1]||(u[1]=n("div",{class:"sidebar__divider","aria-hidden":"true"},null,-1)),n("div",ka,[i(t(B),{image:t(e).user?.avatarUrl??void 0,label:t(e).user?.avatarUrl?void 0:l.value,shape:"circle",class:"sidebar__footer-avatar"},null,8,["image","label"]),n("div",xa,[n("span",Ba,m(t(e).user?.displayName??t(e).user?.name),1),n("span",Ca,m(t(e).user?.role),1)])])],2)}}}),Aa=x(Pa,[["__scopeId","data-v-fdd87a6a"]]),Na={class:"app-layout"},Ia={class:"app-layout__body"},La=z({__name:"AppLayout",setup(a){const e=C();return(r,l)=>(o(),d("div",Na,[i(ha),i(G,{name:"overlay-fade"},{default:k(()=>[t(e).mobileOpen?(o(),d("div",{key:0,class:"sidebar-overlay","aria-hidden":"true",onClick:l[0]||(l[0]=c=>t(e).closeMobile())})):S("",!0)]),_:1}),n("div",Ia,[i(Aa),n("main",{class:g(["app-layout__content",{"is-sidebar-collapsed":t(e).collapsed}])},[i(t(H))],2)])]))}}),ja=x(La,[["__scopeId","data-v-1ade99b7"]]);export{ja as default};
