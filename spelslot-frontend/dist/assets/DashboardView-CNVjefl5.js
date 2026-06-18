import{s as k,f as S}from"./index-BVAJutP1.js";import{B as w,o as r,c as o,m as x,I as N,d as P,J as $,a as s,A as f,F as g,s as b,t as c,r as h,b as m,e as _,f as D}from"./index-IGAQcL52.js";import{s as B}from"./index-Fno4zoeW.js";import{_ as A}from"./_plugin-vue_export-helper-DlAUqK2U.js";var L=`
    .p-skeleton {
        display: block;
        overflow: hidden;
        background: dt('skeleton.background');
        border-radius: dt('skeleton.border.radius');
    }

    .p-skeleton::after {
        content: '';
        animation: p-skeleton-animation 1.2s infinite;
        height: 100%;
        left: 0;
        position: absolute;
        right: 0;
        top: 0;
        transform: translateX(-100%);
        z-index: 1;
        background: linear-gradient(90deg, rgba(255, 255, 255, 0), dt('skeleton.animation.background'), rgba(255, 255, 255, 0));
    }

    [dir='rtl'] .p-skeleton::after {
        animation-name: p-skeleton-animation-rtl;
    }

    .p-skeleton-circle {
        border-radius: 50%;
    }

    .p-skeleton-animation-none::after {
        animation: none;
    }

    @keyframes p-skeleton-animation {
        from {
            transform: translateX(-100%);
        }
        to {
            transform: translateX(100%);
        }
    }

    @keyframes p-skeleton-animation-rtl {
        from {
            transform: translateX(100%);
        }
        to {
            transform: translateX(-100%);
        }
    }
`,U={root:{position:"relative"}},V={root:function(t){var n=t.props;return["p-skeleton p-component",{"p-skeleton-circle":n.shape==="circle","p-skeleton-animation-none":n.animation==="none"}]}},z=w.extend({name:"skeleton",style:L,classes:V,inlineStyles:U}),R={name:"BaseSkeleton",extends:k,props:{shape:{type:String,default:"rectangle"},size:{type:String,default:null},width:{type:String,default:"100%"},height:{type:String,default:"1rem"},borderRadius:{type:String,default:null},animation:{type:String,default:"wave"}},style:z,provide:function(){return{$pcSkeleton:this,$parentInstance:this}}};function u(e){"@babel/helpers - typeof";return u=typeof Symbol=="function"&&typeof Symbol.iterator=="symbol"?function(t){return typeof t}:function(t){return t&&typeof Symbol=="function"&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},u(e)}function X(e,t,n){return(t=j(t))in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function j(e){var t=C(e,"string");return u(t)=="symbol"?t:t+""}function C(e,t){if(u(e)!="object"||!e)return e;var n=e[Symbol.toPrimitive];if(n!==void 0){var d=n.call(e,t);if(u(d)!="object")return d;throw new TypeError("@@toPrimitive must return a primitive value.")}return(t==="string"?String:Number)(e)}var y={name:"Skeleton",extends:R,inheritAttrs:!1,computed:{containerStyle:function(){return this.size?{width:this.size,height:this.size,borderRadius:this.borderRadius}:{width:this.width,height:this.height,borderRadius:this.borderRadius}},dataP:function(){return S(X({},this.shape,this.shape))}}},T=["data-p"];function E(e,t,n,d,v,p){return r(),o("div",x({class:e.cx("root"),style:[e.sx("root"),p.containerStyle],"aria-hidden":"true"},e.ptmi("root"),{"data-p":p.dataP}),null,16,T)}y.render=E;function I(e){return{id:e.id,title:e.title,date:e.date,dmName:e.creator?.display_name??null,status:e.release_assignments?"assigned":"upcoming",isStoryAdventure:e.is_story_adventure}}const M={async getUpcomingSessions(){const e=await N.get("/api/adventure-board/sessions");return e.type==="error"?e:{type:"ok",data:e.data.map(I)}}},F={class:"dashboard"},J={class:"sessions"},K={key:0,class:"sessions__list","aria-busy":"true","aria-label":"Loading sessions"},O={class:"session-card__body"},q={key:1,class:"sessions__empty sessions__empty--error"},G={class:"sessions__empty-text"},H={key:2,class:"sessions__empty"},Q={key:3,class:"sessions__list"},W={class:"session-card__date","aria-hidden":"true"},Y={class:"session-card__day"},Z={class:"session-card__month"},ee={class:"session-card__body"},te={class:"session-card__row"},se={class:"session-card__title"},ne={class:"session-card__dm"},ae={key:0,class:"session-card__story"},ie=P({__name:"DashboardView",setup(e){const t=h([]),n=h(!1),d=h(null);$(async()=>{n.value=!0;const l=await M.getUpcomingSessions();n.value=!1,l.type==="ok"?t.value=l.data.slice(0,3):d.value=l.message});function v(l){return new Date(`${l}T12:00:00`).toLocaleDateString("nl-NL",{day:"numeric"})}function p(l){return new Date(`${l}T12:00:00`).toLocaleDateString("nl-NL",{month:"short"}).toUpperCase()}return(l,a)=>(r(),o("div",F,[s("section",J,[a[4]||(a[4]=s("h2",{class:"sessions__heading"},[s("i",{class:"pi pi-calendar","aria-hidden":"true"}),f(" Upcoming Sessions ")],-1)),n.value?(r(),o("div",K,[(r(),o(g,null,b(3,i=>s("div",{key:i,class:"session-card session-card--skeleton"},[m(_(y),{width:"3.5rem",height:"3.75rem","border-radius":"var(--ss-radius)"}),s("div",O,[m(_(y),{height:"1rem",class:"session-card__skel-title"}),m(_(y),{height:"0.8rem",width:"55%"})])])),64))])):d.value?(r(),o("div",q,[a[0]||(a[0]=s("i",{class:"pi pi-exclamation-circle sessions__empty-icon","aria-hidden":"true"},null,-1)),s("p",G,"Could not load sessions — "+c(d.value),1)])):t.value.length===0?(r(),o("div",H,[...a[1]||(a[1]=[s("i",{class:"pi pi-shield sessions__empty-icon","aria-hidden":"true"},null,-1),s("p",{class:"sessions__empty-text"},"No upcoming sessions. Enjoy the downtime, adventurer.",-1)])])):(r(),o("div",Q,[(r(!0),o(g,null,b(t.value,i=>(r(),o("div",{key:i.id,class:"session-card"},[s("div",W,[s("span",Y,c(v(i.date)),1),s("span",Z,c(p(i.date)),1)]),s("div",ee,[s("div",te,[s("span",se,c(i.title),1),m(_(B),{value:i.status==="assigned"?"Assigned":"Upcoming",severity:i.status==="assigned"?"success":"secondary",class:"session-card__tag"},null,8,["value","severity"])]),s("span",ne,[a[2]||(a[2]=s("i",{class:"pi pi-user","aria-hidden":"true"},null,-1)),f(" "+c(i.dmName??"Unknown DM"),1)]),i.isStoryAdventure?(r(),o("span",ae,[...a[3]||(a[3]=[s("i",{class:"pi pi-star-fill","aria-hidden":"true"},null,-1),f(" Story Adventure ",-1)])])):D("",!0)])]))),128))]))])]))}}),ce=A(ie,[["__scopeId","data-v-84ac7599"]]);export{ce as default};
