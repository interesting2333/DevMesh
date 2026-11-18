import {useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {KeyboardEvent} from 'react';
import type {Mode} from './conversation-local.js';
import {WorkbenchIcon as Icon} from './workbench-icons.js';

const choices=[
 {value:'EXECUTE',label:'执行模式',icon:'play',description:'理解需求后，按目标推进实现与验证。'},
 {value:'PLAN',label:'计划模式',icon:'task',description:'先分析并提供方案，等你确认后再实施。'},
] as const;

export function ConversationMode({value,disabled,execution,onChange}:{value:Mode;disabled:boolean;execution:boolean|null;onChange:(mode:Mode)=>void}){
 const [open,setOpen]=useState(false),[active,setActive]=useState(0),[position,setPosition]=useState({left:0,top:0,maxHeight:400}),trigger=useRef<HTMLButtonElement|null>(null),menu=useRef<HTMLDivElement|null>(null),popupId=useId(),helpId=useId();
 const selected=choices.find(c=>c.value===value)!;
 function close(focus=false){setOpen(false);if(focus)trigger.current?.focus();}
 function show(){if(disabled)return;setActive(choices.findIndex(c=>c.value===value));setOpen(true);}
 function choose(mode:Mode){if(disabled)return;onChange(mode);close(true);}
 useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
 useLayoutEffect(()=>{if(!open)return;
  const measure=()=>{if(!trigger.current||!menu.current)return;const rect=trigger.current.getBoundingClientRect(),width=Math.min(320,innerWidth-24),height=menu.current.scrollHeight,above=rect.top-20,below=innerHeight-rect.bottom-20,up=above>=height||above>=below,available=Math.max(80,up?above:below);setPosition({left:Math.max(12,Math.min(rect.right-width,innerWidth-width-12)),top:up?Math.max(12,rect.top-Math.min(height,available)-8):rect.bottom+8,maxHeight:available});};
  measure();const observer=new ResizeObserver(measure);if(menu.current)observer.observe(menu.current);window.addEventListener('resize',measure);window.addEventListener('scroll',measure,true);
  return()=>{observer.disconnect();window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true);};
 },[open,execution]);
 useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!trigger.current?.contains(e.target as Node)&&!menu.current?.contains(e.target as Node))close();};document.addEventListener('pointerdown',outside,true);return()=>document.removeEventListener('pointerdown',outside,true);},[open]);
 function keyboard(e:KeyboardEvent<HTMLButtonElement>){
  if(e.key==='Escape'&&open){e.preventDefault();e.stopPropagation();close(true);return;}
  if(e.key==='Tab'){close();return;}
  if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();if(!open){show();return;}setActive(previous=>e.key==='Home'?0:e.key==='End'?choices.length-1:(previous+(e.key==='ArrowDown'?1:-1)+choices.length)%choices.length);return;}
  if(open&&(e.key==='Enter'||e.key===' ')){e.preventDefault();choose(choices[active]!.value);}
 }
 return <><button type="button" ref={trigger} className="conversation-mode-trigger" role="combobox" aria-label="工作模式" aria-haspopup="listbox" aria-controls={open?popupId:undefined} aria-expanded={open} aria-activedescendant={open?popupId+'-'+active:undefined} aria-describedby={helpId} data-mode={value} disabled={disabled} onClick={()=>open?close():show()} onKeyDown={keyboard} onBlur={e=>{if(!menu.current?.contains(e.relatedTarget as Node))close();}}><Icon name={selected.icon}/><span>{selected.label}</span><Icon name="chevron"/></button><span id={helpId} className="sr-only">{selected.description}选择将在下次发送时生效，不会立即暂停正在进行的任务。</span>
 {open&&createPortal(<div className="conversation-mode-popover" ref={menu} style={{left:position.left,top:position.top,maxHeight:position.maxHeight}} onPointerDown={e=>e.preventDefault()}>
  <p className="mode-menu-heading">本次处理方式</p><div id={popupId} role="listbox" aria-label="选择工作模式">{choices.map((choice,index)=><div key={choice.value} id={popupId+'-'+index} className={'mode-menu-option'+(index===active?' active':'')} role="option" aria-selected={value===choice.value} onPointerMove={()=>setActive(index)} onClick={()=>choose(choice.value)}><span className="mode-option-icon"><Icon name={choice.icon}/></span><div className="mode-option-content"><span className="mode-option-title">{choice.label}{choice.value==='EXECUTE'&&execution===false&&<span className="mode-unavailable">环境未连接</span>}</span><p>{choice.description}</p>{choice.value==='EXECUTE'&&execution===false&&<p className="mode-environment-note">当前可讨论与规划，暂时不能运行代码。</p>}</div><span className="mode-option-check">{value===choice.value&&<Icon name="check"/>}</span></div>)}</div><p className="mode-menu-footnote">下次发送时生效 · 正在进行的任务需单独暂停</p>
 </div>,document.body)}</>;
}
