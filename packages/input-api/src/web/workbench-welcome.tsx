import {WorkbenchIcon as Icon} from './workbench-icons.js';

const examples=[
 {icon:'project',title:'搭建业务系统',description:'工单、审批、客户管理，让业务流程在线运转。',text:'帮我开发一个内部工单系统，支持提交工单、指派处理人、状态跟踪和按角色管理权限。'},
 {icon:'chart',title:'制作数据看板',description:'汇总关键指标，用图表清晰呈现数据变化。',text:'帮我制作一个运营数据看板，展示关键指标、趋势图和明细列表，支持按日期筛选和导出数据。'},
 {icon:'preview',title:'创建展示网站',description:'介绍产品与服务，兼顾电脑和手机浏览。',text:'帮我搭建一个产品展示网站，包含产品介绍、功能亮点、客户案例和联系表单，适配电脑与手机。'},
] as const;

export function WorkbenchWelcome({onUse}:{onUse:((text:string)=>void)|null}){
 return <section className="welcome" aria-label="任务起点">
  <h1>想完成什么任务？</h1><p>描述你的目标，或添加需求文件。</p>
  <div className="starter-heading"><span>试试这些需求</span><span>选用后可继续编辑</span></div>
  <div className="starter-examples" aria-label="需求示例">{examples.map(example=><button type="button" className="starter-example" key={example.title} aria-label={'使用示例：'+example.title} disabled={!onUse} onClick={()=>onUse?.(example.text)}>
   <span className="starter-top"><span className="starter-icon"><Icon name={example.icon}/></span><Icon name="arrow"/></span>
   <strong>{example.title}</strong><span className="starter-description">{example.description}</span>
  </button>)}</div>
 </section>;
}
