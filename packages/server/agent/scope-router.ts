import { Value } from '@sinclair/typebox/value';
import {
  ScopeClassifierResultSchema,
  type PageIntent,
  type ScopeClassifierResult,
} from '@origamix/shared/protocol/agent';

export const OUT_OF_SCOPE_REPLY =
  '我只能协助搭建、修改和说明当前低代码页面。请描述你希望在页面中创建或调整的内容。';

export interface ScopeClassifier {
  /** This classifier receives text only and has no Tool Registry or execution callback. */
  classify(input: Readonly<{ message: string; pageId: string }>): Promise<unknown>;
}

export interface ScopeRouterOptions {
  classifier?: ScopeClassifier;
  classifierThreshold?: number;
}

const pageNouns =
  /(页面|表单|表格|按钮|输入框|选择器|下拉|开关|容器|文本|标题|字段|组件|物料|搭建器|schema)/i;
const modifyVerbs =
  /(创建|新建|搭建|生成|添加|增加|加上|修改|调整|删除|移除|配置|设置|改成|做一个)/i;
const questionWords =
  /(怎么|如何|哪些|什么|为何|为什么|是否|能否|说明|介绍|查看|多少|有没有|吗[？?]?)/i;
const weather = /(天气|气温|下雨|晴天|空气质量)/i;
const explicitPageCreation = /(创建|新建|搭建|生成|做一个).{0,12}(页面|表单|表格|看板|展示页)/i;
const ambiguousAdd = /^(请)?(加|添加|增加)(一个|个)?[^，。！？!?]{1,16}$/i;
const obviousGeneral = /(写诗|讲笑话|翻译|新闻|股票|汇率|星座|百科|菜谱|电影推荐)/i;
const promptInjection =
  /(忽略|无视|覆盖|绕过).{0,12}(系统|之前|以上|指令|规则|策略)|system\s*prompt|developer\s*message|把.{0,8}模式设为/i;
const politeModification =
  /(能否|是否|可以|可否).{0,24}(把|将)?.*(修改|调整|删除|移除|配置|设置|改成|添加|增加)/i;

const normalized = (message: string): string => {
  return message.trim().replace(/\s+/g, ' ');
};

const clarification = (pageId: string, reason: string, requirement?: string): PageIntent => {
  return {
    mode: 'clarification_required',
    scope: 'page',
    pageId,
    ...(requirement ? { normalizedRequirement: requirement } : {}),
    confidence: 1,
    reason,
    suggestedQuestion: '请说明要添加或修改的具体页面内容、用途和字段。',
    requiresConfirmation: false,
  };
};

const fromClassification = (
  result: ScopeClassifierResult,
  pageId: string,
  threshold: number,
): PageIntent => {
  if (result.confidence < threshold) return clarification(pageId, '意图置信度不足，需要补充说明');
  if (result.mode === 'out_of_scope') {
    return {
      mode: 'out_of_scope',
      scope: 'page',
      confidence: result.confidence,
      reason: result.reason,
      requiresConfirmation: false,
    };
  }
  if (result.mode === 'clarification_required') {
    return {
      mode: result.mode,
      scope: 'page',
      pageId,
      ...(result.normalizedRequirement
        ? { normalizedRequirement: result.normalizedRequirement }
        : {}),
      confidence: result.confidence,
      reason: result.reason,
      suggestedQuestion: result.suggestedQuestion ?? '请更具体地描述要搭建或了解的页面内容。',
      requiresConfirmation: false,
    };
  }
  if (!result.normalizedRequirement) return clarification(pageId, '分类结果缺少明确需求');
  return {
    mode: result.mode,
    scope: 'page',
    pageId,
    normalizedRequirement: result.normalizedRequirement,
    confidence: result.confidence,
    reason: result.reason,
    requiresConfirmation: false,
  };
};

export class ScopeRouter {
  private readonly threshold: number;
  constructor(private readonly options: ScopeRouterOptions = {}) {
    this.threshold = options.classifierThreshold ?? 0.78;
  }

  async route(message: string, pageId: string): Promise<PageIntent> {
    const text = normalized(message);
    if (!text) return clarification(pageId, '需求为空');
    if (promptInjection.test(text))
      return clarification(pageId, '输入包含改变系统策略或运行模式的指令', text);

    // Page creation wins over subject-matter words: a weather display page is still page work.
    if (
      explicitPageCreation.test(text) &&
      (!questionWords.test(text) || politeModification.test(text))
    ) {
      return {
        mode: 'page_modify',
        scope: 'page',
        pageId,
        normalizedRequirement: text,
        confidence: 0.99,
        reason: '明确要求创建低代码页面',
        requiresConfirmation: false,
      };
    }
    if (weather.test(text) && !pageNouns.test(text)) {
      if (ambiguousAdd.test(text))
        return clarification(pageId, '“天气”可能指页面内容，也可能是通用问答', text);
      return {
        mode: 'out_of_scope',
        scope: 'page',
        confidence: 0.99,
        reason: '通用天气查询不属于低代码页面范围',
        requiresConfirmation: false,
      };
    }
    if (obviousGeneral.test(text) && !pageNouns.test(text)) {
      return {
        mode: 'out_of_scope',
        scope: 'page',
        confidence: 0.98,
        reason: '请求不属于低代码页面范围',
        requiresConfirmation: false,
      };
    }
    // A concrete modification verb wins over polite question wording such as
    // “能否把按钮改成主要按钮？”.
    if (
      pageNouns.test(text) &&
      modifyVerbs.test(text) &&
      (!questionWords.test(text) || politeModification.test(text))
    ) {
      if (ambiguousAdd.test(text)) return clarification(pageId, '修改目标或用途不明确', text);
      return {
        mode: 'page_modify',
        scope: 'page',
        pageId,
        normalizedRequirement: text,
        confidence: 0.96,
        reason: '包含明确页面对象和修改动作',
        requiresConfirmation: false,
      };
    }
    if (pageNouns.test(text) && questionWords.test(text)) {
      return {
        mode: 'page_question',
        scope: 'page',
        pageId,
        normalizedRequirement: text,
        confidence: 0.95,
        reason: '询问页面或搭建器信息',
        requiresConfirmation: false,
      };
    }
    if (!this.options.classifier) return clarification(pageId, '规则无法确定用户意图', text);
    try {
      const result = await this.options.classifier.classify({ message: text, pageId });
      if (!Value.Check(ScopeClassifierResultSchema, result)) {
        return clarification(pageId, '分类器返回了无效结果', text);
      }
      return fromClassification(result, pageId, this.threshold);
    } catch {
      return clarification(pageId, '分类器暂时不可用', text);
    }
  }
}
