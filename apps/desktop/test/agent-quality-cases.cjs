// Public, synthetic requirements only. No private project or model output belongs here.
module.exports = [
  {
    id: 'customer-form',
    name: '客户登记',
    prompt:
      '创建客户登记页面：标题文本为“客户登记”；一个表单容器内放姓名、邮箱两个输入框，placeholder 分别是“请输入姓名”“请输入邮箱”；一个按钮，别名为“登记按钮”，文字为“登记”；一个文本，别名为“登记状态”，文字为“待登记”。点击登记按钮后用声明式节点将登记状态的文字改为“已登记”。只配置本页交互，不需要后端或提交校验。所有可见元素放在页面根容器内。',
    types: { form: 1, input: 2, button: 1, text: 2 },
    visible: ['客户登记', '待登记'],
    placeholders: ['请输入姓名', '请输入邮箱'],
    button: '登记',
    afterClick: '已登记',
    followUp:
      '只把别名为“登记按钮”的按钮文字从“登记”改为“确认登记”。保留所有其他元素属性、层级、变量、事件绑定和流程。',
    finalButton: '确认登记',
  },
  {
    id: 'customer-table',
    name: '客户列表',
    prompt:
      '创建客户列表页：标题“客户列表”；表格别名“客户表格”，包含姓名(name)、邮箱(email)两列，列标题分别是“姓名”“邮箱”；dataSource 是 [{"key":"1","name":"林晓","email":"lin@example.test"},{"key":"2","name":"陈安","email":"chen@example.test"}]，关闭分页。增加文字“未确认”的文本，别名“列表状态”，以及文字“确认列表”、别名“列表按钮”的按钮。点击按钮后通过声明式节点把列表状态文字设为“已确认”。不需要接口或额外业务功能。',
    types: { table: 1, button: 1, text: 2 },
    visible: ['客户列表', '姓名', '邮箱', '林晓', '陈安', '未确认'],
    placeholders: [],
    button: '确认列表',
    afterClick: '已确认',
  },
  {
    id: 'customer-detail',
    name: '客户详情',
    prompt:
      '创建客户详情页：标题“客户详情”；用两个容器分组展示“基本信息”“联系信息”，分别显示文本“姓名：林晓”和“邮箱：lin@example.test”。增加别名“详情状态”、文字“待联系”的文本，以及别名“联系按钮”、文字“标记已联系”的按钮。点击按钮后通过声明式节点把详情状态文字改为“已联系”。保持清晰的分组层级，不需要接口或弹窗。',
    types: { container: 2, button: 1, text: 2 },
    visible: ['客户详情', '基本信息', '联系信息', '姓名：林晓', '邮箱：lin@example.test', '待联系'],
    placeholders: [],
    button: '标记已联系',
    afterClick: '已联系',
  },
];
