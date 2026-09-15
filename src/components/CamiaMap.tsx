"use client";

import * as d3 from "d3";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Category, categoryLabels, mapLinks, mapNodes, MapNode } from "@/data/fenerbahce-map";
import { CommunityVote } from "@/components/CommunityVote";
import { VoteLeaderboard } from "@/components/VoteLeaderboard";

type SimNode = MapNode & d3.SimulationNodeDatum & { width:number; height:number; targetX:number; targetY:number; branchAngle?:number };
type SimLink = d3.SimulationLinkDatum<SimNode> & { tree:boolean };
const W=21000,H=21000;
const CX=W/2,CY=H/2;
const colors:Record<Category,string>={root:"#ffed00",management:"#4f70b5",coaches:"#7d79c8",players:"#26a69a",countries:"#ef8c45",branches:"#df6689",stands:"#5a99cc",social:"#8d6aaf",scout:"#5b9571",nostalgia:"#b07855",media:"#d55d62",micro:"#78909c"};
const normalize=(s:string)=>s.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g,"");

function XIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817-5.967 6.817H1.68l7.73-8.835L1.254 2.25h6.826l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"/></svg>}
function GitHubIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.23c-3.22.7-3.9-1.36-3.9-1.36-.52-1.34-1.28-1.7-1.28-1.7-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.74.4-1.25.73-1.54-2.57-.3-5.28-1.29-5.28-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.16 1.18a10.97 10.97 0 0 1 5.75 0C17.03 4.93 18 5.24 18 5.24c.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.71 5.39-5.29 5.68.42.36.79 1.06.79 2.14v3.35c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z"/></svg>}

function createLayout(source:MapNode[]):SimNode[]{
  const childCount=new Map<string,number>(); source.forEach(n=>{if(n.parent)childCount.set(n.parent,(childCount.get(n.parent)??0)+1);});
  const nodes:SimNode[]=source.map(d=>{const family=childCount.get(d.id)??0;const isRoot=d.category==="root";const isBranch=d.parent==="fenerbahce";return {...d,width:isRoot?400:Math.max(72,Math.min(isBranch?250:190,d.label.length*7+30+d.importance*4+(isBranch?Math.min(64,family*4):0))),height:isRoot?400:isBranch?62+Math.min(24,family*1.2):d.importance>=3?46:38,targetX:0,targetY:0};});
  const byId=new Map(nodes.map(n=>[n.id,n]));const center=byId.get("fenerbahce")!;center.x=center.targetX=CX;center.y=center.targetY=CY;
  const childrenByParent=new Map<string,SimNode[]>();nodes.forEach(n=>{if(!n.parent)return;const list=childrenByParent.get(n.parent)??[];list.push(n);childrenByParent.set(n.parent,list);});
  const branches=childrenByParent.get("fenerbahce")??[];
  const branchRadius=6500;
  branches.forEach((branch,branchIndex)=>{
    const angle=Math.PI*2*branchIndex/branches.length-Math.PI/2;
    const radialX=Math.cos(angle),radialY=Math.sin(angle),tangentX=-radialY,tangentY=radialX;
    branch.branchAngle=angle;branch.x=branch.targetX=CX+radialX*branchRadius;branch.y=branch.targetY=CY+radialY*branchRadius;
    const descendants:Array<{node:SimNode;depth:number}>=[];
    const visit=(id:string,depth:number)=>{(childrenByParent.get(id)??[]).forEach(child=>{descendants.push({node:child,depth});visit(child.id,depth+1);});};
    visit(branch.id,1);
    descendants.forEach(({node,depth},index)=>{
      const row=Math.floor(index/2),side=index%2===0?-1:1;
      const along=260+row*95;
      const lateral=side*(105+node.width/2+(depth-1)*135);
      node.branchAngle=angle;
      node.x=node.targetX=CX+radialX*(branchRadius+along)+tangentX*lateral;
      node.y=node.targetY=CY+radialY*(branchRadius+along)+tangentY*lateral;
    });
  });
  nodes.filter(n=>!n.parent&&n.id!=="fenerbahce").forEach((node,index)=>{node.x=node.targetX=350+index*260;node.y=node.targetY=H-220;});
  return nodes;
}

function wrapText(selection:d3.Selection<SVGTextElement,SimNode,SVGGElement,unknown>){
  selection.each(function(d){
    const el=d3.select(this), words=d.label.split(/\s+/); el.text("");
    const lines:string[]=[]; let line=""; const limit=Math.max(8,Math.floor(d.width/7.5));
    words.forEach(word=>{ const next=line?`${line} ${word}`:word; if(next.length>limit&&line){lines.push(line);line=word}else line=next; }); lines.push(line);
    const start=-(lines.length-1)*7;
    lines.forEach((value,i)=>el.append("tspan").attr("x",0).attr("y",start+i*14).text(value));
  });
}

export function CamiaMap(){
  const svgRef=useRef<SVGSVGElement>(null); const zoomRef=useRef<d3.ZoomBehavior<SVGSVGElement,unknown>|null>(null);
  const positions=useRef(new Map<string,SimNode>()); const [selected,setSelected]=useState<MapNode|null>(null); const [query,setQuery]=useState(""); const [hint,setHint]=useState("Bir lobi ara veya haritayı keşfet");
  const connections=useMemo(()=>selected?mapLinks.filter(l=>l.source===selected.id||l.target===selected.id).map(l=>mapNodes.find(n=>n.id===(l.source===selected.id?l.target:l.source))!).filter(Boolean):[],[selected]);

  useEffect(()=>{
    const svg=d3.select(svgRef.current!); svg.selectAll("*").remove();
    const defs=svg.append("defs");
    defs.append("marker").attr("id","edge-arrow").attr("viewBox","0 -5 10 10").attr("refX",13).attr("refY",0).attr("markerWidth",5).attr("markerHeight",5).attr("orient","auto").append("path").attr("d","M0,-5L10,0L0,5Z").attr("fill","#244a82");
    const scene=svg.append("g").attr("class","scene"); const linksLayer=scene.append("g").attr("class","links"); const nodesLayer=scene.append("g").attr("class","nodes");
    const nodes=createLayout(mapNodes);
    const byId=new Map(nodes.map(n=>[n.id,n])); positions.current=byId;
    const links:SimLink[]=mapLinks.flatMap(l=>{const source=byId.get(l.source),target=byId.get(l.target);return source&&target?[{source,target,tree:target.parent===source.id}]:[];});
    const link=linksLayer.selectAll("path").data(links).join("path").attr("class",d=>`edge ${d.tree?"tree-link":"cross-link"}`).attr("fill","none").attr("marker-end",d=>d.tree?"url(#edge-arrow)":null).attr("stroke-width",d=>((d.target as SimNode).importance>=4?4.6:3.2));
    const node=nodesLayer.selectAll<SVGGElement,SimNode>("g").data(nodes).join("g").attr("class",d=>`node node-${d.importance}`).attr("tabindex",0).attr("role","button").attr("aria-label",d=>d.label);
    node.filter(d=>d.category!=="root").append("rect").attr("x",d=>-d.width/2).attr("y",d=>-d.height/2).attr("width",d=>d.width).attr("height",d=>d.height).attr("rx",d=>d.height/2).attr("fill","#fbfaf5").attr("stroke",d=>colors[d.category]).attr("stroke-width",d=>d.importance>=4?3:1.7);
    node.filter(d=>d.category==="root").append("circle").attr("r",200).attr("fill","#fff").attr("stroke","#ffed00").attr("stroke-width",10);
    node.filter(d=>d.category==="root").append("image").attr("href","/fenerbahce-logo.png").attr("x",-185).attr("y",-185).attr("width",370).attr("height",370).attr("preserveAspectRatio","xMidYMid meet");
    node.filter(d=>d.category!=="root").append("text").attr("class","node-label").attr("text-anchor","middle").attr("dominant-baseline","middle").call(wrapText);
    const adjacency=new Map<string,Set<string>>(); for(const l of mapLinks){if(!adjacency.has(l.source))adjacency.set(l.source,new Set([l.source]));if(!adjacency.has(l.target))adjacency.set(l.target,new Set([l.target]));adjacency.get(l.source)!.add(l.target);adjacency.get(l.target)!.add(l.source);}
    node.classed("selected",d=>d.id===selected?.id).on("mouseenter",(_,d)=>{const ids=adjacency.get(d.id)??new Set([d.id]);node.classed("dim",n=>!ids.has(n.id)).classed("active",n=>n.id===d.id);link.classed("active",l=>(l.source as SimNode).id===d.id||(l.target as SimNode).id===d.id).classed("dim",l=>(l.source as SimNode).id!==d.id&&(l.target as SimNode).id!==d.id);setHint(d.label);}).on("mouseleave",()=>{node.classed("dim active",false);link.classed("dim active",false);setHint("Bir lobi ara veya haritayı keşfet");}).on("click",(_,d)=>{node.classed("selected",n=>n.id===d.id);setSelected(d);});
    node.attr("transform",d=>`translate(${d.x},${d.y})`); link.attr("d",(d,index)=>{const source=d.source as SimNode,target=d.target as SimNode;if(d.tree&&source.id!=="fenerbahce"&&target.branchAngle!==undefined){const rx=Math.cos(target.branchAngle),ry=Math.sin(target.branchAngle);const sourceAlong=(source.x!-CX)*rx+(source.y!-CY)*ry;const targetAlong=(target.x!-CX)*rx+(target.y!-CY)*ry;const sourceSpineX=CX+rx*sourceAlong,sourceSpineY=CY+ry*sourceAlong;const targetSpineX=CX+rx*targetAlong,targetSpineY=CY+ry*targetAlong;return `M${source.x},${source.y}L${sourceSpineX},${sourceSpineY}L${targetSpineX},${targetSpineY}L${target.x},${target.y}`;}const dx=target.x!-source.x!,dy=target.y!-source.y!;const length=Math.hypot(dx,dy)||1;const bend=(index%9-4)*18;const mx=(source.x!+target.x!)/2-dy/length*bend,my=(source.y!+target.y!)/2+dx/length*bend;return `M${source.x},${source.y}Q${mx},${my} ${target.x},${target.y}`;});
    const initialScale=window.innerWidth<=760?.42:.62; const zoom=d3.zoom<SVGSVGElement,unknown>().scaleExtent([.06,3]).on("zoom",e=>scene.attr("transform",e.transform)); zoomRef.current=zoom; svg.call(zoom).call(zoom.transform,d3.zoomIdentity.translate(svgRef.current!.clientWidth/2,svgRef.current!.clientHeight/2).scale(initialScale).translate(-CX,-CY));
    const focusCamia=(event:Event)=>{const id=(event as CustomEvent<string>).detail;const target=byId.get(id),mapNode=mapNodes.find(item=>item.id===id),el=svgRef.current;if(!target||!mapNode||!el)return;setSelected(mapNode);setHint(`${mapNode.label} bulundu`);node.classed("selected",item=>item.id===id);svg.transition().duration(650).call(zoom.transform,d3.zoomIdentity.translate(el.clientWidth/2,el.clientHeight/2).scale(.65).translate(-target.x!,-target.y!));};
    window.addEventListener("camia-focus",focusCamia);
    return()=>window.removeEventListener("camia-focus",focusCamia);
  },[]);

  function search(e:FormEvent){e.preventDefault();const q=normalize(query.trim());if(!q)return;const match=mapNodes.find(n=>normalize(n.label).includes(q));if(!match){setHint("Eşleşme bulunamadı");return;}setSelected(match);setHint(`${match.label} bulundu`);const node=positions.current.get(match.id),el=svgRef.current;if(!node||!el)return;d3.select(el).selectAll<SVGGElement,SimNode>(".node").classed("selected",d=>d.id===match.id);d3.select(el).transition().duration(650).call(zoomRef.current!.transform,d3.zoomIdentity.translate(el.clientWidth/2,el.clientHeight/2).scale(.65).translate(-node.x!,-node.y!));}
  return <div className="map-shell">
    <header className="topbar"><form onSubmit={search}><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Alex, Ersun, Aziz, Mourinho…"/><kbd>Enter</kbd></form><VoteLeaderboard/></header>
    <div className="status"><span className="live-dot"/>{hint}</div><svg ref={svgRef} className="graph" width="100%" height="100%" aria-label="Fenerbahçe lobi grafiği"/>
    <div className="controls"><button onClick={()=>svgRef.current&&d3.select(svgRef.current).transition().call(zoomRef.current!.scaleBy,1.25)}>+</button><button onClick={()=>svgRef.current&&d3.select(svgRef.current).transition().call(zoomRef.current!.scaleBy,.8)}>−</button><button title="Haritayı ortala" onClick={()=>{const el=svgRef.current;if(!el)return;const scale=Math.max(.13,Math.min(el.clientWidth/W,(el.clientHeight-84)/H)*.93);d3.select(el).transition().call(zoomRef.current!.transform,d3.zoomIdentity.translate(el.clientWidth/2,el.clientHeight/2).scale(scale).translate(-W/2,-H/2));}}>⌂</button></div>
    {selected&&<aside className="detail"><button className="close" onClick={()=>{setSelected(null);if(svgRef.current)d3.select(svgRef.current).selectAll(".node").classed("selected",false);}}>×</button><span className="eyebrow">{categoryLabels[selected.category]}</span><h2>{selected.label}</h2><p>{selected.description}</p>{selected.category!=="root"&&<CommunityVote communityId={selected.id} label={selected.label}/>}<div className="rule"/><h3>Bağlı gruplar <b>{connections.length}</b></h3><ul>{connections.map(n=><li key={n.id}><i style={{background:colors[n.category]}}/>{n.label}</li>)}</ul></aside>}
    <footer><span>Boş alanda sürükle: gezin</span><span>Scroll: zoom</span><span>Node'a tıkla: detay</span></footer>
    <nav className="credits" aria-label="Bağlantılar">
      <a href="https://x.com/5stellix8" target="_blank" rel="noopener noreferrer"><XIcon/><b>@5stellix8</b></a>
      <a href="https://github.com/metehankasapp/fenerbahce-map" target="_blank" rel="noopener noreferrer"><GitHubIcon/><b>GitHub</b></a>
    </nav>
  </div>;
}
