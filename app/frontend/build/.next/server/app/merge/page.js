(()=>{var e={};e.id=709,e.ids=[709],e.modules={846:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},1630:e=>{"use strict";e.exports=require("http")},2412:e=>{"use strict";e.exports=require("assert")},2680:(e,t,r)=>{"use strict";r.r(t),r.d(t,{GlobalError:()=>a.a,__next_app__:()=>m,pages:()=>c,routeModule:()=>u,tree:()=>d});var s=r(5239),n=r(8088),i=r(8170),a=r.n(i),o=r(893),l={};for(let e in o)0>["default","tree","pages","GlobalError","__next_app__","routeModule"].indexOf(e)&&(l[e]=()=>o[e]);r.d(t,l);let d={children:["",{children:["merge",{children:["__PAGE__",{},{page:[()=>Promise.resolve().then(r.bind(r,9346)),"/Users/nrbes/Projects/ChatCommit/frontend/app/merge/page.tsx"]}]},{metadata:{icon:[async e=>(await Promise.resolve().then(r.bind(r,6055))).default(e)],apple:[],openGraph:[],twitter:[],manifest:void 0}}]},{layout:[()=>Promise.resolve().then(r.bind(r,8014)),"/Users/nrbes/Projects/ChatCommit/frontend/app/layout.tsx"],"not-found":[()=>Promise.resolve().then(r.t.bind(r,7398,23)),"next/dist/client/components/not-found-error"],forbidden:[()=>Promise.resolve().then(r.t.bind(r,9999,23)),"next/dist/client/components/forbidden-error"],unauthorized:[()=>Promise.resolve().then(r.t.bind(r,5284,23)),"next/dist/client/components/unauthorized-error"],metadata:{icon:[async e=>(await Promise.resolve().then(r.bind(r,6055))).default(e)],apple:[],openGraph:[],twitter:[],manifest:void 0}}]}.children,c=["/Users/nrbes/Projects/ChatCommit/frontend/app/merge/page.tsx"],m={require:r,loadChunk:()=>Promise.resolve()},u=new s.AppPageRouteModule({definition:{kind:n.RouteKind.APP_PAGE,page:"/merge/page",pathname:"/merge",bundlePath:"",filename:"",appPaths:[]},userland:{loaderTree:d}})},2704:()=>{},2826:(e,t,r)=>{Promise.resolve().then(r.bind(r,6872))},3033:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},3295:e=>{"use strict";e.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},3442:(e,t,r)=>{Promise.resolve().then(r.bind(r,9346))},3492:(e,t,r)=>{Promise.resolve().then(r.t.bind(r,6444,23)),Promise.resolve().then(r.t.bind(r,6042,23)),Promise.resolve().then(r.t.bind(r,8170,23)),Promise.resolve().then(r.t.bind(r,9477,23)),Promise.resolve().then(r.t.bind(r,9345,23)),Promise.resolve().then(r.t.bind(r,2089,23)),Promise.resolve().then(r.t.bind(r,6577,23)),Promise.resolve().then(r.t.bind(r,1307,23))},3768:(e,t,r)=>{Promise.resolve().then(r.t.bind(r,9603,23))},3873:e=>{"use strict";e.exports=require("path")},4075:e=>{"use strict";e.exports=require("zlib")},4440:(e,t,r)=>{Promise.resolve().then(r.t.bind(r,6533,23))},4647:()=>{},4735:e=>{"use strict";e.exports=require("events")},5511:e=>{"use strict";e.exports=require("crypto")},5591:e=>{"use strict";e.exports=require("https")},6055:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>n});var s=r(1658);let n=async e=>[{type:"image/x-icon",sizes:"16x16",url:(0,s.fillMetadataSegment)(".",await e.params,"favicon.ico")+""}]},6228:(e,t,r)=>{Promise.resolve().then(r.t.bind(r,6346,23)),Promise.resolve().then(r.t.bind(r,7924,23)),Promise.resolve().then(r.t.bind(r,5656,23)),Promise.resolve().then(r.t.bind(r,2480,23)),Promise.resolve().then(r.t.bind(r,8243,23)),Promise.resolve().then(r.t.bind(r,8827,23)),Promise.resolve().then(r.t.bind(r,2763,23)),Promise.resolve().then(r.t.bind(r,7173,23))},6872:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>a});var s=r(687),n=r(3210),i=r(1060);function a(){let[e,t]=(0,n.useState)([]),[r,a]=(0,n.useState)(""),[o,l]=(0,n.useState)(""),[d,c]=(0,n.useState)(""),[m,u]=(0,n.useState)(!0),[p,h]=(0,n.useState)(""),x=async()=>{if(!r||!o||r===o){alert("Please select two different branches.");return}c("Merging...");try{let e=await i.A.post("https://chatcommit.fly.dev/merge",{source_branch_id:parseInt(r),target_branch_id:parseInt(o)});c(e.data.message)}catch(e){console.error("Merge failed:",e),c(e.response?.data?.detail||"Merge failed.")}};return m?(0,s.jsx)("p",{className:"p-6 text-white",children:"Loading branches…"}):p?(0,s.jsx)("p",{className:"p-6 text-red-500",children:p}):(0,s.jsxs)("div",{className:"max-w-xl mx-auto p-6 text-white bg-gray-900 rounded-lg",children:[(0,s.jsx)("h2",{className:"text-xl font-bold mb-4",children:"Merge Branches"}),(0,s.jsxs)("div",{className:"mb-4",children:[(0,s.jsx)("label",{className:"block mb-1",children:"Source Branch"}),(0,s.jsxs)("select",{value:r,onChange:e=>a(e.target.value),className:"w-full p-2 border rounded bg-gray-800 text-gray-100",children:[(0,s.jsx)("option",{value:"",children:"Select source branch"}),e.map(e=>(0,s.jsx)("option",{value:e.id,children:e.name},e.id))]})]}),(0,s.jsxs)("div",{className:"mb-4",children:[(0,s.jsx)("label",{className:"block mb-1",children:"Target Branch"}),(0,s.jsxs)("select",{value:o,onChange:e=>l(e.target.value),className:"w-full p-2 border rounded bg-gray-800 text-gray-100",children:[(0,s.jsx)("option",{value:"",children:"Select target branch"}),e.map(e=>(0,s.jsx)("option",{value:e.id,children:e.name},e.id))]})]}),(0,s.jsx)("button",{onClick:x,className:"bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700",children:"Merge"}),d&&(0,s.jsx)("div",{className:"mt-4 p-3 bg-gray-700 rounded text-sm",children:d})]})}},7910:e=>{"use strict";e.exports=require("stream")},8014:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>c,metadata:()=>d});var s=r(7413),n=r(3384),i=r(6389),a=r.n(i),o=r(1189),l=r.n(o);r(2704);let d={title:"ChatCommit",description:"Git-like version control for ChatGPT sessions"};function c({children:e}){return(0,s.jsx)("html",{lang:"en",children:(0,s.jsxs)("body",{className:`${a().variable} ${l().variable} antialiased bg-black text-gray-100`,children:[(0,s.jsxs)("header",{className:"flex items-center p-4 border-b border-green-800",children:[(0,s.jsx)("div",{className:"flex flex-col items-center mr-4",children:(0,s.jsx)(n.default,{src:"/chatcommit-logo.webp",alt:"ChatCommit Logo",width:100,height:100})}),(0,s.jsxs)("div",{children:[(0,s.jsx)("h1",{className:"text-2xl font-bold",style:{color:"#ff6600"},children:"ChatCommit"}),(0,s.jsx)("p",{className:"text-xs mt-1 text-gray-400",children:"\xa9 2025 Tully EDM Vibe \xa0|\xa0 info@tullyedmvibe.com"})]})]}),(0,s.jsx)("main",{children:e})]})})}},8354:e=>{"use strict";e.exports=require("util")},9021:e=>{"use strict";e.exports=require("fs")},9121:e=>{"use strict";e.exports=require("next/dist/server/app-render/action-async-storage.external.js")},9294:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-async-storage.external.js")},9346:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>s});let s=(0,r(2907).registerClientReference)(function(){throw Error("Attempted to call the default export of \"/Users/nrbes/Projects/ChatCommit/frontend/app/merge/page.tsx\" from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"/Users/nrbes/Projects/ChatCommit/frontend/app/merge/page.tsx","default")},9551:e=>{"use strict";e.exports=require("url")}};var t=require("../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),s=t.X(0,[447,684,517],()=>r(2680));module.exports=s})();