const paths={
 mesh:'M4 5h6v6H4z M14 13h6v6h-6z M14 5h6v4h-6z M4 15h6v4H4z M10 8h4 M7 11v4 M17 9v4 M10 17h4',
 plus:'M12 5v14 M5 12h14',
 project:'M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z',
 task:'M9 5h10v15H5V5h4 M9 3h6v4H9z M8 12h8 M8 16h5',
 team:'M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2 M16 4a4 4 0 0 1 0 8 M21 20v-2a4 4 0 0 0-3-3 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
 artifact:'M4 8l8-4 8 4v10l-8 4-8-4V8z M4 8l8 4 8-4 M12 12v10',
 preview:'M3 4h18v13H3z M8 21h8 M12 17v4 M3 8h18',
 record:'M6 3h9l4 4v14H6z M14 3v5h5 M9 12h7 M9 16h7',
 refresh:'M20 7v5h-5 M4 17v-5h5 M6 7a7 7 0 0 1 12-1l2 3 M4 15l2 3a7 7 0 0 0 12-1',
 arrow:'M5 12h14 M13 6l6 6-6 6',
 chat:'M4 4h16v12H9l-5 4V4z M8 8h8 M8 12h5',
 more:'M5 12h.01 M12 12h.01 M19 12h.01',
};
export function WorkbenchIcon({name,className=''}:{name:keyof typeof paths;className?:string}){
 return <svg className={'ui-icon '+className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]}/></svg>;
}
