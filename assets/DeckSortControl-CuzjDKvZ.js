import{j as s}from"./index-D_FLfjBw.js";const n=[{key:"lastOpened",label:"Recent"},{key:"name",label:"Name"},{key:"dueCount",label:"Due"}],u=({currentSort:a,onSortChange:o,sortOptions:l})=>{const r=l??n;return s.jsx("div",{className:"inline-flex rounded-md shadow-sm bg-gray-100 dark:bg-gray-800 p-1",role:"group",children:r&&r.map((e,t)=>s.jsx("button",{type:"button",onClick:()=>o(e.key),className:`px-4 py-1.5 text-sm font-medium transition-colors focus:z-10 focus:outline-none focus:ring-2 focus:ring-blue-500
            ${a===e.key?"bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-300 shadow-sm":"text-gray-600 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-700/50"}
            ${t===0?"rounded-l-md":""}
            ${t===r.length-1?"rounded-r-md":""}
          `,"aria-pressed":a===e.key,children:e.label},e.key))})};export{u as D};
