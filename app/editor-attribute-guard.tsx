"use client";

import { useRef } from "react";
import { useServerInsertedHTML } from "next/navigation";

const SCRIPT = `(function(){var attr="data-cursor-ref";function drop(node){if(node&&node.removeAttribute&&node.hasAttribute&&node.hasAttribute(attr))node.removeAttribute(attr)}var observer=new MutationObserver(function(records){for(var i=0;i<records.length;i++)drop(records[i].target)});observer.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:[attr]});var original=Element.prototype.setAttribute;Element.prototype.setAttribute=function(name,value){if(name===attr)return;return original.call(this,name,value)};drop(document.documentElement);window.addEventListener("load",function(){setTimeout(function(){observer.disconnect();Element.prototype.setAttribute=original},2000)})})();`;

export default function EditorAttributeGuard() {
  const inserted = useRef(false);

  useServerInsertedHTML(() => {
    if (inserted.current) return null;
    inserted.current = true;
    return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
  });

  return null;
}
