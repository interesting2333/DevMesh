# 工作台三栏对齐修复

2026-11-17：按用户截图修复5.2三栏底边不齐。桌面#root纵向flex按顶部真实高度分配剩余视口，三栏使用同一grid行和stretch，取消独立min-height／sticky估算；中栏合并为完整面板并去掉输入嵌套外框，导航列表与中／右栏内容独立滚动。实际Edge157复核1843×960、1440×900、1843×640、1024×768及390×844，共7张截图；所有桌面三栏顶底偏差小于1px且无文档纵／横向溢出，16项目列表可滚动且新建／更多可见，表单提交可滚动到达，切窄屏保留草稿。既有页面9/9通过，范围Lint与含类型声明的Input API构建通过；只有CSS变化，未重复全仓类型／Lint或外部验收。

[宽屏新建页面](./development/panel-alignment/wide-new-project.png)、[实际边界量测](./development/panel-alignment/layout-measurements.json)、[检查记录](./development/panel-alignment/evidence.json)。新建页面三栏边界为top99/bottom938；已有执行因顶部状态增高，1440×900时三栏同步变为top141/bottom878，1843×640时为top141/bottom618。CSS产物源码映射与当前源逐字匹配，浏览器脚本未改。长列表与提交按钮滚动检查均为实际原页面操作，不是隐藏溢出绕过；身份与项目数据是本地夹具，未更改业务状态或推导正式产品验收。
