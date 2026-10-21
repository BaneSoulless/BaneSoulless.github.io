/* v2/assets/helpers.js — funzioni condivise estratte dal motore v1 */
function pulisciSnippet(t) {
  if (!t) return "";
  var s = String(t);
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  s = s.replace(/^[ 	]*#{1,6}[ 	]*/gm, "");
  s = s.replace(/^[ 	]*[-*+][ 	]+/gm, "· ");
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1");
  s = s.replace(/[*_`~|]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > 260) s = s.slice(0, 257).replace(/[\s,;:.]$/, "") + "…";
  return s;
}
