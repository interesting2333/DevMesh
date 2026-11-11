import {RunnerClient} from '../../packages/runner/dist/index.mjs';
import {LocalRunnerWorkspaceFencer} from '../../packages/code-workspaces/dist/index.mjs';
// Dedicated synthetic test child. It keeps its OS lock until the parent kills it.
process.once('message',async({options,input,endpoint})=>{
 try{const runner=new RunnerClient(endpoint,'fixture.local',async()=> 'runner-fencing-fixture-service-secret'),fencer=new LocalRunnerWorkspaceFencer({...options,runner});await fencer.acquire(input,new AbortController().signal);const fence=await runner.activeWorkspaceFence(input.resourceId);process.send({fenceId:fence.fenceId,holderToken:fence.holderToken});setInterval(()=>{},1000);}
 catch(error){process.send({error:error.code??error.message});process.exitCode=1;process.disconnect();}
});
