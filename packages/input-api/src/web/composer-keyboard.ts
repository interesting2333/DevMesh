import type {KeyboardEvent} from 'react';

export const composerKeyboardHint='Enter 发送 · Shift + Enter 换行';

/** Use the actual submit button so keyboard sends share every availability check. */
export function handleComposerKeyDown(event:KeyboardEvent<HTMLTextAreaElement>,composing:boolean){
 if(event.defaultPrevented||event.key!=='Enter'||event.shiftKey||event.altKey)return;
 // keyCode 229 covers IME confirmation when compositionend precedes keydown.
 if(composing||event.nativeEvent.isComposing||event.nativeEvent.keyCode===229)return;
 event.preventDefault();
 if(event.repeat)return;
 const button=event.currentTarget.form?.querySelector<HTMLButtonElement>('button[type="submit"]');
 if(button&&!button.disabled)button.click();
}
