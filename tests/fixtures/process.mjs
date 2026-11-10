// Cold Node/Worker startup is not the operation deadline being verified.
// Keep this bounded, clear every listener/timer, and kill only owned children.
export const processTestTimeoutMs = 120000;
export function waitForProcessMessage(child, describe, diagnostics = () => '') {
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); child.off('message', message); child.off('error', error); child.off('exit', exit); };
    const message = value => { cleanup(); resolve(value); };
    const error = cause => { cleanup(); reject(cause); };
    const exit = code => error(new Error(`${describe} exited (${code}): ${diagnostics()}`));
    const timer = setTimeout(() => error(new Error(`${describe} did not reach its cutpoint within ${processTestTimeoutMs}ms: ${diagnostics()}`)), processTestTimeoutMs); timer.unref();
    child.once('message', message); child.once('error', error); child.once('exit', exit);
  });
}
