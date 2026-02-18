export const el = (id) => document.getElementById(id);
export const on = (node, evt, fn) => node && node.addEventListener(evt, fn);
