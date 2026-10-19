export const FLOW_GENERATION_GUIDE = [
  '一次请求可同时新增组件、全局变量和事件流程，合并为一个完整 operations 数组提交。',
  '先 get_page_logic_context 核实已有绑定和变量；修改已有事件前 get_event_flow 完整读取流程及全部引用方。需要的节点逐个 get_flow_node_manifest，物料事件、属性、方法按 get_material_manifest 核实。',
  '精确只读工具返回 complete=true 时 data 完整；否则按 nextOffset 连续读取到 null，确认 Working 版本一致，按 offset 拼接 json 后解析。不能用未读完的分片或 schemaFragment 重建、覆盖已有流程。超出工具预算时说明限制，保留现有内容。',
  '只修改一个事件时优先 setElementEventBinding/removeElementEventBinding，保留其他事件。共享流程只改一个引用方时，复制为新 flowId 并重新绑定；用户明确要求共同修改时才更新共享流程。解绑不自动删除流程。',
  '流程格式为 {startId,nodes}，节点为 {id,type,props,prev,next}；id 与字典键一致，恰好一个 start，无输入边；prev/next 双向一致、无循环，生成的所有节点从 start 可达。条件 true/false 各最多一条，props.condition 的 {value,nextNode} 与 next 一致。不要生成画布坐标或 flowGraph。',
  '物料 context.methods 声明事件；context.values 中 isMethod=true 的项才是可调用方法。setElementProps 可设置 propsSchema 属性或 context.variables。目标、方法、变量与显式引用必须属于本页；变量先声明，并完整保留其他变量声明。',
  '全局变量声明为 {name,description,type?,defaultValue?}；对象/数组默认值采用 JSON 字符串。不要发明 event.* 上下文，当前事件逻辑通过 state/global/result/method 取值。',
  '优先使用声明式节点。HyperValue 支持 string/number/boolean/null/contextValue/expression/function；没有 json 类型。表达式没有隐式上下文。函数为 {type:"function",value:{params:[{name:"data",value:"result.request.data"}],body:"return data;"}}，参数名称合法且唯一，绑定值采用 global.变量、state.元素ID.属性、method.元素ID.方法或 result.节点ID.路径。',
  'result 引用只使用同一流程中所有路径都已先执行的非 start 节点；用请求→条件→动作的连线顺序明确依赖。interfaceRequest 返回 {ok,status,data,error}，失败也返回该对象，用 condition 分支处理失败。headers/queryParams/bodyParams 必须是函数。',
  'defaultProps 可能含空目标、空代码，是编辑草稿，生成结果必须补齐。接口地址等关键事实缺失时澄清，不臆造服务接口或凭据。JS 仅由页面 Runtime 执行，不请求在 Server/工作台试跑。提交成功仅表示 Working 已更新，不表示事件已在预览中验证，不自动保存版本或 Apply。',
  '校验错误按 code/path/operationIndex 修复。保留原完整批次中其他操作，针对原始 baseWorkingVersion 重新提交完整 operations；版本冲突或写入结果不明确时停止，不能重放。',
].join('\n');
