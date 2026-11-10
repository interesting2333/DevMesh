import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const ledgerFile = resolve(root, 'project/tasks.json');
const boardFile = resolve(root, 'project/任务台账.md');
const sourceFile = 'DevMesh_实施文档_V1.0.md';
const statuses = ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE'];
const gateStatuses = ['PENDING', 'IN_REVIEW', 'FAILED', 'PASSED'];
const read = path => readFileSync(resolve(root, path), 'utf8');
const sha256 = path => createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const validDate = value => nonempty(value) && Number.isFinite(Date.parse(value));
const cell = value => String(value ?? '待认领').replaceAll('|', '\\|').replaceAll('\n', ' ');

function sourceTasks() {
  return read(sourceFile).split(/\r?\n/).filter(line => /^\| P[0-4]-\d{2} \|/.test(line)).map(line => {
    const [id, ownership, description, deliverables, acceptance] = line.split('|').slice(1, -1).map(v => v.trim());
    const [responsibility, dependencies] = ownership.split('；');
    return { id, responsibility, dependsOn: dependencies.match(/P[0-4]-\d{2}/g) ?? [], description, deliverables, acceptance };
  });
}

function changePath(change) {
  const active = `openspec/changes/${change}`;
  if (existsSync(resolve(root, active, '.openspec.yaml'))) return active;
  const archive = resolve(root, 'openspec/changes/archive');
  const matches = existsSync(archive) ? readdirSync(archive, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}-/.test(entry.name) && entry.name.slice(11) === change) : [];
  return matches.length === 1 ? `openspec/changes/archive/${matches[0].name}` : null;
}

function validate(data) {
  const errors = [];
  const require = (condition, message) => { if (!condition) errors.push(message); };
  const hasEvidence = (references, label) => {
    require(Array.isArray(references) && references.length > 0, `${label} 需要验收记录引用`);
    for (const ref of references ?? []) {
      if (!nonempty(ref)) { errors.push(`${label} 的证据引用为空`); continue; }
      if (/^https:\/\//.test(ref)) continue;
      const target = resolve(root, ref.split('#')[0]);
      const fromRoot = relative(root, target);
      require(!isAbsolute(fromRoot) && fromRoot !== '..' && !fromRoot.startsWith('..\\') && !fromRoot.startsWith('../') && existsSync(target), `${label} 引用必须为仓库内现有记录或 HTTPS 链接：${ref}`);
    }
  };
  require(data.schemaVersion === 1, '不支持的台账 schemaVersion');
  require(Array.isArray(data.tasks) && Array.isArray(data.gates), '缺少 tasks/gates');
  if (errors.length) return errors;
  const tasks = new Map(data.tasks.map(task => [task.id, task]));
  const gates = new Map(data.gates.map(gate => [gate.id, gate]));
  const source = sourceTasks();
  require(tasks.size === data.tasks.length, '工作包编号重复');
  require(gates.size === 5 && data.gates.length === 5, '必须保留 G0～G4 五个门槛');
  require(source.length === tasks.size, '台账任务数与实施文档不一致');
  require(data.baselines?.length === 4, '需要 PRD、技术设计、验收场景、实施文档四份基线');
  for (const baseline of data.baselines ?? []) {
    require(existsSync(resolve(root, baseline.file)) && sha256(baseline.file) === baseline.sha256, `基线已变化，请通过变更评估并更新台账基线：${baseline.file}`);
  }
  for (const row of source) {
    const task = tasks.get(row.id);
    require(Boolean(task), `缺少工作包 ${row.id}`);
    if (!task) continue;
    for (const key of ['responsibility', 'description', 'deliverables', 'acceptance', 'dependsOn']) {
      require(JSON.stringify(task[key]) === JSON.stringify(row[key]), `${row.id} 的 ${key} 与实施文档不一致`);
    }
  }
  const visited = new Set();
  const visiting = new Set();
  function visit(id) {
    if (visited.has(id) || !tasks.has(id)) return;
    if (visiting.has(id)) { errors.push(`工作包依赖形成循环：${id}`); return; }
    visiting.add(id);
    for (const dependency of tasks.get(id).dependsOn ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  }
  for (const task of data.tasks) {
    const label = task.id;
    require(/^P[0-4]-\d{2}$/.test(label), `非法工作包编号 ${label}`);
    require(task.phase === label.slice(0, 2), `${label} 阶段不一致`);
    require(nonempty(task.title), `${label} 缺少标题`);
    require(statuses.includes(task.status), `${label} 状态非法`);
    require(Array.isArray(task.dependsOn), `${label} 的 dependsOn 必须是数组`);
    require(Array.isArray(task.codeReferences) && Array.isArray(task.evidence) && Array.isArray(task.notes), `${label} 的代码、证据与备注必须是数组`);
    for (const id of task.dependsOn ?? []) require(tasks.has(id) && id !== label, `${label} 的前置任务无效：${id}`);
    for (const change of task.changes ?? []) {
      require(/^[a-z][a-z0-9-]*$/.test(change) && Boolean(changePath(change)), `${label} 关联的 OpenSpec 变更不存在或名称不安全：${change}`);
    }
    if (task.status !== 'NOT_STARTED') require(nonempty(task.owner) && validDate(task.startedAt), `${label} 需要实际负责人和开始日期`);
    if (task.status === 'BLOCKED') require(nonempty(task.blockedReason) && nonempty(task.nextCheck), `${label} 阻塞必须写明原因和下一次核实条件`);
    if (['IN_PROGRESS', 'IN_REVIEW', 'DONE'].includes(task.status)) {
      for (const dependency of task.dependsOn ?? []) require(tasks.get(dependency)?.status === 'DONE', `${label} 的前置 ${dependency} 尚未 DONE`);
      const phase = Number(task.phase.slice(1));
      if (phase > 0) require(gates.get(`G${phase - 1}`)?.status === 'PASSED', `${label} 所需 G${phase - 1} 尚未通过`);
    }
    if (['IN_REVIEW', 'DONE'].includes(task.status)) {
      require(task.codeReferences?.some(nonempty), `${label} 需要提交或 PR 引用`);
      hasEvidence(task.evidence, label);
    }
    if (task.status === 'DONE') {
      require(nonempty(task.reviewer) && nonempty(task.reviewNote), `${label} 需要复核人和结论`);
      require(validDate(task.completedAt) && Date.parse(task.completedAt) >= Date.parse(task.startedAt), `${label} 完成时间无效`);
    } else require(task.completedAt === null, `${label} 未完成时不能填写 completedAt`);
    visit(label);
  }
  for (let index = 0; index <= 4; index++) {
    const gate = gates.get(`G${index}`);
    require(Boolean(gate), `缺少 G${index}`);
    if (!gate) continue;
    require(gate.phase === `P${index}` && gateStatuses.includes(gate.status), `${gate.id} 阶段或状态无效`);
    if (gate.status === 'PASSED') {
      require(data.tasks.filter(task => task.phase === gate.phase).every(task => task.status === 'DONE'), `${gate.id} 所属任务未全部 DONE`);
      if (index > 0) require(gates.get(`G${index - 1}`)?.status === 'PASSED', `${gate.id} 的上一阶段尚未通过`);
      require(nonempty(gate.owner) && nonempty(gate.reviewer) && nonempty(gate.buildRef) && nonempty(gate.decision) && validDate(gate.reviewedAt), `${gate.id} 缺少实际评审信息`);
      hasEvidence(gate.evidence, gate.id);
    }
  }
  return errors;
}

function waits(task, data) {
  const dependencies = task.dependsOn.filter(id => data.tasks.find(t => t.id === id)?.status !== 'DONE');
  const phase = Number(task.phase.slice(1));
  if (phase > 0 && data.gates.find(gate => gate.id === `G${phase - 1}`)?.status !== 'PASSED') dependencies.push(`G${phase - 1}`);
  return dependencies;
}

function render(data) {
  const lines = [
    '# DevMesh 项目任务台账', '',
    '> 本文件由 `node project/manage.mjs render` 生成，请修改唯一状态源 `project/tasks.json`。',
    '> 关联 OpenSpec 变更代表已有实施草案；待办勾选和结构校验不等于功能验收通过。', '',
    '实施范围：P0～P4，36 个工作包。任务、依赖和验收要求来自 [实施文档](../DevMesh_实施文档_V1.0.md)。', '',
    '## 总览', '', '| 阶段 | 总数 | 未开始 | 进行中 | 阻塞 | 待复核 | 已完成 | 阶段门槛 |', '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (let i = 0; i <= 4; i++) {
    const phaseTasks = data.tasks.filter(task => task.phase === `P${i}`);
    const counts = statuses.map(status => phaseTasks.filter(task => task.status === status).length);
    lines.push(`| P${i} | ${phaseTasks.length} | ${counts.join(' | ')} | G${i} ${data.gates.find(gate => gate.id === `G${i}`).status} |`);
  }
  lines.push('', '## 当前可开始', '');
  const ready = data.tasks.filter(task => task.status === 'NOT_STARTED' && waits(task, data).length === 0);
  if (!ready.length) lines.push('没有满足前置条件的待开始任务；请先处理进行中任务、阻塞项或阶段门槛。');
  for (const task of ready) lines.push(`- **${task.id} ${task.title}**：${task.responsibility}，负责人${task.owner ? ` ${cell(task.owner)}` : '待认领'}。`);
  lines.push('', '## 工作包', '', '| ID | 工作包 | 状态 | 主责／负责人 | 尚待完成的前置 | OpenSpec 变更 |', '| --- | --- | --- | --- | --- | --- |');
  for (const task of data.tasks) {
    const changes = (task.changes ?? []).map(change => `[${change}](../${changePath(change)}/proposal.md)`).join('<br>') || '待创建';
    lines.push(`| ${task.id} | ${cell(task.title)} | ${task.status} | ${cell(task.responsibility)}／${cell(task.owner)} | ${waits(task, data).join('、') || '已满足'} | ${changes} |`);
  }
  lines.push('', '## 显式阻塞', '');
  const blocked = data.tasks.filter(task => task.status === 'BLOCKED');
  if (!blocked.length) lines.push('当前未登记显式阻塞。等待计划内的前置任务不自动标为 BLOCKED。');
  for (const task of blocked) lines.push(`- ${task.id}：${cell(task.blockedReason)}；负责人 ${cell(task.owner)}；下次核实：${cell(task.nextCheck)}。`);
  lines.push('', '## 阶段门槛', '', '| 门槛 | 状态 | 要求 | 证据 |', '| --- | --- | --- | --- |');
  for (const gate of data.gates) lines.push(`| ${gate.id} | ${gate.status} | ${cell(gate.summary)} | ${gate.evidence.length ? gate.evidence.map(ref => /^https:\/\//.test(ref) ? `[记录](${ref})` : `[记录](../${ref})`).join('、') : '待执行／待评审'} |`);
  lines.push('', '任务全部 DONE 后仍须单独完成阶段评审；只有门槛 PASSED 才开放下一阶段正式任务。', '',
    '负责人、日期、证据和评审结论填写实际记录。详细工作范围、交付物、完成证据和设计基线见 [状态源](./tasks.json)；日常操作见 [管理说明](./README.md)。', '');
  return lines.join('\n');
}

try {
  const [command = 'status', id] = process.argv.slice(2);
  const data = JSON.parse(read('project/tasks.json'));
  const errors = validate(data);
  if (errors.length) throw new Error(errors.join('\n'));
  if (command === 'render') {
    writeFileSync(boardFile, render(data));
    console.log('已更新 project/任务台账.md');
  } else if (command === 'check') {
    if (!existsSync(boardFile) || readFileSync(boardFile, 'utf8') !== render(data)) throw new Error('任务台账视图已过期，请运行 node project/manage.mjs render');
    console.log(`台账检查通过：${data.tasks.length} 个工作包、5 个阶段门槛；依赖无环、来源一致、基线匹配。`);
    console.log('此检查只验证记录结构与引用，不执行产品验收。');
  } else if (command === 'next') {
    for (const task of data.tasks.filter(task => task.status === 'NOT_STARTED' && waits(task, data).length === 0)) console.log(`${task.id} ${task.title}（${task.responsibility}，${task.owner ?? '待认领'}）`);
  } else if (command === 'show') {
    const task = data.tasks.find(task => task.id === id);
    if (!task) throw new Error(`找不到工作包：${id ?? '请提供 ID，例如 P0-01'}`);
    console.log(JSON.stringify({ ...task, waitingFor: waits(task, data) }, null, 2));
  } else if (command === 'status') {
    console.log(`DevMesh：${data.tasks.length} 个工作包`);
    for (const status of statuses) console.log(`${status}: ${data.tasks.filter(task => task.status === status).length}`);
    console.log(`阶段门槛：${data.gates.map(gate => `${gate.id}=${gate.status}`).join('，')}`);
    console.log('可开始任务：node project/manage.mjs next');
  } else throw new Error('用法：node project/manage.mjs status|next|show <ID>|render|check');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
