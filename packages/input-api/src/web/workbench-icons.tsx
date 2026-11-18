const paths={
 trash:'M4 7h16 M9 7V4h6v3 M6 7l1 14h10l1-14 M10 11v6 M14 11v6',
 play:'M8 4l12 8-12 8V4z',
 check:'M5 12l4 4L19 6',
 edit:'M4 20l4-1 12-12-3-3L5 16l-1 4z M14 7l3 3',
 down:'M12 4v16 M6 14l6 6 6-6',
 chart:'M4 4v16h17 M8 15v-4 M13 15V7 M18 15v-6',
 paperclip:'M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.4a2 2 0 0 1-2.83-2.83l8.49-8.48',
 mesh:'M8 17 15 6 M16 17h1 M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4 M16 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4 M19 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
 search:'M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15 M16 16l5 5',
 panel:'M3 4h18v16H3z M9 4v16 M6 8h.01 M6 12h.01',
 chevron:'M7 10l5 5 5-5',
 send:'M12 20V4 M6 10l6-6 6 6',
 settings:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3 M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
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
