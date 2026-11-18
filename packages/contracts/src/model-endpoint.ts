/** Accept either an API base or its full chat completion endpoint. */
export function modelApiBase(endpoint:string):string{
 return endpoint.replace(/\/+$/u,'').replace(/\/chat\/completions$/u,'');
}
